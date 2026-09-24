type Mood = 'idle' | 'happy' | 'nudge' | 'sleep'

type Props = {
  mood?: Mood
  size?: number
  className?: string
}

/**
 * Soft inline SVG caretaker bot — warm, refined, not childish spam.
 */
export function AutobotMascot({ mood = 'idle', size = 40, className = '' }: Props) {
  const eyeY = mood === 'sleep' ? 14 : 13
  const eyeOpen = mood !== 'sleep'
  const smile =
    mood === 'happy'
      ? 'M12 18.2c1.2 1.4 2.8 2.1 4 2.1s2.8-.7 4-2.1'
      : mood === 'nudge'
        ? 'M13 18.5c.8.9 1.8 1.4 3 1.4s2.2-.5 3-1.4'
        : mood === 'sleep'
          ? 'M13.5 18.8h5'
          : 'M12.5 18c1 1.1 2.4 1.7 3.5 1.7s2.5-.6 3.5-1.7'
  const antennaTip =
    mood === 'nudge' ? '#e8b86d' : mood === 'happy' ? '#7dcea0' : '#9aa3b2'
  const blush = mood === 'happy' || mood === 'nudge'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      role="img"
    >
      {/* Antenna */}
      <line x1="16" y1="5.5" x2="16" y2="8.5" stroke="#3a3f4a" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="16" cy="4.2" r="1.6" fill={antennaTip} opacity={mood === 'sleep' ? 0.45 : 1} />

      {/* Soft body / head */}
      <rect
        x="6"
        y="8"
        width="20"
        height="18"
        rx="9"
        fill="#1a1d24"
        stroke="#2a2e38"
        strokeWidth="1.2"
      />
      {/* Face plate */}
      <rect x="9" y="11" width="14" height="11" rx="5.5" fill="#12141a" />

      {/* Eyes */}
      {eyeOpen ? (
        <>
          <circle cx="13" cy={eyeY} r={mood === 'nudge' ? 1.55 : 1.35} fill="#e8ecef" />
          <circle cx="19" cy={eyeY} r={mood === 'nudge' ? 1.55 : 1.35} fill="#e8ecef" />
          <circle cx="13.35" cy={eyeY - 0.25} r="0.45" fill="#0c0d10" />
          <circle cx="19.35" cy={eyeY - 0.25} r="0.45" fill="#0c0d10" />
        </>
      ) : (
        <>
          <path d="M11.5 14h3" stroke="#e8ecef" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M17.5 14h3" stroke="#e8ecef" strokeWidth="1.2" strokeLinecap="round" />
        </>
      )}

      {/* Gentle smile */}
      <path d={smile} stroke="#7dcea0" strokeWidth="1.35" strokeLinecap="round" fill="none" />

      {/* Soft blush */}
      {blush && (
        <>
          <circle cx="10.2" cy="16.5" r="1.1" fill="#c97b84" opacity="0.35" />
          <circle cx="21.8" cy="16.5" r="1.1" fill="#c97b84" opacity="0.35" />
        </>
      )}

      {/* Tiny chest light */}
      <circle
        cx="16"
        cy="24.2"
        r="1.1"
        fill={mood === 'sleep' ? '#3a3f4a' : '#7dcea0'}
        opacity={mood === 'sleep' ? 0.5 : 0.85}
      />
    </svg>
  )
}
