import type { Feature, FeatureCollection } from 'geojson'
import type { Map as MLMap, GeoJSONSource } from 'maplibre-gl'

export const SRC_PEAKS = 'peaks'
export const PEAK_LAYERS = ['peak-symbol', 'peak-label', 'peak-hit']

/** `[name, lng, lat, elevation?]` — a compact shape for 3,669 rows. */
type PeakRow = [string, number, number, number?]

let loading: Promise<FeatureCollection> | null = null

/**
 * The list ships with the app but is fetched separately, so it is cached on
 * its own and never sits in the main bundle. One request, then it is in the
 * service worker's precache.
 */
async function loadPeaks(baseUrl: string): Promise<FeatureCollection> {
  const rows = (await fetch(baseUrl).then((r) => {
    if (!r.ok) throw new Error(`peaks.json: ${r.status}`)
    return r.json()
  })) as PeakRow[]

  const features: Feature[] = rows.map(([name, lng, lat, elevation]) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      name,
      elevation: elevation ?? null,
      label: elevation ? `${name} ${elevation}m` : name,
    },
  }))
  return { type: 'FeatureCollection', features }
}

export function peaksReady(): boolean {
  return loading !== null
}

/** Fill the peak source, fetching the list the first time it is needed. */
export async function ensurePeaks(map: MLMap, baseUrl: string): Promise<void> {
  if (!loading) loading = loadPeaks(baseUrl)
  const data = await loading
  const source = map.getSource(SRC_PEAKS) as GeoJSONSource | undefined
  source?.setData(data)
}
