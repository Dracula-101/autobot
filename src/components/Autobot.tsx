import { useEffect, useRef, useState } from 'react'
import type { Mood } from '@core/index.ts'

export type { Mood }

const CHEER_EVENT = 'autobot:cheer'

/** Make every visible Autobot celebrate (mission done, streak, etc.). */
export function cheer() {
  window.dispatchEvent(new Event(CHEER_EVENT))
  if ('vibrate' in navigator) navigator.vibrate?.(14)
}

interface Props {
  mood?: Mood
  size?: number
  /** Eyes follow the pointer */
  track?: boolean
  /** Hop and sparkle when cheer() fires */
  reactive?: boolean
  float?: boolean
  className?: string
  label?: string
}

const EYE_L = 47
const EYE_R = 73
const EYE_Y = 58

function star(cx: number, cy: number, r: number) {
  const k = r * 0.3
  return `M${cx} ${cy - r}L${cx + k} ${cy - k}L${cx + r} ${cy}L${cx + k} ${cy + k}L${cx} ${cy + r}L${cx - k} ${cy + k}L${cx - r} ${cy}L${cx - k} ${cy - k}Z`
}

function heart(cx: number, cy: number) {
  return `M${cx} ${cy + 6}C${cx - 9} ${cy} ${cx - 7} ${cy - 7} ${cx} ${cy - 3}C${cx + 7} ${cy - 7} ${cx + 9} ${cy} ${cx} ${cy + 6}Z`
}

function Eyes({ mood, blink }: { mood: Mood; blink: boolean }) {
  const eye = 'var(--bot-eye)'
  const arc = (cx: number) => (
    <path d={`M${cx - 6} ${EYE_Y + 3} q6 -9 12 0`} stroke={eye} strokeWidth={5} fill="none" strokeLinecap="round" />
  )
  const pill = (cx: number, h = 16, w = 10) => (
    <rect x={cx - w / 2} y={EYE_Y - h / 2} width={w} height={h} rx={w / 2} fill={eye} />
  )
  const blinkStyle = { transform: blink ? 'scaleY(0.12)' : 'scaleY(1)' }

  switch (mood) {
    case 'happy':
      return (
        <g>
          {arc(EYE_L)}
          {arc(EYE_R)}
        </g>
      )
    case 'proud':
      return (
        <g fill={eye}>
          <path d={star(EYE_L, EYE_Y, 8)} />
          <path d={star(EYE_R, EYE_Y, 8)} />
        </g>
      )
    case 'love':
      return (
        <g fill="var(--bot-cheek)">
          <path d={heart(EYE_L, EYE_Y)} />
          <path d={heart(EYE_R, EYE_Y)} />
        </g>
      )
    case 'sleepy':
      return (
        <g stroke={eye} strokeWidth={4.5} strokeLinecap="round" fill="none">
          <path d={`M${EYE_L - 6} ${EYE_Y} q6 4 12 0`} />
          <path d={`M${EYE_R - 6} ${EYE_Y} q6 4 12 0`} />
        </g>
      )
    case 'wink':
      return (
        <g>
          {arc(EYE_L)}
          <g className="bot-part" style={blinkStyle}>
            {pill(EYE_R)}
          </g>
        </g>
      )
    case 'focused':
      return (
        <g className="bot-part" style={blinkStyle}>
          {pill(EYE_L, 10, 12)}
          {pill(EYE_R, 10, 12)}
          <path d={`M${EYE_L - 7} ${EYE_Y - 11} l13 3 M${EYE_R + 7} ${EYE_Y - 11} l-13 3`} stroke={eye} strokeWidth={3} strokeLinecap="round" />
        </g>
      )
    case 'worried':
      return (
        <g>
          <g className="bot-part" style={blinkStyle}>
            {pill(EYE_L, 13)}
            {pill(EYE_R, 13)}
          </g>
          <path d={`M${EYE_L - 7} ${EYE_Y - 10} l12 -4 M${EYE_R + 7} ${EYE_Y - 10} l-12 -4`} stroke={eye} strokeWidth={3} strokeLinecap="round" />
        </g>
      )
    case 'thinking':
      return (
        <g className="bot-part" style={{ ...blinkStyle, translate: '3px -3px' }}>
          {pill(EYE_L, 14)}
          {pill(EYE_R, 14)}
        </g>
      )
    default:
      return (
        <g className="bot-part" style={blinkStyle}>
          {pill(EYE_L)}
          {pill(EYE_R)}
        </g>
      )
  }
}

function Mouth({ mood }: { mood: Mood }) {
  const common = { stroke: 'var(--bot-eye)', strokeWidth: 4, fill: 'none', strokeLinecap: 'round' as const }
  switch (mood) {
    case 'happy':
    case 'proud':
    case 'love':
      return <path d="M50 71 q10 10 20 0" {...common} />
    case 'wink':
      return <path d="M52 72 q8 7 16 0" {...common} />
    case 'worried':
      return <path d="M50 76 q5 -4 10 0 q5 4 10 0" {...common} strokeWidth={3.5} />
    case 'sleepy':
      return <path d="M55 75 q5 3 10 0" {...common} strokeWidth={3.5} />
    case 'thinking':
      return <circle cx={62} cy={75} r={3} fill="var(--bot-eye)" />
    case 'focused':
      return <path d="M53 75 h14" {...common} />
    default:
      return <path d="M52 73 q8 6 16 0" {...common} />
  }
}

