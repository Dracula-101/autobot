#!/usr/bin/env node
/**
 * Miss-day reminder — runs in GitHub Actions (Node), never in the browser.
 * Queries Supabase for a day_checkins row for "today" in America/Denver.
 * If missing for the user matching REMINDER_TO_EMAIL, sends SMTP mail.
 * Voice: Autobot — warm caretaker, not naggy.
 */
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  REMINDER_TO_EMAIL,
  SMTP_HOST,
  SMTP_PORT = '587',
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  PAGES_URL = 'https://Dracula-101.github.io/autobot/',
} = process.env

function denverToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()) // YYYY-MM-DD
}

function requireEnv(name, value) {
  if (!value) {
    console.error(`Missing required env: ${name}`)
    process.exit(1)
  }
}

async function main() {
  requireEnv('SUPABASE_URL', SUPABASE_URL)
  requireEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY)
  requireEnv('REMINDER_TO_EMAIL', REMINDER_TO_EMAIL)
  requireEnv('SMTP_HOST', SMTP_HOST)
  requireEnv('SMTP_USER', SMTP_USER)
  requireEnv('SMTP_PASS', SMTP_PASS)
  requireEnv('SMTP_FROM', SMTP_FROM)

  const today = denverToday()
  console.log(`Checking check-in for ${today} (America/Denver) → ${REMINDER_TO_EMAIL}`)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, display_name, reminder_email')
    .eq('reminder_email', REMINDER_TO_EMAIL)
    .maybeSingle()

  if (profileErr) {
    console.error('Profile query failed:', profileErr.message)
    process.exit(1)
  }

  if (!profile) {
    console.log('No profile with that reminder_email — nothing to do.')
    process.exit(0)
  }

  const { data: checkin, error: checkinErr } = await supabase
    .from('day_checkins')
    .select('id, checked_in_at')
    .eq('user_id', profile.id)
    .eq('date', today)
    .maybeSingle()

  if (checkinErr) {
    console.error('Check-in query failed:', checkinErr.message)
    process.exit(1)
  }

  if (checkin) {
    console.log(`Already checked in at ${checkin.checked_in_at} — no email.`)
    process.exit(0)
  }

  const name = profile.display_name?.split(' ')[0] || 'there'
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })

  const subject = `Autobot checked in — you’re still open for ${today}`
  const text = `Hey ${name},

Just a soft nudge from Autobot — I haven’t seen today’s check-in yet (${today}, America/Denver).

No stress. When you’re ready, open the app, check in with me, and knock out what you can on campus.

${PAGES_URL}

— Autobot
`
  const html = `
  <div style="font-family:system-ui,sans-serif;max-width:480px;line-height:1.5;color:#1a1a1a">
    <p>Hey ${name},</p>
    <p>Just a soft nudge from <strong>Autobot</strong> — I haven’t seen today’s check-in yet
      (<strong>${today}</strong>, America/Denver).</p>
    <p>No stress. When you’re ready, open the app, <em>check in with me</em>, and knock out what you can on campus.</p>
    <p><a href="${PAGES_URL}" style="color:#3d7a5a">${PAGES_URL}</a></p>
    <p style="color:#888;font-size:13px">— Autobot</p>
  </div>`

  await transporter.sendMail({
    from: SMTP_FROM,
    to: REMINDER_TO_EMAIL,
    subject,
    text,
    html,
  })

  console.log(`Reminder sent to ${REMINDER_TO_EMAIL}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
