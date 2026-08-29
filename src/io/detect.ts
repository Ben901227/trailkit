import type { SourceFormat } from '../model/types'

/**
 * Work out the real format. Extensions are unreliable on mobile file pickers,
 * so sniff the content and only fall back to the filename.
 */
export function detectFormat(name: string, head: string, bytes: Uint8Array): SourceFormat | null {
  // KMZ is a zip: "PK\x03\x04"
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return 'kmz'

  const sample = head.slice(0, 2048)
  if (/<gpx[\s>]/i.test(sample)) return 'gpx'
  if (/<kml[\s>]/i.test(sample)) return 'kml'
  if (/"type"\s*:\s*"(FeatureCollection|Feature|LineString|Point)"/.test(sample)) return 'geojson'

  const ext = name.toLowerCase().split('.').pop()
  if (ext === 'gpx') return 'gpx'
  if (ext === 'kml') return 'kml'
  if (ext === 'kmz') return 'kmz'
  if (ext === 'geojson' || ext === 'json') return 'geojson'
  return null
}
