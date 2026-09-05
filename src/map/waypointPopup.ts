import maplibregl, { type Map as MLMap } from 'maplibre-gl'
import type { AppState } from '../model/types'
import { elevationOf } from './elevation'
import { formatGrid, formatLngLat, toTWD97, twd97ToTWD67, zoneFor } from '../model/twd'

let popup: maplibregl.Popup | null = null

/** Popups carry file-supplied text, so build with the DOM, never innerHTML. */
function content(name: string, description: string | undefined, meta?: string): HTMLElement {
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
  if (meta) {
    const note = document.createElement('p')
    note.className = 'meta'
    note.textContent = meta
    box.append(note)
  }
  return box
}

function metres(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} m`
}

export function showWaypointPopup(map: MLMap, state: AppState, key: string, at: maplibregl.LngLatLike): void {
  const [, docId, id] = key.split(':')
  const wpt = state.docs.find((d) => d.id === docId)?.waypoints.find((w) => w.id === id)
  if (!wpt) return

  const ele = elevationOf(wpt.geometry.coordinates)

  popup?.remove()
  popup = new maplibregl.Popup({ closeButton: true, offset: 12, maxWidth: '260px' })
    .setLngLat(at)
    .setDOMContent(content(wpt.name, wpt.description, ele === null ? undefined : `高度 ${metres(ele)}`))
    .addTo(map)
}

export interface PointReading {
  /** Null when the file carried no height and the DEM could not be read. */
  elevation: number | null
  /** Where the height came from; terrain readings are interpolated, not surveyed. */
  source: 'file' | 'terrain'
  /** Track readings add the point's name, distance from the start and time. */
  detail?: string
}

function row(label: string, value: string): HTMLElement {
  const line = document.createElement('div')
  line.className = 'coord'
  const key = document.createElement('span')
  key.textContent = label
  const val = document.createElement('span')
  val.textContent = value
  line.append(key, val)
  return line
}

/**
 * What is at this spot: how high, and where in each of the three coordinate
 * systems Taiwanese trip reports quote. Coordinates always show — they need no
 * network and no elevation data behind them.
 */
export function showPointPopup(
  map: MLMap,
  at: maplibregl.LngLat,
  { elevation, source, detail }: PointReading,
): void {
  const zone = zoneFor(at.lng)
  const twd97 = toTWD97(at.lng, at.lat, zone)

  const title =
    elevation === null
      ? '此處座標'
      : source === 'file'
        ? `高度 ${metres(elevation)}`
        : `地形高度 約 ${metres(elevation)}`

  const box = content(title, undefined, source === 'file' ? detail : undefined)
  const grid = document.createElement('div')
  grid.className = 'coords'
  grid.append(
    row(`TWD97 ${zone}°`, formatGrid(twd97)),
    row('TWD67', formatGrid(twd97ToTWD67(twd97))),
    row('WGS84', formatLngLat(at.lng, at.lat)),
  )
  box.append(grid)

  if (source === 'terrain' && elevation !== null) {
    const note = document.createElement('p')
    note.className = 'meta'
    note.textContent = '高度來源：Terrarium DEM，非實測'
    box.append(note)
  }
  if (elevation === null) {
    const note = document.createElement('p')
    note.className = 'meta'
    note.textContent = '此處查不到高度資料'
    box.append(note)
  }

  popup?.remove()
  popup = new maplibregl.Popup({ closeButton: true, offset: 12, maxWidth: '280px' })
    .setLngLat(at)
    .setDOMContent(box)
    .addTo(map)
}

export function closeWaypointPopup(): void {
  popup?.remove()
  popup = null
}

/** Peaks carry no description; the label already holds name and height. */
export function showPeakPopup(
  map: MLMap,
  feature: maplibregl.MapGeoJSONFeature,
  at: maplibregl.LngLatLike,
): void {
  const name = feature.properties?.['name']
  const elevation = feature.properties?.['elevation']
  if (typeof name !== 'string') return
  popup?.remove()
  popup = new maplibregl.Popup({ closeButton: true, offset: 12, maxWidth: '240px' })
    .setLngLat(at)
    .setDOMContent(content(name, undefined, typeof elevation === 'number' ? `高程 ${elevation} m` : undefined))
    .addTo(map)
}
