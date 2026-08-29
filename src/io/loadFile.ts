import { detectFormat } from './detect'
import { geoJsonToDoc } from './parseGeoJson'
import { gpxToDoc, type ParseResult } from './parseGpx'
import { kmlToDoc } from './parseKml'

/** Browser XML parsing, with the silent-failure mode of DOMParser turned into an error. */
export function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const err = doc.getElementsByTagName('parsererror')[0]
  if (err) throw new Error(err.textContent?.trim().split('\n')[0] ?? 'Malformed XML')
  return doc
}

export interface LoadOutcome {
  results: ParseResult[]
  errors: { name: string; message: string }[]
}

async function loadOne(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const head = new TextDecoder().decode(bytes.slice(0, 2048))
  const format = detectFormat(file.name, head, bytes)

  if (format === 'kmz') {
    // JSZip is only needed for KMZ; keep it out of the initial bundle.
    const { kmzToDoc } = await import('./parseKmz')
    return kmzToDoc(buffer, file.name, parseXml)
  }

  const text = new TextDecoder().decode(bytes)
  if (format === 'gpx') return gpxToDoc(parseXml(text), file.name)
  if (format === 'kml') {
    // Plain KML can only reference overlay images by URL.
    return kmlToDoc(parseXml(text), file.name, (href) =>
      /^https?:/i.test(href) ? { url: href } : null,
    )
  }
  if (format === 'geojson') return geoJsonToDoc(text, file.name)
  throw new Error('Unrecognised format — expected GPX, KML, KMZ or GeoJSON')
}

export async function loadFiles(files: File[]): Promise<LoadOutcome> {
  const results: ParseResult[] = []
  const errors: LoadOutcome['errors'] = []
  for (const file of files) {
    try {
      results.push(await loadOne(file))
    } catch (e) {
      errors.push({ name: file.name, message: e instanceof Error ? e.message : String(e) })
    }
  }
  return { results, errors }
}
