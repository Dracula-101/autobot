// Autobot's words. One place for the in-app speech bubble and push copy, so
// the robot sounds like the same friend everywhere.

import type { ClassBlock, DayType, Mission, Moment, Settings, Voice } from './types.ts'
import { formatClock, formatDuration, hhmmToDayMinutes } from './time.ts'
import { hash128 } from './ids.ts'

export type Mood =
  | 'idle'
  | 'happy'
  | 'focused'
  | 'sleepy'
  | 'proud'
  | 'worried'
  | 'thinking'
  | 'love'
  | 'wink'

export function pick<T>(seed: string, options: T[]): T {
  const n = parseInt(hash128(seed).slice(0, 8), 16)
  return options[n % options.length]
}

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const NUDGE_COPY: Record<'idle' | 'evening' | 'afterClass', Record<Voice, string[]>> = {
  idle: {
    firm: [
      '{hours} up and the board hasn’t moved. {next} — just start it, 20 minutes.',
      'You know the YouTube spiral. Break it: {next}, then you’ve earned a video.',
      'Nothing done yet, and that’s fine — until it isn’t. One small win: {next}.',
    ],
    gentle: [
      'Slow start? Totally okay. Want to try one small thing: {next}?',
      'Whenever you’re ready — {next} is a nice easy start.',
    ],
    strict: [
      '{hours} awake, zero done. The job market isn’t waiting. {next}. Now.',
      'No more warming up. {next}, start the timer.',
    ],
  },
  evening: {
    firm: [
      'Evening check: {done}/{total}. One more push — {next}.',
      '{done}/{total} today. Close one more before the night gets away: {next}.',
    ],
    gentle: ['Evening! {done}/{total} so far. Up for one more? {next}.'],
    strict: ['{done}/{total}. That’s not a finished day. {next}, before dinner ends.'],
  },
  afterClass: {
    firm: [
      'Classes done. Eat, then: {next}.',
      'That’s the lectures. Dinner, then one thing: {next}.',
    ],
    gentle: ['Classes are done — nice. After dinner, maybe {next}?'],
    strict: ['Lectures over. Dinner, then {next}. No couch detour.'],
  },
}

export interface SpeechContext {
  name: string
  settings: Settings
  date: string
  nowMins: number
  type: DayType
  moment: Moment
  wakeMins: number | null
  done: number
  total: number
  nextUp: Mission | null
  morningPending: string[]
  nightPending: string[]
  classes: ClassBlock[]
  tomorrowClasses: ClassBlock[]
  weather?: { code: number; tempF: number } | null
}

