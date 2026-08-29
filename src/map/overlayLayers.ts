import type { Map as MLMap, ImageSource } from 'maplibre-gl'
import type { AppState, Overlay } from '../model/types'

const sourceId = (docId: string, id: string) => `ovl_src_${docId}_${id}`
const layerId = (docId: string, id: string) => `ovl_lyr_${docId}_${id}`

/** MapLibre wants [tl, tr, br, bl]; our model stores the same order. */
function coordsOf(o: Overlay): [[number, number], [number, number], [number, number], [number, number]] {
  const [nw, ne, se, sw] = o.corners
  return [nw as [number, number], ne as [number, number], se as [number, number], sw as [number, number]]
}

/** Add/update/remove one image source+layer per overlay to match state. */
export function syncOverlayLayers(map: MLMap, state: AppState): void {
  const wanted = new Map<string, { docId: string; overlay: Overlay }>()
  for (const doc of state.docs) {
    for (const overlay of doc.overlays) wanted.set(sourceId(doc.id, overlay.id), { docId: doc.id, overlay })
  }

  // Remove overlays that are gone.
  for (const id of Object.keys(map.getStyle().sources)) {
    if (!id.startsWith('ovl_src_') || wanted.has(id)) continue
    const layer = id.replace('ovl_src_', 'ovl_lyr_')
    if (map.getLayer(layer)) map.removeLayer(layer)
    map.removeSource(id)
  }

  for (const [srcId, { docId, overlay }] of wanted) {
    const lyrId = layerId(docId, overlay.id)
    const existing = map.getSource(srcId) as ImageSource | undefined
    if (!existing) {
      map.addSource(srcId, { type: 'image', url: overlay.url, coordinates: coordsOf(overlay) })
      // Sit above the basemap but below tracks, so routes stay readable.
      map.addLayer(
        { id: lyrId, type: 'raster', source: srcId, paint: { 'raster-opacity': overlay.opacity } },
        'track-casing',
      )
    } else {
      existing.setCoordinates(coordsOf(overlay))
      map.setPaintProperty(lyrId, 'raster-opacity', overlay.opacity)
    }
    map.setLayoutProperty(lyrId, 'visibility', overlay.visible ? 'visible' : 'none')
  }
}
