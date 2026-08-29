import type { Feature, FeatureCollection, Position } from 'geojson'
import type { Map as MLMap, GeoJSONSource } from 'maplibre-gl'
import type { AppState } from '../model/types'
import { selectionKey } from '../model/types'
import { SRC_CORNERS, SRC_TRACKS, SRC_VERTICES, SRC_WAYPOINTS, WAYPOINT_LAYERS } from './mapView'

export function featureKey(kind: string, docId: string, id: string): string {
  return `${kind}:${docId}:${id}`
}

function buildTracks(state: AppState): FeatureCollection {
  const features: Feature[] = []
  for (const doc of state.docs) {
    for (const track of doc.tracks) {
      if (!track.visible) continue
      features.push({
        type: 'Feature',
        geometry: track.geometry,
        properties: {
          key: featureKey('track', doc.id, track.id),
          color: track.color,
          name: track.name,
        },
      })
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

/** The editable points of the selected track, shown only in editing mode. */
export function syncVertexLayer(map: MLMap, state: AppState): void {
  const source = map.getSource(SRC_VERTICES) as GeoJSONSource | undefined
  if (!source) return

  const sel = state.selection
  const features: Feature[] = []
  if (state.editing && sel?.kind === 'track') {
    const track = state.docs.find((d) => d.id === sel.docId)?.tracks.find((t) => t.id === sel.id)
    for (const [index, coord] of (track?.geometry.coordinates ?? []).entries()) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coord },
        properties: { index, active: index === state.vertex },
      })
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
