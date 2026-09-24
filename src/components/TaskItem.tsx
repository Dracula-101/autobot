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
        'hover:bg-ink-raised/60 active:scale-[0.995]',
        done ? 'task-done' : '',
      ].join(' ')}
    >
      <span
        className={[
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition',
          done
            ? 'animate-check-pop border-sage bg-sage text-ink'
            : 'border-ink-border bg-ink-soft group-hover:border-sage/50',
        ].join(' ')}
      >
        {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <span className="task-label flex-1 pt-0.5 text-[15px] leading-snug text-white/90">
        {task.label}
      </span>
    </button>
  )
}
