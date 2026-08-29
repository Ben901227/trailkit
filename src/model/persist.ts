import type { AppState, TileLayer } from './types'
import { update } from './store'

const KEY = 'gpx-editor:layers:v1'

interface Saved {
  basemapId: string
  customBasemapUrl: string | null
  layers: TileLayer[]
  showWaypoints?: boolean
  showWaypointLabels?: boolean
}

/**
 * Only the layer stack and basemap are remembered. Opened files are not:
 * they can be large, and restoring them without the user asking would be a
 * surprise — that is a separate "restore session" feature.
 */
export function saveLayerPreferences(state: AppState): void {
  const payload: Saved = {
    basemapId: state.basemapId,
    customBasemapUrl: state.customBasemapUrl,
    layers: state.layers,
    showWaypoints: state.showWaypoints,
    showWaypointLabels: state.showWaypointLabels,
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // Private mode or a full quota; preferences simply do not persist.
  }
}

export function loadLayerPreferences(): void {
  let saved: Saved | null = null
  try {
    const raw = localStorage.getItem(KEY)
    saved = raw ? (JSON.parse(raw) as Saved) : null
  } catch {
    saved = null
  }
  if (!saved) return

  const layers = Array.isArray(saved.layers)
    ? saved.layers.filter((l): l is TileLayer => typeof l?.url === 'string' && typeof l?.id === 'string')
    : []

  update((s) => ({
    ...s,
    basemapId: typeof saved.basemapId === 'string' ? saved.basemapId : s.basemapId,
    customBasemapUrl: saved.customBasemapUrl ?? null,
    layers,
    showWaypoints: saved.showWaypoints ?? s.showWaypoints,
    showWaypointLabels: saved.showWaypointLabels ?? s.showWaypointLabels,
  }))
}
