import { WeekStrip } from '../components/WeekStrip'
import { TaskList } from '../components/TaskList'
import { QuotaPanel } from '../components/QuotaPanel'

export function TodayPage() {
  return (
    <div className="space-y-6">
      <WeekStrip />
      <QuotaPanel />
      <TaskList />
    </div>
  )
}
