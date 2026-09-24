import { Check } from 'lucide-react'
import type { TaskDef } from '../types'

interface TaskItemProps {
  task: TaskDef
  done: boolean
  onToggle: () => void
}

export function TaskItem({ task, done, onToggle }: TaskItemProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'group flex w-full min-h-touch items-start gap-3 rounded-xl px-3 py-3 text-left transition',
        'hover:bg-ink-raised/50 active:scale-[0.995]',
        done ? 'task-done' : '',
      ].join(' ')}
    >
      <span
        className={[
          'mt-0.5 flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-md border transition',
          done
            ? 'animate-check-pop border-sage bg-sage text-ink'
            : 'border-ink-border bg-transparent group-hover:border-cream/35',
        ].join(' ')}
        style={{ width: 22, height: 22 }}
      >
        {done && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="task-label flex-1 pt-0.5 text-[14.5px] leading-snug text-cream/88">
        {task.label}
      </span>
    </button>
  )
}
