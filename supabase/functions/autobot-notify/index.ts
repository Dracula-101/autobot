// Push reminders. Called every 5 minutes by pg_cron (shared secret), or by a
// signed-in user to send a test notification / fetch the VAPID public key.

import { json, preflight } from '../_shared/http.ts'
import { adminClient, secret, userFromRequest, type Db } from '../_shared/db.ts'
import { importVapidKeys, sendPush, type VapidKeys } from '../_shared/webpush.ts'
import { loadState } from '../_shared/state.ts'
import { dueReminders, type DueReminder } from '../_shared/core/index.ts'

const SUBJECT = 'https://dracula-101.github.io/autobot/'

interface Subscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  failures: number
}

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function vapidKeys(): Promise<VapidKeys | null> {
  const raw = await secret('VAPID_KEYS', 'vapid_keys')
  return raw ? importVapidKeys(raw) : null
}

async function deliver(
  db: Db,
  subs: Subscription[],
  payload: { title: string; body: string; url: string; tag: string },
  vapid: VapidKeys,
): Promise<{ delivered: number; errors: string[] }> {
  let delivered = 0
  const errors: string[] = []
  for (const sub of subs) {
    try {
      const res = await sendPush(sub, payload, vapid, SUBJECT)
      if (res.ok) {
        delivered++
        await db.from('push_subscriptions').update({ failures: 0, last_seen_at: new Date().toISOString() }).eq('id', sub.id)
      } else if (res.gone) {
        await db.from('push_subscriptions').delete().eq('id', sub.id)
        errors.push(`gone ${res.status}`)
      } else {
        await db.from('push_subscriptions').update({ failures: sub.failures + 1 }).eq('id', sub.id)
        errors.push(`${res.status} ${res.detail ?? ''}`.trim())
      }
    } catch (e) {
      errors.push((e as Error).message)
    }
  }
  return { delivered, errors }
}

async function runCron(): Promise<Response> {
  const db = adminClient()
  const vapid = await vapidKeys()
  if (!vapid) return json({ error: 'VAPID keys missing' }, 500)

  const { data, error } = await db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth, failures')
  if (error) return json({ error: error.message }, 500)
  const byUser = new Map<string, Subscription[]>()
  for (const s of (data ?? []) as Subscription[]) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s])

  const now = new Date()
  const report: Record<string, unknown>[] = []
  for (const [userId, subs] of byUser) {
    try {
      const state = await loadState(db, userId, { now })
      const since = new Date(now.getTime() - 3 * 86_400_000).toISOString()
      const sent = await db.from('notifications').select('dedupe_key').eq('user_id', userId).gte('sent_at', since)
      const due: DueReminder[] = dueReminders({
        now,
        settings: state.settings,
        routines: state.routines,
        routineLogs: state.routineLogs,
        checkin: state.checkin,
        missions: state.missions,
        contacts: state.contacts,
        logs: state.logs,
        assignments: state.assignments,
        sentKeys: new Set((sent.data ?? []).map((r: { dedupe_key: string }) => r.dedupe_key)),
      })
      for (const r of due) {
        // Claim the key first so overlapping ticks can never double-send.
        const claim = await db
          .from('notifications')
          .insert({ user_id: userId, dedupe_key: r.key, title: r.title, body: r.body, url: r.url })
          .select('id')
          .single()
        if (claim.error) continue
        const result = await deliver(db, subs, { title: r.title, body: r.body, url: r.url, tag: r.tag }, vapid)
        await db.from('notifications').update({ delivered: result.delivered }).eq('id', claim.data.id)
        await db.from('activity').insert({
          user_id: userId,
          actor: 'system',
          kind: 'reminder.sent',
          summary: `Reminder sent: ${r.title} — ${r.body}`,
          data: { key: r.key, delivered: result.delivered, errors: result.errors },
        })
        report.push({ key: r.key, ...result })
      }
    } catch (e) {
      report.push({ user: userId.slice(0, 8), error: (e as Error).message })
    }
  }
  return json({ users: byUser.size, sent: report })
}

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const cronHeader = req.headers.get('x-autobot-cron')
  if (cronHeader) {
    const expected = await secret('AUTOBOT_CRON_SECRET', 'autobot_cron_secret')
    if (!expected || !sameSecret(cronHeader, expected)) return json({ error: 'Forbidden' }, 403)
    return runCron()
  }

  const auth = await userFromRequest(req)
  if (!auth) return json({ error: 'Sign in first.' }, 401)
  const body = (await req.json().catch(() => ({}))) as { action?: string }
  const vapid = await vapidKeys()
  if (!vapid) return json({ error: 'Push isn’t configured on the server yet.' }, 503)

  if (body.action === 'vapid') return json({ publicKey: vapid.publicKey })

  if (body.action === 'test') {
    const db = adminClient()
    const { data } = await db
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, failures')
      .eq('user_id', auth.user.id)
    const subs = (data ?? []) as Subscription[]
    if (!subs.length) return json({ error: 'No devices are subscribed yet.' }, 404)
    const result = await deliver(
      db,
      subs,
      {
        title: '🤖 Beep boop — it works',
        body: 'This is how I’ll tap you for pills, serum, classes and bedtime.',
        url: '/',
        tag: 'test',
      },
      vapid,
    )
    return json({ devices: subs.length, ...result })
  }

  return json({ error: 'Unknown action' }, 400)
})
