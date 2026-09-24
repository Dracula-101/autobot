// Sunrise / sunset for Boulder so the app's sky follows the real one.
// Standard low-precision solar position formulas (good to about a minute).

import { instantOf, wallClock, TZ } from './time.ts'

export const BOULDER = { lat: 40.015, lng: -105.2705 }

const RAD = Math.PI / 180
const DAY_MS = 86_400_000
const J1970 = 2_440_588
const J2000 = 2_451_545
const OBLIQUITY = RAD * 23.4397
const J0 = 0.0009

const toDays = (ms: number) => ms / DAY_MS - 0.5 + J1970 - J2000
const fromJulian = (j: number) => (j + 0.5 - J1970) * DAY_MS

function solarMeanAnomaly(d: number) {
  return RAD * (357.5291 + 0.98560028 * d)
}

function eclipticLongitude(m: number) {
  const center = RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m))
  const perihelion = RAD * 102.9372
  return m + center + perihelion + Math.PI
}

export interface SunTimes {
  sunrise: Date
  sunset: Date
}

/** Sunrise and sunset on a calendar date (YYYY-MM-DD, Denver). */
export function sunTimes(date: string, lat = BOULDER.lat, lng = BOULDER.lng): SunTimes {
  const noon = instantOf(date, 12 * 60, TZ).getTime()
  const lw = RAD * -lng
  const phi = RAD * lat
  const d = toDays(noon)
  const n = Math.round(d - J0 - lw / (2 * Math.PI))
  const ds = J0 + lw / (2 * Math.PI) + n
  const m = solarMeanAnomaly(ds)
  const l = eclipticLongitude(m)
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(l))
  const transit = J2000 + ds + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l)
  const h0 = -0.833 * RAD
  const cosW = (Math.sin(h0) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec))
  const w = Math.acos(Math.min(1, Math.max(-1, cosW)))
  const set = J2000 + (J0 + (w + lw) / (2 * Math.PI) + n) + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l)
  const rise = transit - (set - transit)
  return { sunrise: new Date(fromJulian(rise)), sunset: new Date(fromJulian(set)) }
}

export type Phase = 'dawn' | 'day' | 'dusk' | 'night'

/** Where the sky is right now: drives the whole theme. */
export function skyPhase(at: Date = new Date()): Phase {
  const { sunrise, sunset } = sunTimes(wallClock(at).date)
  const t = at.getTime()
  const hour = 3_600_000
  if (t < sunrise.getTime() - 0.75 * hour) return 'night'
  if (t < sunrise.getTime() + hour) return 'dawn'
  if (t < sunset.getTime() - hour) return 'day'
  if (t < sunset.getTime() + 0.75 * hour) return 'dusk'
  return 'night'
}

export function isDarkPhase(phase: Phase): boolean {
  return phase === 'dusk' || phase === 'night'
}
