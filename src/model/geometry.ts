import type { Position } from 'geojson'
import { haversine } from './stats'

export interface NearestSegment {
  /** Index of the segment's first point. */
  index: number
  /** Point on the segment closest to the query, in lng/lat. */
  position: [number, number]
  /** Metres from the query point. */
  distance: number
}

/**
 * Closest point on a polyline. Works in a locally flat projection: longitudes
 * are scaled by cos(lat) so the projection stays near-conformal over the short
 * spans this is used for.
 */
export function nearestOnLine(coords: Position[], query: [number, number]): NearestSegment | null {
  if (coords.length < 2) return null
  const latScale = Math.cos((query[1] * Math.PI) / 180) || 1
  const px = query[0] * latScale
  const py = query[1]

  let best: NearestSegment | null = null
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i]!
    const b = coords[i + 1]!
    const ax = (a[0] ?? 0) * latScale
    const ay = a[1] ?? 0
    const bx = (b[0] ?? 0) * latScale
    const by = b[1] ?? 0
    const dx = bx - ax
    const dy = by - ay
    const lenSq = dx * dx + dy * dy
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
    const position: [number, number] = [(ax + dx * t) / latScale, ay + dy * t]
    const distance = haversine(query, position)
    if (!best || distance < best.distance) best = { index: i, position, distance }
  }
  return best
}

/** Index of the polyline point nearest the query, or null for an empty line. */
export function nearestVertex(coords: Position[], query: [number, number]): number | null {
  let best: number | null = null
  let bestDistance = Infinity
  coords.forEach((c, i) => {
    const d = haversine(query, c)
    if (d < bestDistance) {
      bestDistance = d
      best = i
    }
  })
  return best
}
