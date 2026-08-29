import type { Map as MLMap } from 'maplibre-gl'
import type { AppState, TileLayer } from '../model/types'

const sourceId = (docId: string, id: string) => `tile_src_${docId}_${id}`
const layerId = (docId: string, id: string) => `tile_lyr_${docId}_${id}`

/** Scheme is baked into the source, so a TMS flip needs the source rebuilt. */
function signatureOf(layer: TileLayer): string {
  return `${layer.url}|${layer.tms}|${layer.minzoom}|${layer.maxzoom}`
}

const signatures = new Map<string, string>()

function addLayer(map: MLMap, docId: string, layer: TileLayer): void {
  const srcId = sourceId(docId, layer.id)
  map.addSource(srcId, {
    type: 'raster',
    tiles: [layer.url],
    tileSize: 256,
    minzoom: layer.minzoom,
    maxzoom: layer.maxzoom,
    scheme: layer.tms ? 'tms' : 'xyz',
    ...(layer.bounds ? { bounds: layer.bounds } : {}),
  })
  map.addLayer(
    {
      id: layerId(docId, layer.id),
      type: 'raster',
      source: srcId,
      paint: { 'raster-opacity': layer.opacity },
    },
    // Above the basemap, below the routes.
    'track-casing',
  )
  signatures.set(srcId, signatureOf(layer))
}

function removeLayer(map: MLMap, srcId: string): void {
  const lyrId = srcId.replace('tile_src_', 'tile_lyr_')
  if (map.getLayer(lyrId)) map.removeLayer(lyrId)
  if (map.getSource(srcId)) map.removeSource(srcId)
  signatures.delete(srcId)
}

export function syncTileLayers(map: MLMap, state: AppState): void {
  const wanted = new Map<string, { docId: string; layer: TileLayer }>()
  for (const doc of state.docs) {
    for (const layer of doc.tiles) wanted.set(sourceId(doc.id, layer.id), { docId: doc.id, layer })
  }

  for (const id of Object.keys(map.getStyle()?.sources ?? {})) {
    if (id.startsWith('tile_src_') && !wanted.has(id)) removeLayer(map, id)
  }

  for (const [srcId, { docId, layer }] of wanted) {
    if (!map.getSource(srcId)) {
      addLayer(map, docId, layer)
    } else if (signatures.get(srcId) !== signatureOf(layer)) {
      removeLayer(map, srcId)
      addLayer(map, docId, layer)
    }
    const lyrId = layerId(docId, layer.id)
    map.setPaintProperty(lyrId, 'raster-opacity', layer.opacity)
    map.setLayoutProperty(lyrId, 'visibility', layer.visible ? 'visible' : 'none')
  }
}
