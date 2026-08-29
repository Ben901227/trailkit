import type { Feature, FeatureCollection, Geometry, LineString, Point, Position } from 'geojson'
import type { Track, Waypoint } from '../model/types'
import { colorForIndex, newId } from './ids'

export interface Normalized {
  tracks: Track[]
  waypoints: Waypoint[]
  /** Geometry types we do not model yet (polygons etc.), reported to the user. */
  skipped: string[]
}

function timesOf(f: Feature<Geometry | null>, count: number): (string | null)[] | undefined {
  const cp = (f.properties as Record<string, unknown> | null)?.['coordinateProperties'] as
    | { times?: unknown }
    | undefined
  const times = cp?.times
  if (!Array.isArray(times)) return undefined
  // togeojson nests times per segment for multi-segment tracks.
  const flat = (Array.isArray(times[0]) ? times.flat() : times) as unknown[]
  return Array.from({ length: count }, (_, i) => {
    const v = flat[i]
    return typeof v === 'string' ? v : null
  })
}

function nameOf(f: Feature<Geometry | null>, fallback: string): string {
  const p = f.properties as Record<string, unknown> | null
  const n = p?.['name']
  return typeof n === 'string' && n.trim() ? n.trim() : fallback
}

/** Properties we already model explicitly and should not duplicate into `extra`. */
const HANDLED = new Set(['name', 'desc', 'description', 'coordinateProperties'])

function extraOf(f: Feature<Geometry | null>): Record<string, unknown> | undefined {
  const p = f.properties as Record<string, unknown> | null
  if (!p) return undefined
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(p)) if (!HANDLED.has(k)) out[k] = v
  return Object.keys(out).length ? out : undefined
}

function makeTrack(coords: Position[], f: Feature<Geometry | null>, name: string, colorIndex: number): Track {
  const geometry: LineString = { type: 'LineString', coordinates: coords }
  const times = timesOf(f, coords.length)
  return {
    id: newId('trk'),
    name,
    color: colorForIndex(colorIndex),
    visible: true,
    geometry,
    props: times ? { times } : {},
    extra: extraOf(f),
  }
}

/** Turn a parsed FeatureCollection into our track/waypoint model. */
export function normalize(fc: FeatureCollection<Geometry | null>): Normalized {
  const tracks: Track[] = []
  const waypoints: Waypoint[] = []
  const skipped: string[] = []

  fc.features.forEach((f, i) => {
    const g = f.geometry
    if (!g) return
    // togeojson turns GroundOverlays into polygons; we model them as overlays instead.
    if (f.properties?.['@geometry-type'] === 'groundoverlay') return
    if (g.type === 'LineString') {
      tracks.push(makeTrack(g.coordinates, f, nameOf(f, `Track ${tracks.length + 1}`), tracks.length))
    } else if (g.type === 'MultiLineString') {
      const base = nameOf(f, `Track ${tracks.length + 1}`)
      g.coordinates.forEach((seg, si) => {
        const label = g.coordinates.length > 1 ? `${base} (${si + 1})` : base
        tracks.push(makeTrack(seg, f, label, tracks.length))
      })
    } else if (g.type === 'Point') {
      const p = f.properties as Record<string, unknown> | null
      const desc = p?.['desc'] ?? p?.['description']
      waypoints.push({
        id: newId('wpt'),
        name: nameOf(f, `Waypoint ${waypoints.length + 1}`),
        description: typeof desc === 'string' ? desc : undefined,
        visible: true,
        geometry: g as Point,
        extra: extraOf(f),
      })
    } else {
      skipped.push(`${g.type}${f.properties?.['name'] ? ` "${f.properties['name']}"` : ` #${i + 1}`}`)
    }
  })

  return { tracks, waypoints, skipped }
}
