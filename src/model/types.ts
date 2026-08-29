import type { LineString, Point } from 'geojson'

/** Format a document was read from. Kept so export can round-trip faithfully. */
export type SourceFormat = 'gpx' | 'kml' | 'kmz' | 'geojson'

/** Per-point data GPX/KML carry alongside coordinates (elevation lives in the coord). */
export interface PointProps {
  /** ISO timestamps, index-aligned with the coordinates. Sparse arrays allowed. */
  times?: (string | null)[]
}

export interface Track {
  id: string
  name: string
  /** Colour used on the map, `#rrggbb`. */
  color: string
  visible: boolean
  geometry: LineString
  props: PointProps
  /** Unrecognised tags from the source file, re-emitted on export where possible. */
  extra?: Record<string, unknown>
}

export interface Waypoint {
  id: string
  name: string
  description?: string
  visible: boolean
  geometry: Point
  extra?: Record<string, unknown>
}

/** A georeferenced image pinned to the map (KML GroundOverlay, or user-supplied). */
export interface Overlay {
  id: string
  name: string
  visible: boolean
  opacity: number
  /** Corners in clockwise order from top-left: [nw, ne, se, sw]. */
  corners: [number, number][]
  /** Object URL for display. */
  url: string
  /** Original bytes, so the image can be repacked into a KMZ on export. */
  blob?: Blob
}

/** One opened file. */
export interface Doc {
  id: string
  name: string
  sourceFormat: SourceFormat
  tracks: Track[]
  waypoints: Waypoint[]
  overlays: Overlay[]
}

export type Selection =
  | { kind: 'track'; docId: string; id: string }
  | { kind: 'waypoint'; docId: string; id: string }
  | { kind: 'overlay'; docId: string; id: string }

export interface AppState {
  docs: Doc[]
  selection: Selection | null
  basemapId: string
}

export function selectionKey(s: Selection): string {
  return `${s.kind}:${s.docId}:${s.id}`
}

export function findTrack(state: AppState, docId: string, id: string): Track | undefined {
  return state.docs.find((d) => d.id === docId)?.tracks.find((t) => t.id === id)
}

export function findWaypoint(state: AppState, docId: string, id: string): Waypoint | undefined {
  return state.docs.find((d) => d.id === docId)?.waypoints.find((w) => w.id === id)
}

export function findOverlay(state: AppState, docId: string, id: string): Overlay | undefined {
  return state.docs.find((d) => d.id === docId)?.overlays.find((o) => o.id === id)
}
