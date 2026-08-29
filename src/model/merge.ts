import type { Position } from 'geojson'
import { newId } from '../io/ids'
import { haversine } from './stats'
import type { Doc, Track } from './types'

export interface TrackRef {
  docId: string
  trackId: string
  /** Walk this track backwards when joining. */
  reversed: boolean
}

function find(docs: Doc[], ref: TrackRef): Track | undefined {
  return docs.find((d) => d.id === ref.docId)?.tracks.find((t) => t.id === ref.trackId)
}

/** The chosen tracks, in the chosen order, with reversals applied. */
export function resolveRefs(docs: Doc[], refs: TrackRef[]): Track[] {
  const out: Track[] = []
  for (const ref of refs) {
    const track = find(docs, ref)
    if (!track) continue
    if (!ref.reversed) {
      out.push(track)
      continue
    }
    out.push({
      ...track,
      geometry: { ...track.geometry, coordinates: track.geometry.coordinates.slice().reverse() },
      props: track.props.times ? { times: track.props.times.slice().reverse() } : {},
    })
  }
  return out
}

/** Distance in metres between the end of each track and the start of the next. */
export function joinGaps(tracks: Track[]): number[] {
  const gaps: number[] = []
  for (let i = 1; i < tracks.length; i++) {
    const end = tracks[i - 1]!.geometry.coordinates.at(-1)
    const start = tracks[i]!.geometry.coordinates[0]
    gaps.push(end && start ? haversine(end, start) : 0)
  }
  return gaps
}

function emptyDoc(name: string): Doc {
  return {
    id: newId('doc'),
    name,
    sourceFormat: 'gpx',
    tracks: [],
    waypoints: [],
    overlays: [],
  }
}

/** Gather the chosen tracks into one new document, each staying separate. */
export function mergeIntoDoc(docs: Doc[], refs: TrackRef[], name: string): Doc[] {
  const tracks = resolveRefs(docs, refs).map((t) => ({ ...t, id: newId('trk') }))
  if (!tracks.length) return docs
  return [...docs, { ...emptyDoc(name), tracks }]
}

/** Two positions are the same point if they are within this many metres. */
const SEAM_TOLERANCE_M = 0.5

/** Join the chosen tracks end to end into a single track. */
export function concatIntoDoc(docs: Doc[], refs: TrackRef[], name: string): Doc[] {
  const tracks = resolveRefs(docs, refs)
  if (tracks.length < 2) return docs

  const coordinates: Position[] = []
  const times: (string | null)[] = []
  // Only carry timestamps if at least one source track had them.
  const anyTimes = tracks.some((t) => t.props.times?.some(Boolean))

  for (const track of tracks) {
    const coords = track.geometry.coordinates
    const trackTimes = track.props.times ?? []
    let from = 0
    const previous = coordinates.at(-1)
    if (previous && coords[0] && haversine(previous, coords[0]) < SEAM_TOLERANCE_M) {
      // The seam repeats a point; keep only one of them.
      from = 1
    }
    for (let i = from; i < coords.length; i++) {
      coordinates.push(coords[i] as Position)
      if (anyTimes) times.push(trackTimes[i] ?? null)
    }
  }

  const first = tracks[0] as Track
  const joined: Track = {
    id: newId('trk'),
    name,
    color: first.color,
    visible: true,
    geometry: { type: 'LineString', coordinates },
    props: anyTimes ? { times } : {},
  }
  return [...docs, { ...emptyDoc(name), tracks: [joined] }]
}
