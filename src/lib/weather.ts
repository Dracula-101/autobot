import { useEffect, useState } from 'react'

// Open-Meteo: free, no key. Boulder, CO.
const ENDPOINT =
  'https://api.open-meteo.com/v1/forecast?latitude=40.015&longitude=-105.2705&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit&timezone=America%2FDenver'
const KEY = 'autobot:weather'
const FRESH_MS = 30 * 60_000

export interface Weather {
  tempF: number
  code: number
  at: number
}

function cached(): Weather | null {
  try {
    const w = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Weather | null
    return w && Date.now() - w.at < 3 * FRESH_MS ? w : null
  } catch {
    return null
  }
}

export function useWeather(): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(cached)
  useEffect(() => {
    if (weather && Date.now() - weather.at < FRESH_MS) return
    const ctrl = new AbortController()
    fetch(ENDPOINT, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { current?: { temperature_2m: number; weather_code: number } } | null) => {
        if (!d?.current) return
        const next = { tempF: Math.round(d.current.temperature_2m), code: d.current.weather_code, at: Date.now() }
        setWeather(next)
        try {
          localStorage.setItem(KEY, JSON.stringify(next))
        } catch {
          // ignore
        }
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, []) // once per mount; the cache keeps it cheap
  return weather
}

export function describeWeather(code: number): { label: string; kind: 'clear' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm' } {
  if (code === 0) return { label: 'Clear', kind: 'clear' }
  if (code <= 2) return { label: 'Mostly clear', kind: 'clear' }
  if (code === 3) return { label: 'Cloudy', kind: 'cloud' }
  if (code === 45 || code === 48) return { label: 'Fog', kind: 'fog' }
  if (code >= 51 && code <= 67) return { label: code >= 61 ? 'Rain' : 'Drizzle', kind: 'rain' }
  if (code >= 71 && code <= 77) return { label: 'Snow', kind: 'snow' }
  if (code >= 80 && code <= 82) return { label: 'Showers', kind: 'rain' }
  if (code === 85 || code === 86) return { label: 'Snow showers', kind: 'snow' }
  if (code >= 95) return { label: 'Thunderstorm', kind: 'storm' }
  return { label: 'Weather', kind: 'cloud' }
}
