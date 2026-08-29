import type { Position } from 'geojson'
import { newId } from '../io/ids'
import type { Doc, Track, Waypoint } from './types'

/**
 * Pure operations over the document list. Each returns a new array, sharing
 * everything it did not touch, so the history stack can snapshot cheaply.
 */

function mapTrack(
  docs: Doc[],
  docId: string,
  trackId: string,
  fn: (t: Track) => Track | Track[] | null,
): Doc[] {
  return docs.map((doc) => {
    if (doc.id !== docId) return doc
    const tracks: Track[] = []
    let changed = false
    for (const track of doc.tracks) {
      if (track.id !== trackId) {
        tracks.push(track)
        continue
      }
      changed = true
      const result = fn(track)
      if (result === null) continue
      if (Array.isArray(result)) tracks.push(...result)
      else tracks.push(result)
    }
    return changed ? { ...doc, tracks } : doc
  })
}

function withTimes(track: Track, times: (string | null)[] | undefined): Track['props'] {
  return times && times.some((t) => t !== null) ? { ...track.props, times } : {}
}

/** Elevation is kept: only the horizontal position moves. */
export function movePoint(
  docs: Doc[],
  docId: string,
  trackId: string,
  index: number,
  to: [number, number],
): Doc[] {
  return mapTrack(docs, docId, trackId, (track) => {
    const coords = track.geometry.coordinates.slice()
    const current = coords[index]
    if (!current) return track
    const ele = current[2]
    coords[index] = ele === undefined ? [to[0], to[1]] : [to[0], to[1], ele]
    return { ...track, geometry: { ...track.geometry, coordinates: coords } }
  })
}

/** Insert between `index` and `index + 1`. The new point has no time of its own. */
export function insertPoint(
  docs: Doc[],
  docId: string,
  trackId: string,
  index: number,
  position: [number, number],
): Doc[] {
  return mapTrack(docs, docId, trackId, (track) => {
    const coords = track.geometry.coordinates.slice()
    coords.splice(index + 1, 0, position as Position)
    const times = track.props.times?.slice()
    times?.splice(index + 1, 0, null)
    return {
      ...track,
      geometry: { ...track.geometry, coordinates: coords },
      props: withTimes(track, times),
    }
  })
}

/** Removes the given indices. A track left with fewer than two points is dropped. */
export function deletePoints(
  docs: Doc[],
  docId: string,
  trackId: string,
  indices: number[],
): Doc[] {
  const drop = new Set(indices)
  return mapTrack(docs, docId, trackId, (track) => {
    const coords = track.geometry.coordinates.filter((_, i) => !drop.has(i))
    if (coords.length < 2) return null
    const times = track.props.times?.filter((_, i) => !drop.has(i))
    return {
      ...track,
      geometry: { ...track.geometry, coordinates: coords },
      props: withTimes(track, times),
    }
  })
}

/** Keep only points `from..to` inclusive. */
export function trimTrack(
  docs: Doc[],
  docId: string,
  trackId: string,
  from: number,
  to: number,
): Doc[] {
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  return mapTrack(docs, docId, trackId, (track) => {
    const coords = track.geometry.coordinates.slice(lo, hi + 1)
    if (coords.length < 2) return track
    const times = track.props.times?.slice(lo, hi + 1)
    return {
      ...track,
      geometry: { ...track.geometry, coordinates: coords },
      props: withTimes(track, times),
    }
  })
}

/** Split at `index`; the point itself belongs to both halves so neither has a gap. */
export function splitTrack(docs: Doc[], docId: string, trackId: string, index: number): Doc[] {
  return mapTrack(docs, docId, trackId, (track) => {
    const coords = track.geometry.coordinates
    if (index <= 0 || index >= coords.length - 1) return track
    const half = (from: number, to: number, suffix: string): Track => ({
      ...track,
      id: newId('trk'),
      name: `${track.name} ${suffix}`,
      geometry: { ...track.geometry, coordinates: coords.slice(from, to) },
      props: withTimes(track, track.props.times?.slice(from, to)),
    })
    return [half(0, index + 1, '(1)'), half(index, coords.length, '(2)')]
  })
}

export function reverseTrack(docs: Doc[], docId: string, trackId: string): Doc[] {
  return mapTrack(docs, docId, trackId, (track) => ({
    ...track,
    geometry: { ...track.geometry, coordinates: track.geometry.coordinates.slice().reverse() },
    // Times belong to positions along the route, so they reverse with them.
    props: withTimes(track, track.props.times?.slice().reverse()),
  }))
}

export function renameTrack(docs: Doc[], docId: string, trackId: string, name: string): Doc[] {
  return mapTrack(docs, docId, trackId, (track) => ({ ...track, name }))
}

export function deleteTrack(docs: Doc[], docId: string, trackId: string): Doc[] {
  return mapTrack(docs, docId, trackId, () => null)
}

/* ---------- waypoints ---------- */

function mapDoc(docs: Doc[], docId: string, fn: (d: Doc) => Doc): Doc[] {
  return docs.map((d) => (d.id === docId ? fn(d) : d))
}

export function addWaypoint(docs: Doc[], docId: string, position: [number, number], name: string): Doc[] {
  return mapDoc(docs, docId, (doc) => ({
    ...doc,
    waypoints: [
      ...doc.waypoints,
      {
        id: newId('wpt'),
        name,
        visible: true,
        geometry: { type: 'Point', coordinates: position },
      },
    ],
  }))
}

export function updateWaypoint(
  docs: Doc[],
  docId: string,
  id: string,
  patch: Partial<Pick<Waypoint, 'name' | 'description'>> & { position?: [number, number] },
): Doc[] {
  return mapDoc(docs, docId, (doc) => ({
    ...doc,
    waypoints: doc.waypoints.map((w) => {
      if (w.id !== id) return w
      const next: Waypoint = { ...w }
      if (patch.name !== undefined) next.name = patch.name
      if (patch.description !== undefined) next.description = patch.description
      if (patch.position) {
        const ele = w.geometry.coordinates[2]
        next.geometry = {
          ...w.geometry,
          coordinates: ele === undefined ? patch.position : [...patch.position, ele],
        }
      }
      return next
    }),
  }))
}

export function deleteWaypoint(docs: Doc[], docId: string, id: string): Doc[] {
  return mapDoc(docs, docId, (doc) => ({
    ...doc,
    waypoints: doc.waypoints.filter((w) => w.id !== id),
  }))
}
