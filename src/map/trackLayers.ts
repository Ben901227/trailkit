import type { Feature, FeatureCollection, Position } from 'geojson'
import type { Map as MLMap, GeoJSONSource } from 'maplibre-gl'
import type { AppState, Track } from '../model/types'
import { selectionKey } from '../model/types'
import { SRC_CORNERS, SRC_TRACKS, SRC_VERTICES, SRC_WAYPOINTS, WAYPOINT_LAYERS } from './mapView'

export function featureKey(kind: string, docId: string, id: string): string {
  return `${kind}:${docId}:${id}`
}

/**
 * Editing rebuilds this collection on every pointer move. Tracks are immutable,
 * so an untouched one can hand back the feature it produced last time instead
 * of rebuilding it — with a 100k-point track open beside the one being edited,
 * that is the difference between usable and not.
 */
const trackFeatures = new WeakMap<Track, Feature>()

function buildTracks(state: AppState): FeatureCollection {
  const features: Feature[] = []
  for (const doc of state.docs) {
    for (const track of doc.tracks) {
      if (!track.visible) continue
      let feature = trackFeatures.get(track)
      if (!feature) {
        feature = {
          type: 'Feature',
          geometry: track.geometry,
          properties: {
            key: featureKey('track', doc.id, track.id),
            color: track.color,
            name: track.name,
          },
        }
        trackFeatures.set(track, feature)
      }
      features.push(feature)
    }
  }
  return { type: 'FeatureCollection', features }
}

function buildWaypoints(state: AppState): FeatureCollection {
  const features: Feature[] = []
  for (const doc of state.docs) {
    for (const wpt of doc.waypoints) {
      if (!wpt.visible) continue
      features.push({
        type: 'Feature',
        geometry: wpt.geometry,
        properties: {
          key: featureKey('waypoint', doc.id, wpt.id),
          name: wpt.name,
        },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}

/** Push the current state into the map's sources. Cheap enough to run on every change. */
export function syncTrackLayers(map: MLMap, state: AppState): void {
  const tracks = map.getSource(SRC_TRACKS) as GeoJSONSource | undefined
  const waypoints = map.getSource(SRC_WAYPOINTS) as GeoJSONSource | undefined
  if (!tracks || !waypoints) return
  tracks.setData(buildTracks(state))
  waypoints.setData(buildWaypoints(state))

  const key = state.selection ? selectionKey(state.selection) : ''
  map.setFilter('track-selected', ['==', ['get', 'key'], key])
  map.setFilter('waypoint-selected', ['==', ['get', 'key'], key])

  for (const layer of WAYPOINT_LAYERS) {
    const on = state.showWaypoints && (layer !== 'waypoint-label' || state.showWaypointLabels)
    map.setLayoutProperty(layer, 'visibility', on ? 'visible' : 'none')
  }
}

/** All positions of the visible content, for fit-to-view. */
export function visiblePositions(state: AppState): Position[] {
  const out: Position[] = []
  for (const doc of state.docs) {
    for (const t of doc.tracks) if (t.visible) out.push(...t.geometry.coordinates)
    if (state.showWaypoints) {
      for (const w of doc.waypoints) if (w.visible) out.push(w.geometry.coordinates)
    }
    for (const o of doc.overlays) if (o.visible) out.push(...o.corners)
  }
  return out
}

/**
 * Above this many handles in view, editing is not what the user is doing —
 * they are looking at a whole trail. Drawing 100k draggable points wedges the
 * renderer, so past the cap we draw none and say so.
 */
const VERTEX_BUDGET = 3000

let suppressedVertices = 0

/** How many editable points the viewport is hiding, for the inspector to report. */
export function hiddenVertexCount(): number {
  return suppressedVertices
}

/** The editable points of the selected track, shown only in editing mode. */
export function syncVertexLayer(map: MLMap, state: AppState): void {
  const source = map.getSource(SRC_VERTICES) as GeoJSONSource | undefined
  if (!source) return

  const sel = state.selection
  const features: Feature[] = []
  suppressedVertices = 0

  if (state.editing && sel?.kind === 'track') {
    const track = state.docs.find((d) => d.id === sel.docId)?.tracks.find((t) => t.id === sel.id)
    const coords = track?.geometry.coordinates ?? []

    // Only points you could actually grab: the ones on screen, plus a margin
    // so a handle just off the edge can still be dragged into view.
    const b = map.getBounds()
    const padX = (b.getEast() - b.getWest()) * 0.25
    const padY = (b.getNorth() - b.getSouth()) * 0.25
    const west = b.getWest() - padX
    const east = b.getEast() + padX
    const south = b.getSouth() - padY
    const north = b.getNorth() + padY

    const inView: number[] = []
    for (let i = 0; i < coords.length; i++) {
      const c = coords[i] as Position
      const lng = c[0] as number
      const lat = c[1] as number
      if (lng >= west && lng <= east && lat >= south && lat <= north) inView.push(i)
      if (inView.length > VERTEX_BUDGET) break
    }

    if (inView.length > VERTEX_BUDGET) {
      suppressedVertices = coords.length
    } else {
      for (const index of inView) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: coords[index] as Position },
          properties: { index, active: index === state.vertex },
        })
      }
    }
  }

  source.setData({ type: 'FeatureCollection', features })
}

/** Corner handles and outline for the overlay being calibrated. */
export function syncCornerLayer(map: MLMap, state: AppState): void {
  const source = map.getSource(SRC_CORNERS) as GeoJSONSource | undefined
  if (!source) return

  const sel = state.selection
  const features: Feature[] = []
  if (state.editing && sel?.kind === 'overlay') {
    const overlay = state.docs
      .find((d) => d.id === sel.docId)
      ?.overlays.find((o) => o.id === sel.id)
    if (overlay) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [...overlay.corners, overlay.corners[0]!] },
        properties: {},
      })
      overlay.corners.forEach((corner, index) => {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: corner },
          properties: { index },
        })
      })
    }
  }
  source.setData({ type: 'FeatureCollection', features })
}
