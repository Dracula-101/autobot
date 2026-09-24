interface ProgressRingProps {
  value: number
  max: number
  size?: number
  stroke?: number
  label?: string
  sublabel?: string
  color?: string
}

export function ProgressRing({
  value,
  max,
  size = 72,
  stroke = 6,
  label,
  sublabel,
  color = '#7dcea0',
}: ProgressRingProps) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = max <= 0 ? 0 : Math.min(value / max, 1)
  const offset = circ * (1 - pct)

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#2a2e38"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-sm font-semibold tabular-nums text-white">
            {value}
            <span className="text-ink-muted">/{max}</span>
          </span>
        </div>
      </div>
      {label && (
        <span className="text-center text-[11px] font-medium leading-tight text-white/60">
          {label}
        </span>
      )}
      {sublabel && (
        <span className="text-[10px] text-ink-muted">{sublabel}</span>
      )}
    </div>
  )
}
