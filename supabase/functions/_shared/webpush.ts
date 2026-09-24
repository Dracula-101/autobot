// Web Push (RFC 8030) with aes128gcm payload encryption (RFC 8291 / 8188)
// and VAPID authentication (RFC 8292), using only WebCrypto.

const encoder = new TextEncoder()

/** Byte arrays backed by a plain ArrayBuffer (what WebCrypto and fetch accept). */
type Bytes = Uint8Array<ArrayBuffer>

const utf8 = (text: string): Bytes => new Uint8Array(encoder.encode(text))

export interface PushTarget {
  endpoint: string
  p256dh: string
  auth: string
}

export interface VapidKeys {
  /** Uncompressed P-256 public key, base64url (what the browser needs) */
  publicKey: string
  privateKey: CryptoKey
}

export function b64urlToBytes(s: string): Bytes {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

export function bytesToB64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

/** Keys are stored as JSON: { publicKey: base64url raw, privateJwk: JsonWebKey } */
export async function importVapidKeys(json: string): Promise<VapidKeys> {
  const parsed = JSON.parse(json) as { publicKey: string; privateJwk: JsonWebKey }
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    parsed.privateJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  return { publicKey: parsed.publicKey, privateKey }
}

export async function generateVapidKeys(): Promise<{ publicKey: string; privateJwk: JsonWebKey }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  return { publicKey: bytesToB64url(raw), privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey) }
}

export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, subject: string): Promise<string> {
  const header = bytesToB64url(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = bytesToB64url(
    utf8(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: subject,
      }),
    ),
  )
  const unsigned = `${header}.${claims}`
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, vapid.privateKey, utf8(unsigned)),
  )
  return `vapid t=${unsigned}.${bytesToB64url(signature)}, k=${vapid.publicKey}`
}

async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, bytes: number): Promise<Bytes> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8))
}

/** Encrypts one record for a subscription (RFC 8291, aes128gcm). */
export async function encryptPayload(
  target: Pick<PushTarget, 'p256dh' | 'auth'>,
  plaintext: Uint8Array,
  opts: { salt?: Bytes; serverKeys?: CryptoKeyPair } = {},
): Promise<Bytes> {
  const uaPublic = b64urlToBytes(target.p256dh)
  const authSecret = b64urlToBytes(target.auth)
  const serverKeys =
    opts.serverKeys ??
    ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair)
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, serverKeys.privateKey, 256),
  )

  const ikm = await hkdf(authSecret, shared, concat(utf8('WebPush: info\0'), uaPublic, serverPublic), 32)
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12)

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  // 0x02 marks the final (and only) record.
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(plaintext, new Uint8Array([2]))),
  )

  const header = new Uint8Array(21 + serverPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096)
  header[20] = serverPublic.length
  header.set(serverPublic, 21)
  return concat(header, ciphertext)
}

export interface PushResult {
  ok: boolean
  status: number
  /** The subscription is dead and should be deleted */
  gone: boolean
  detail?: string
}

export async function sendPush(
  target: PushTarget,
  payload: unknown,
  vapid: VapidKeys,
  subject: string,
  opts: { ttl?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high' } = {},
): Promise<PushResult> {
  const body = await encryptPayload(target, utf8(JSON.stringify(payload)))
  const res = await fetch(target.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(target.endpoint, vapid, subject),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(opts.ttl ?? 6 * 3600),
      Urgency: opts.urgency ?? 'high',
    },
    body,
  })
  const detail = res.ok ? undefined : (await res.text()).slice(0, 300)
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410, detail }
}
