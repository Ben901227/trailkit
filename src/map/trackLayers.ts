import type { Feature, FeatureCollection, Position } from 'geojson'
import type { Map as MLMap, GeoJSONSource } from 'maplibre-gl'
import type { AppState } from '../model/types'
import { selectionKey } from '../model/types'
import { SRC_TRACKS, SRC_WAYPOINTS } from './mapView'

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
}

/** All positions of the visible content, for fit-to-view. */
export function visiblePositions(state: AppState): Position[] {
  const out: Position[] = []
  for (const doc of state.docs) {
    for (const t of doc.tracks) if (t.visible) out.push(...t.geometry.coordinates)
    for (const w of doc.waypoints) if (w.visible) out.push(w.geometry.coordinates)
    for (const o of doc.overlays) if (o.visible) out.push(...o.corners)
  }
  return out
}
