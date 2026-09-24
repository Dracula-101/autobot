import { api } from './api'
import { supabase } from './supabase'

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** Launched from the home screen (required for push on iPhone). */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function deviceLabel(): string {
  const ua = navigator.userAgent
  const device = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : 'Device'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua) && !/Chromium/.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser'
  return `${device} · ${isStandalone() ? 'App' : browser}`
}

function keyBytes(base64url: string): Uint8Array {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4)
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

async function vapidPublicKey(): Promise<string> {
  const cached = localStorage.getItem('autobot:vapid')
  if (cached) return cached
  const { publicKey } = await api.vapidKey()
  localStorage.setItem('autobot:vapid', publicKey)
  return publicKey
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

export async function enablePush(userId: string): Promise<string | null> {
  if (!pushSupported()) {
    return isIOS() && !isStandalone()
      ? 'On iPhone, add Autobot to your Home Screen first (Share → Add to Home Screen), then open it from there.'
      : 'This browser can’t do push notifications.'
  }
  if (!supabase) return 'Sign in first so reminders can reach every device.'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'Notifications are blocked. Allow them in your browser or phone settings.'
  try {
    const reg = await navigator.serviceWorker.ready
    const key = await vapidPublicKey()
    let sub = await reg.pushManager.getSubscription()
    if (sub) {
      // A key rotation leaves an old subscription behind; start fresh.
      const current = sub.options.applicationServerKey
      const matches =
        current && btoa(String.fromCharCode(...new Uint8Array(current))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') === key
      if (!matches) {
        await sub.unsubscribe()
        sub = null
      }
    }
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) as BufferSource })
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        device: deviceLabel(),
        last_seen_at: new Date().toISOString(),
        failures: 0,
      },
      { onConflict: 'endpoint' },
    )
    return error ? error.message : null
  } catch (e) {
    return e instanceof Error ? e.message : 'Couldn’t turn on notifications.'
  }
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription()
  if (!sub) return
  await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