export function Autobot({
  mood = 'idle',
  size = 64,
  track = false,
  reactive = false,
  float = true,
  className = '',
  label = 'Autobot',
}: Props) {
  const ref = useRef<SVGSVGElement>(null)
  const [blink, setBlink] = useState(false)
  const [look, setLook] = useState({ x: 0, y: 0 })
  const [celebrating, setCelebrating] = useState(false)
  const [hopKey, setHopKey] = useState(0)

  // Blink at human-ish random intervals.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const loop = () => {
      timer = setTimeout(
        () => {
          setBlink(true)
          setTimeout(() => setBlink(false), 130)
          loop()
        },
        2400 + Math.random() * 3600,
      )
    }
    loop()
    return () => clearTimeout(timer)
  }, [])

  // Eyes follow the pointer (and the last tap on touch screens).
  useEffect(() => {
    if (!track) return
    let frame = 0
    let reset: ReturnType<typeof setTimeout>
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const box = ref.current?.getBoundingClientRect()
        if (!box) return
        const dx = e.clientX - (box.left + box.width / 2)
        const dy = e.clientY - (box.top + box.height / 2)
        const dist = Math.hypot(dx, dy) || 1
        const reach = Math.min(1, dist / 260)
        setLook({ x: (dx / dist) * reach, y: (dy / dist) * reach })
      })
      if (e.pointerType !== 'mouse') {
        clearTimeout(reset)
        reset = setTimeout(() => setLook({ x: 0, y: 0 }), 1600)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerdown', onMove)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onMove)
      cancelAnimationFrame(frame)
      clearTimeout(reset)
    }
  }, [track])

  useEffect(() => {
    if (!reactive) return
    let t: ReturnType<typeof setTimeout>
    const onCheer = () => {
      setCelebrating(true)
      setHopKey((k) => k + 1)
      clearTimeout(t)
      t = setTimeout(() => setCelebrating(false), 1900)
    }
    window.addEventListener(CHEER_EVENT, onCheer)
    return () => {
      window.removeEventListener(CHEER_EVENT, onCheer)
      clearTimeout(t)
    }
  }, [reactive])

  const shown: Mood = celebrating ? 'proud' : mood
  const cheeks = shown === 'happy' || shown === 'proud' || shown === 'love' || shown === 'wink'

  return (
    <svg
      ref={ref}
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={['shrink-0 overflow-visible', className].join(' ')}
    >
      <g key={hopKey} className={celebrating ? 'bot-hop' : float ? 'bot-float' : undefined} style={{ transformOrigin: '60px 100px' }}>
        {/* antenna */}
        <line x1={60} y1={22} x2={60} y2={11} stroke="var(--bot-ear)" strokeWidth={4} strokeLinecap="round" />
        <circle cx={60} cy={9} r={9} fill="var(--bot-bulb)" opacity={0.18} className={shown === 'thinking' ? 'bulb-pulse' : undefined} />
        <circle cx={60} cy={9} r={5.5} fill="var(--bot-bulb)" className={shown === 'thinking' ? 'bulb-pulse' : undefined} />
        {/* ears */}
        <rect x={5} y={50} width={11} height={26} rx={5.5} fill="var(--bot-ear)" />
        <rect x={104} y={50} width={11} height={26} rx={5.5} fill="var(--bot-ear)" />
        {/* head + screen */}
        <rect x={13} y={21} width={94} height={82} rx={29} fill="var(--bot-shell)" stroke="var(--bot-line)" strokeWidth={4} />
        <rect x={24} y={33} width={72} height={57} rx={19} fill="var(--bot-screen)" />
        <path d="M31 40 q6 -4 16 -4" stroke="white" strokeOpacity={0.14} strokeWidth={4} strokeLinecap="round" fill="none" />
        <g style={{ transform: `translate(${look.x * 4}px, ${look.y * 3}px)`, transition: 'transform 0.25s ease-out' }}>
          <Eyes mood={shown} blink={blink} />
          <Mouth mood={shown} />
          {cheeks && (
            <g fill="var(--bot-cheek)" opacity={0.75}>
              <circle cx={35} cy={71} r={4.5} />
              <circle cx={85} cy={71} r={4.5} />
            </g>
          )}
        </g>
        {shown === 'worried' && <path d="M101 36 q5 8 0 11 q-5 -3 0 -11Z" fill="rgb(var(--sky))" opacity={0.85} />}
      </g>

      {shown === 'sleepy' && (
        <g fill="rgb(var(--ink-3))" fontFamily="Nunito, sans-serif" fontWeight={900}>
          <text x={98} y={30} fontSize={14} style={{ animation: 'zzz 2.4s ease-in infinite' }}>
            z
          </text>
          <text x={106} y={20} fontSize={10} style={{ animation: 'zzz 2.4s ease-in 1.2s infinite' }}>
            z
          </text>
        </g>
      )}
      {celebrating && (
        <g fill="rgb(var(--amber))">
          {[
            [8, 18, 6, 0],
            [110, 24, 7, 0.1],
            [102, 96, 5, 0.2],
            [14, 92, 5, 0.15],
            [60, -6, 5, 0.05],
          ].map(([x, y, r, d], i) => (
            <path
              key={i}
              d={star(x, y, r)}
              style={{ animation: `sparkle 0.9s ease-out ${d}s both`, transformBox: 'fill-box', transformOrigin: 'center' }}
            />
          ))}
        </g>
      )}
    </svg>
  )
}
