#!/usr/bin/env node
/**
 * Tue/Thu class nudge — ~90 minutes before first lecture (America/Denver).
 * Intended to run hourly; exits quietly outside the 20-min window.
 */
import nodemailer from 'nodemailer'

const {
  REMINDER_TO_EMAIL,
  SMTP_HOST,
  SMTP_PORT = '587',
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  PAGES_URL = 'https://Dracula-101.github.io/autobot/',
} = process.env

const LECTURES = [
  { id: 'class-linux', course: 'Linux SysAdmin', room: 'ECCR 1B55', startMin: 12 * 60 + 30, endMin: 13 * 60 + 45, days: ['tue', 'thu'] },
  { id: 'class-graphics', course: 'Computer Graphics', room: 'ECCR 200', startMin: 15 * 60 + 30, endMin: 16 * 60 + 45, days: ['tue', 'thu'] },
  { id: 'class-capstone', course: 'Pro Masters Project', room: 'ECCS 1B12', startMin: 17 * 60, endMin: 18 * 60 + 15, days: ['tue', 'thu'] },
]

function denverParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  const weekdayMap = { Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun' }
  const day = weekdayMap[parts.weekday]
  const hour = Number(parts.hour === '24' ? 0 : parts.hour)
  const minute = Number(parts.minute)
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`
  return { day, nowMin: hour * 60 + minute, dateKey }
}

function formatClock(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function requireEnv(name, value) {
  if (!value) {
    console.error(`Missing required env: ${name}`)
    process.exit(1)
  }
}

async function main() {
  requireEnv('REMINDER_TO_EMAIL', REMINDER_TO_EMAIL)
  requireEnv('SMTP_HOST', SMTP_HOST)
  requireEnv('SMTP_USER', SMTP_USER)
  requireEnv('SMTP_PASS', SMTP_PASS)
  requireEnv('SMTP_FROM', SMTP_FROM)

  const { day, nowMin, dateKey } = denverParts()
  const list = LECTURES.filter((l) => l.days.includes(day))
  if (!list.length) {
    console.log(`${dateKey} ${day}: no lectures — skip`)
    return
  }
  const first = list.reduce((a, b) => (a.startMin < b.startMin ? a : b))
  const target = first.startMin - 90
  const open = nowMin >= target && nowMin < target + 20
  console.log(
    `${dateKey} ${day} now=${formatClock(nowMin)} first=${first.course} @ ${formatClock(first.startMin)} window=${formatClock(target)}–${formatClock(target + 20)} open=${open}`,
  )
  if (!open) {
    console.log('Outside reminder window — quiet exit')
    return
  }

  const rest = list
    .slice()
    .sort((a, b) => a.startMin - b.startMin)
    .map((l) => `• ${l.course} ${formatClock(l.startMin)}–${formatClock(l.endMin)} · ${l.room}`)
    .join('\n')

  const subject = `Autobot · ${first.course} in ~90 min`
  const text = `Hey — ${first.course} starts at ${formatClock(first.startMin)} (${first.room}).

Today’s stack:
${rest}

Leave a little early if you need to. Open Autobot when you’re ready:
${PAGES_URL}

— Autobot`
  const html = `<p>Hey — <strong>${first.course}</strong> starts at ${formatClock(first.startMin)} (${first.room}).</p>
<p>Today’s stack:</p>
<pre style="font-family:ui-monospace,monospace;font-size:13px;line-height:1.5">${rest}</pre>
<p><a href="${PAGES_URL}">Open Autobot</a></p>
<p style="color:#888">— Autobot</p>`

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })

  await transporter.sendMail({
    from: SMTP_FROM,
    to: REMINDER_TO_EMAIL,
    subject,
    text,
    html,
  })
  console.log(`Sent class reminder to ${REMINDER_TO_EMAIL}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
