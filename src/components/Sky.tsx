import type { Phase } from '@core/index.ts'

// Deterministic star field (x%, y%, size px, delay s)
const STARS: [number, number, number, number][] = [
  [6, 12, 2, 0.2], [14, 40, 1.5, 1.4], [22, 18, 2.5, 0.8], [31, 56, 1.5, 2.1], [38, 9, 1.5, 0.3],
  [46, 30, 2, 1.7], [53, 62, 1.5, 0.9], [61, 14, 2, 2.4], [68, 44, 1.5, 0.5], [74, 24, 2.5, 1.1],
  [81, 58, 1.5, 1.9], [88, 34, 2, 0.6], [94, 12, 1.5, 2.2], [10, 70, 1.5, 1.3], [27, 78, 2, 0.4],
  [58, 80, 1.5, 1.6], [84, 76, 2, 2.6], [42, 48, 1, 0.7], [70, 68, 1, 1.5], [97, 50, 1.5, 0.1],
]

export function Sky({ phase, className = '' }: { phase: Phase; className?: string }) {
  const dark = phase === 'night' || phase === 'dusk'
  return (
    <div aria-hidden className={`pointer-events-none overflow-hidden ${className}`}>
      <div
        className="absolute inset-0 transition-[background] duration-1000"
        style={{ background: 'linear-gradient(180deg, var(--sky-top) 0%, var(--sky-mid) 55%, rgb(var(--bg)) 100%)' }}
      />
      {dark &&
        STARS.slice(0, phase === 'dusk' ? 8 : STARS.length).map(([x, y, s, d], i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${x}%`,
              top: `${y * 0.8}%`,
              width: s,
              height: s,
              animation: `twinkle ${3 + (i % 4)}s ease-in-out ${d}s infinite`,
            }}
          />
        ))}
      {phase === 'night' && (
        <div
          className="absolute right-[26%] top-3 h-9 w-9 rounded-full"
          style={{ boxShadow: 'inset -9px -5px 0 0 #f4f0dc', transform: 'rotate(-20deg)', filter: 'drop-shadow(0 0 14px rgb(244 240 220 / 0.35))' }}
        />
      )}
      {(phase === 'day' || phase === 'dawn') && (
        <>
          <div
            className="absolute right-[24%] top-2 h-12 w-12 rounded-full"
            style={{
              background: phase === 'dawn' ? '#ffd27a' : '#fff4c2',
              boxShadow: `0 0 60px 24px ${phase === 'dawn' ? 'rgb(255 170 110 / 0.55)' : 'rgb(255 244 194 / 0.7)'}`,
            }}
          />
          <Cloud className="left-[-8%] top-[22%] w-40 opacity-80" duration={48} />
          <Cloud className="left-[38%] top-[8%] w-28 opacity-60" duration={64} />
        </>
      )}
      {phase === 'dusk' && (
        <div
          className="absolute -bottom-10 right-[-10%] h-40 w-64 rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgb(255 150 100 / 0.45), transparent)' }}
        />
      )}
    </div>
  )
}

function Cloud({ className, duration }: { className: string; duration: number }) {
  return (
    <svg
      viewBox="0 0 120 50"
      className={`absolute ${className}`}
      style={{ animation: `drift ${duration}s ease-in-out infinite alternate` }}
    >
      <path d="M22 40 a14 14 0 0 1 4-27 a20 20 0 0 1 36-4 a16 16 0 0 1 30 10 a12 12 0 0 1 6 21 Z" fill="white" />
    </svg>
  )
}
