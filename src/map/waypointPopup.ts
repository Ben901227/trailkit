import maplibregl, { type Map as MLMap } from 'maplibre-gl'
import type { AppState } from '../model/types'

let popup: maplibregl.Popup | null = null

/** Popups carry file-supplied text, so build with the DOM, never innerHTML. */
function content(name: string, description: string | undefined): HTMLElement {
  const box = document.createElement('div')
  box.className = 'wpt-popup'
  const title = document.createElement('strong')
  title.textContent = name
  box.append(title)
  if (description) {
    const body = document.createElement('p')
    body.textContent = description
    box.append(body)
  }
  return box
}

export function showWaypointPopup(map: MLMap, state: AppState, key: string, at: maplibregl.LngLatLike): void {
  const [, docId, id] = key.split(':')
  const wpt = state.docs.find((d) => d.id === docId)?.waypoints.find((w) => w.id === id)
  if (!wpt) return

  popup?.remove()
  popup = new maplibregl.Popup({ closeButton: true, offset: 12, maxWidth: '260px' })
    .setLngLat(at)
    .setDOMContent(content(wpt.name, wpt.description))
    .addTo(map)
}

export function closeWaypointPopup(): void {
  popup?.remove()
  popup = null
}
