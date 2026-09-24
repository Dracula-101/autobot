import { WeekStrip } from '../components/WeekStrip'
import { TaskList } from '../components/TaskList'
import { QuotaPanel } from '../components/QuotaPanel'
import { AutobotMascot } from '../components/AutobotMascot'
import { useApp } from '../context/AppContext'

export function TodayPage() {
  const { isCheckedIn, today, profile } = useApp()
  const name = (profile.display_name || 'Pratik').split(' ')[0]
  const checked = isCheckedIn(today)

  return (
    <div className="space-y-6">
      <div className="card flex items-center gap-3 px-4 py-3.5">
        <AutobotMascot mood={checked ? 'happy' : 'idle'} size={36} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-white/90">
            {checked
              ? `I’ve got you logged, ${name}.`
              : `I’m watching your week, ${name}.`}
          </p>
          <p className="mt-0.5 text-xs text-white/40">
            {checked
              ? 'Stack what you can — I’ll keep the lights on.'
              : 'When you’re ready, check in with me and we’ll take the day.'}
          </p>
        </div>
      </div>
      <WeekStrip />
      <QuotaPanel />
      <TaskList />
    </div>
  )
}