export interface Speech {
  text: string
  mood: Mood
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} + ${names[names.length - 1]}`
}

export function tomorrowLine(tomorrow: ClassBlock[]): string {
  if (!tomorrow.length) return 'Tomorrow’s open — big campus block.'
  const first = tomorrow[0]
  return `Tomorrow: ${tomorrow.length} ${tomorrow.length === 1 ? 'class' : 'classes'}, first at ${formatClock(
    hhmmToDayMinutes(first.start),
  )}.`
}

function weatherTail(w: SpeechContext['weather'], type: DayType): string {
  if (!w) return ''
  if ([71, 73, 75, 77, 85, 86].includes(w.code)) return type === 'class' ? ' Snow out — boots.' : ' Snow out — library day.'
  if ([61, 63, 65, 80, 81, 82, 95, 96, 99].includes(w.code)) return ' Rain today — grab a jacket.'
  if (w.tempF >= 88) return ' Hot one — bring water.'
  if (w.tempF <= 25) return ' It’s freezing — layer up.'
  return ''
}

export function speak(ctx: SpeechContext): Speech {
  const { settings, nowMins, name } = ctx
  const bed = hhmmToDayMinutes(settings.sleep.bed, settings.rolloverHour)
  const wake = ctx.wakeMins ?? hhmmToDayMinutes(settings.sleep.wake, settings.rolloverHour)
  const next = ctx.nextUp ? lower(ctx.nextUp.title) : null
  const seed = `${ctx.date}:${ctx.moment}`

  if (nowMins >= bed + 20) {
    return {
      mood: 'sleepy',
      text: ctx.nightPending.length
        ? `It’s ${formatClock(nowMins)} — past bedtime. ${upper(joinNames(ctx.nightPending))}, then lights out. Tomorrow-you says thanks.`
        : `It’s ${formatClock(nowMins)}. Whatever it is will go faster after sleep. Lights out.`,
    }
  }

  if (nowMins >= bed - 60) {
    return {
      mood: 'sleepy',
      text: ctx.nightPending.length
        ? `Night stack: ${joinNames(ctx.nightPending)}. Then screens down. ${tomorrowLine(ctx.tomorrowClasses)}`
        : `Wind-down time. ${tomorrowLine(ctx.tomorrowClasses)} Lights out by ${formatClock(bed)}.`,
    }
  }

  for (const c of ctx.classes) {
    const start = hhmmToDayMinutes(c.start)
    const end = hhmmToDayMinutes(c.end)
    if (nowMins >= start && nowMins < end) {
      return { mood: 'focused', text: `${c.name} until ${formatClock(end)}. I’ve got the rest of today queued.` }
    }
    if (nowMins < start && start - nowMins <= 100) {
      const stack = ctx.morningPending.length ? ` Stack first: ${joinNames(ctx.morningPending)}.` : ''
      return {
        mood: 'focused',
        text: `${c.short} at ${formatClock(start)} in ${c.room}. Leave by ${formatClock(start - 25)}.${stack}`,
      }
    }
  }

  if (ctx.morningPending.length && nowMins < wake + 240) {
    return {
      mood: 'happy',
      text: `Morning, ${name}! ${upper(joinNames(ctx.morningPending))} first${next ? ` — then ${next}` : ''}.${weatherTail(ctx.weather, ctx.type)}`,
    }
  }

  if (ctx.total > 0 && ctx.done === ctx.total) {
    return {
      mood: 'proud',
      text: pick(seed, [
        'Board’s clear. That’s a real day — be proud of it.',
        'Everything’s done. Rest counts too — go do nothing, guilt-free.',
        'All done. This is what locking in looks like.',
      ]),
    }
  }

  if (ctx.type !== 'class' && ctx.done === 0 && ctx.total > 0 && nowMins > wake + 180 && next) {
    return {
      mood: 'worried',
      text: fill(pick(seed, NUDGE_COPY.idle[settings.voice]), {
        hours: formatDuration(nowMins - wake),
        next: ctx.nextUp!.title,
      }),
    }
  }

  if (ctx.done > 0 && next) {
    return {
      mood: 'happy',
      text: `${ctx.done}/${ctx.total} done. ${pick(seed, [
        'Momentum’s real.',
        'Keep it rolling.',
        'That’s the stuff that gets interviews.',
      ])} Next: ${next}.`,
    }
  }

  const dayLine =
    ctx.type === 'free'
      ? 'Free day — the dangerous kind. Out of the room first.'
      : ctx.type === 'sport'
        ? 'Racket day. Get the session in, keep the rest light.'
        : `Class day — ${ctx.classes.length} lectures, first at ${formatClock(hhmmToDayMinutes(ctx.classes[0]?.start ?? '12:30'))}.`

  switch (ctx.moment) {
    case 'wake':
      return { mood: 'happy', text: `Morning, ${name}. ${dayLine}${weatherTail(ctx.weather, ctx.type)}` }
    case 'evening':
      return { mood: 'happy', text: next ? `Evening, ${name}. One more push: ${next}.` : `Evening, ${name}. Easy night.` }
    case 'night':
      return {
        mood: 'focused',
        text: next ? `Night-owl hours — you’re sharp now. ${ctx.nextUp!.title}.` : 'Night-owl hours. Nothing queued — read, stretch, or sleep early.',
      }
    default:
      return { mood: 'happy', text: `${dayLine}${next ? ` Next: ${next}.` : ''}${weatherTail(ctx.weather, ctx.type)}` }
  }
}
