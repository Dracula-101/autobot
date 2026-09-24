import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import {
  DAY_KEYS,
  DAY_TYPE_LABEL,
  formatDate,
  hhmmToDayMinutes,
  tomorrowLine,
  weekdayOf,
  weekStart,
  type Phase,
  type Review,
} from '@core/index.ts'
import { useApp, useRows } from '../lib/app'
import { usePhase } from '../lib/phase'
import { useToday, type TodayState } from '../lib/today'
import { useActions } from '../lib/useActions'
import { describeWeather } from '../lib/weather'
import { Autobot, type Mood } from '../components/Autobot'
import { Sky } from '../components/Sky'
import { MeButton } from '../components/Shell'
import { AddMission, MomentGroups } from '../components/Missions'
import { BedtimeCard, ClassTimeline, NextUpCard, PerWeekChips, StackCard, WeekPulse } from '../components/TodayCards'
import { SectionTitle } from '../components/ui'

function Hero({ t, phase, text, mood }: { t: TodayState; phase: Phase; text: string; mood: Mood }) {
  const weather = t.weather ? describeWeather(t.weather.code) : null
  return (
    <section className="relative isolate">
      <Sky phase={phase} className="absolute inset-0 -z-10" />
      <div className="mx-auto max-w-[760px] px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 lg:pt-8">
        <div className="flex items-center justify-between gap-3 py-2">
          <p className="text-[13px] font-extrabold text-ink-2">
            {formatDate(t.date, { weekday: true })} · {DAY_TYPE_LABEL[t.type]}
            {t.weather && weather && (
              <span className="text-ink-3">
                {' '}
                · <span className="num">{t.weather.tempF}°</span> {weather.label}
              </span>
            )}
          </p>
          <MeButton className="lg:hidden" />
        </div>
        <div className="flex items-end gap-3 pb-7 pt-3 sm:gap-5">
          <Autobot size={104} mood={mood} track reactive className="sm:h-[128px] sm:w-[128px]" />
          <div className="relative mb-4 min-w-0 flex-1">
            <div
              key={text}
              className="animate-fade-up rounded-[24px] rounded-bl-md bg-surface px-4 py-3.5 shadow-card sm:px-5 sm:py-4"
            >
              <p className="text-[16px] font-bold leading-snug text-ink sm:text-[17px]">{text}</p>
              <Link
                to="/chat"
                className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-extrabold text-ink-3 transition hover:text-ink lg:hidden"
              >
                <MessageCircle className="h-4 w-4" /> Reply
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ReviewCard({ date }: { date: string }) {
  const actions = useActions()
  const ws = weekStart(date)
  const reviews = useRows<Review>('reviews')
  const review = reviews.find((r) => r.week_start === ws)
  const [draft, setDraft] = useState({ win: review?.win ?? '', fix: review?.fix ?? '', focus: review?.focus ?? '' })
  const field = (key: 'win' | 'fix' | 'focus', label: string, placeholder: string) => (
    <div>
      <label className="label" htmlFor={`review-${key}`}>
        {label}
      </label>
      <textarea
        id={`review-${key}`}
        rows={2}
        className="field resize-none"
        value={draft[key]}
        placeholder={placeholder}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        onBlur={() => actions.saveReview(ws, { [key]: draft[key] })}
      />
    </div>
  )
  return (
    <section className="card space-y-3 p-4">
      <div>
        <h3 className="text-[15px] font-black text-ink">Week review</h3>
        <p className="text-[13px] font-semibold text-ink-3">Two minutes. Autobot reads this when planning next week.</p>
      </div>
      {field('win', 'One win', 'Sent 8 referral asks, first reply from Microsoft')}
      {field('fix', 'One fix', 'Stayed in my room Wednesday — leave by noon')}
      {field('focus', 'Next week’s focus', 'Graphs + 10 applications')}
      <Link to="/chat" state={{ prefill: 'Review my week with me — what went well, what to fix, and next week’s focus.' }} className="btn-soft w-full">
        Review it with Autobot
      </Link>
    </section>
  )
}

export function TodayPage() {
  const { settings } = useApp()
  const phase = usePhase()
  const [skip, setSkip] = useState<string[]>([])
  const t = useToday(skip)
  const [params] = useSearchParams()

  const showBrief = Boolean(t.brief) && (t.moment === 'wake' || (t.wakeMins != null && t.nowMins - t.wakeMins < 150))
  const text = showBrief ? t.brief!.content : t.speech.text
  const mood: Mood = showBrief ? 'happy' : t.speech.mood

  const morningPending = t.morning.some((i) => !i.done)
  const nightPending = t.night.some((i) => !i.done)
  const lateDay = t.moment === 'night' || t.moment === 'bed'
  const showMorning = t.morning.length > 0 && (morningPending ? t.nowMins < 18 * 60 : t.moment === 'wake')
  const showNight = t.night.length > 0 && (lateDay || (t.moment === 'evening' && nightPending))
  const open = t.missions.filter((m) => m.status === 'todo' || m.status === 'doing').length
  const daysLeft = 7 - DAY_KEYS.indexOf(weekdayOf(t.date))
  const nextTarget = t.nextUp?.target_key

  return (
    <div>
      <Hero t={t} phase={phase} text={text} mood={mood} />
      <div className="page space-y-4 pt-0 lg:pt-0">
        {showMorning && <StackCard stack="morning" items={t.morning} />}
        {showNight && lateDay && <StackCard stack="night" items={t.night} />}
        {t.moment === 'bed' ? (
          <BedtimeCard
            nowMins={t.nowMins}
            bedMins={hhmmToDayMinutes(settings.sleep.bed, settings.rolloverHour)}
            open={open}
            tomorrow={tomorrowLine(t.tomorrowLectures)}
          />
        ) : (
        <NextUpCard
          mission={t.nextUp}
          progress={t.nextUp ? (t.progress.get(t.nextUp.id) ?? 0) : 0}
          type={t.type}
          moment={t.moment}
          weekCount={nextTarget ? t.totals[nextTarget] : undefined}
          weekTarget={nextTarget ? settings.targets[nextTarget] : undefined}
          total={t.total}
          onSwap={() => setSkip((s) => (t.nextUp && s.length + 1 < open ? [...s, t.nextUp.id] : []))}
        />
        )}
        {showNight && !lateDay && <StackCard stack="night" items={t.night} />}
        <PerWeekChips items={t.perWeek} />
        <ClassTimeline lectures={t.lectures} nowMins={t.nowMins} />

        <div className="pt-2">
          <SectionTitle title="Today’s plan" hint="No clock — just the moments of your day" />
          {t.missions.length ? (
            <MomentGroups missions={t.missions} progress={t.progress} current={t.moment} type={t.type} />
          ) : (
            <p className="card p-5 text-[14px] font-semibold text-ink-3">Planning your day…</p>
          )}
        </div>
        <AddMission day={t.date} type={t.type} defaultMoment={t.moment} />
        <WeekPulse totals={t.totals} targets={settings.targets} daysLeft={daysLeft} />
        {(weekdayOf(t.date) === 'sun' || params.has('review')) && <ReviewCard date={t.date} />}
      </div>
    </div>
  )
}
