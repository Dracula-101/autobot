type Mood = 'idle' | 'happy' | 'nudge' | 'sleep'

type Props = {
  mood?: Mood
  size?: number
  className?: string
}

/**
 * Prefab OpenMoji robot (1F916) — not a hand-drawn SVG.
 * https://openmoji.org/ — CC BY-SA 4.0
 */
export function AutobotMascot({ mood = 'idle', size = 40, className = '' }: Props) {
  const opacity = mood === 'sleep' ? 0.55 : 1
  const filter =
    mood === 'happy'
      ? 'saturate(1.15)'
      : mood === 'nudge'
        ? 'saturate(1.05) hue-rotate(-8deg)'
        : mood === 'sleep'
          ? 'grayscale(0.35)'
          : undefined

  return (
    <img
      src={`${import.meta.env.BASE_URL}mascot/robot-618.png`}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      className={['select-none object-contain', className].filter(Boolean).join(' ')}
      style={{ opacity, filter, imageRendering: 'auto' }}
    />
  )
}
