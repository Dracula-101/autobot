// Deterministic UUIDs so two devices generating "today's plan" at the same
// time produce the *same* rows (the second write becomes a no-op).

function mix(h: number, k: number): number {
  h = Math.imul(h ^ k, 0x5bd1e995)
  return h ^ (h >>> 15)
}

/** 128-bit non-cryptographic hash of a string, as 32 hex chars. */
export function hash128(input: string): string {
  let a = 0x9e3779b9
  let b = 0x243f6a88
  let c = 0xb7e15162
  let d = 0x85a308d3
  for (let i = 0; i < input.length; i++) {
    const k = input.charCodeAt(i)
    a = mix(a, k)
    b = mix(b, k + a)
    c = mix(c, k ^ b)
    d = mix(d, k + c)
  }
  a = mix(a ^ input.length, d)
  b = mix(b, a)
  c = mix(c, b)
  d = mix(d, c)
  return [a, b, c, d].map((n) => (n >>> 0).toString(16).padStart(8, '0')).join('')
}

/** A UUID-shaped id derived from `seed` (version nibble 5, RFC 4122 variant). */
export function stableId(seed: string): string {
  const h = hash128(seed)
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

export function randomId(): string {
  return crypto.randomUUID()
}
