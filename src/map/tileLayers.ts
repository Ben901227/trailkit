import type { Map as MLMap } from 'maplibre-gl'
import type { AppState, TileLayer } from '../model/types'

const safe = (id: string) => id.replace(/[^A-Za-z0-9_]/g, '_')
const sourceId = (id: string) => `tile_src_${safe(id)}`
const layerId = (id: string) => `tile_lyr_${safe(id)}`

/** Scheme is baked into the source, so a TMS flip needs the source rebuilt. */
function signatureOf(layer: TileLayer): string {
  return `${layer.url}|${layer.tms}|${layer.minzoom}|${layer.maxzoom}`
}

const signatures = new Map<string, string>()

function addLayer(map: MLMap, layer: TileLayer, before: string): void {
  const srcId = sourceId(layer.id)
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
      id: layerId(layer.id),
      type: 'raster',
      source: srcId,
      paint: { 'raster-opacity': layer.opacity },
    },
    before,
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
  const wanted = new Map(state.layers.map((layer) => [sourceId(layer.id), layer]))

  for (const id of Object.keys(map.getStyle()?.sources ?? {})) {
    if (id.startsWith('tile_src_') && !wanted.has(id)) removeLayer(map, id)
  }

  // Walk the stack from the top down, inserting each layer before the one
  // above it. That reproduces the panel's order without touching every layer.
  let above = 'track-casing'
  for (let i = state.layers.length - 1; i >= 0; i--) {
    const layer = state.layers[i] as TileLayer
    const srcId = sourceId(layer.id)
    const lyrId = layerId(layer.id)
    const stale = map.getSource(srcId) && signatures.get(srcId) !== signatureOf(layer)
    if (stale) removeLayer(map, srcId)
    if (!map.getSource(srcId)) {
      addLayer(map, layer, above)
    } else if (orderOf(map, lyrId) > orderOf(map, above)) {
      // Out of order after a move: re-insert it in the right place.
      map.moveLayer(lyrId, above)
    }
    map.setPaintProperty(lyrId, 'raster-opacity', layer.opacity)
    map.setLayoutProperty(lyrId, 'visibility', layer.visible ? 'visible' : 'none')
    above = lyrId
  }
}

function orderOf(map: MLMap, layerId: string): number {
  const layers = map.getStyle()?.layers ?? []
  return layers.findIndex((l) => l.id === layerId)
}
