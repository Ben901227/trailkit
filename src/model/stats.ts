import type { Position } from 'geojson'
import type { Track } from './types'

const EARTH_RADIUS_M = 6371008.8

export function haversine(a: Position, b: Position): number {
  const [lng1 = 0, lat1 = 0] = a
  const [lng2 = 0, lat2 = 0] = b
  const toRad = Math.PI / 180
  const dLat = (lat2 - lat1) * toRad
  const dLng = (lng2 - lng1) * toRad
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)))
}

export interface TrackStats {
  points: number
  /** Metres. */
  distance: number
  ascent: number | null
  descent: number | null
  start: string | null
  end: string | null
}

/** Ignore elevation wobble below this many metres, or noise inflates the ascent. */
const ELEVATION_NOISE_M = 3

/**
 * Stats walk every point, and the panel asks for them on every render — which
 * during a drag is every frame. Tracks are immutable, so the answer for a given
 * one never changes; cache it against the object itself.
 */
const cache = new WeakMap<Track, TrackStats>()

export function trackStats(track: Track): TrackStats {
  const hit = cache.get(track)
  if (hit) return hit
  const result = computeTrackStats(track)
  cache.set(track, result)
  return result
}

function computeTrackStats(track: Track): TrackStats {
  const coords = track.geometry.coordinates
  let distance = 0
  for (let i = 1; i < coords.length; i++) {
    distance += haversine(coords[i - 1] as Position, coords[i] as Position)
  }

  let ascent: number | null = null
  let descent: number | null = null
  const withEle = coords.filter((c) => typeof c[2] === 'number')
  if (withEle.length > 1) {
    ascent = 0
    descent = 0
    let reference = withEle[0]![2] as number
    for (const c of withEle) {
      const ele = c[2] as number
      const delta = ele - reference
      if (Math.abs(delta) < ELEVATION_NOISE_M) continue
      if (delta > 0) ascent += delta
      else descent -= delta
      reference = ele
    }
  }

  const times = (track.props.times ?? []).filter((t): t is string => !!t)

  return {
    points: coords.length,
    distance,
    ascent,
    descent,
    start: times[0] ?? null,
    end: times[times.length - 1] ?? null,
  }
}

export function formatDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(2)} km` : `${Math.round(metres)} m`
}

export function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

/** Bounding box [west, south, east, north] over any set of positions. */
export function bounds(positions: Position[]): [number, number, number, number] | null {
  if (!positions.length) return null
  let w = Infinity
  let s = Infinity
  let e = -Infinity
  let n = -Infinity
  for (const [lng = 0, lat = 0] of positions) {
    if (lng < w) w = lng
    if (lng > e) e = lng
    if (lat < s) s = lat
    if (lat > n) n = lat
  }
  return [w, s, e, n]
}
