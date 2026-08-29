import { detectFormat } from './detect'
import { declareMissingNamespaces } from './xmlRepair'
import { geoJsonToDoc } from './parseGeoJson'
import { gpxToDoc, type ParseResult } from './parseGpx'
import { kmlToDoc } from './parseKml'

function parseError(doc: Document): string | null {
  const err = doc.getElementsByTagName('parsererror')[0]
  if (!err) return null
  return err.textContent?.trim().split('\n')[0] ?? 'Malformed XML'
}

/** Set by the last parseXml call, so the caller can report the repair. */
let lastRepair: string[] = []

/**
 * Browser XML parsing. DOMParser reports failure as a document rather than an
 * exception, and rejects a file outright over an undeclared namespace prefix —
 * which several GPS apps emit — so a failed parse is retried on a repaired copy.
 */
export function parseXml(text: string): Document {
  lastRepair = []
  const first = new DOMParser().parseFromString(text, 'application/xml')
  const error = parseError(first)
  if (!error) return first

  const repaired = declareMissingNamespaces(text)
  if (!repaired.declared.length) throw new Error(error)

  const second = new DOMParser().parseFromString(repaired.text, 'application/xml')
  const stillBroken = parseError(second)
  if (stillBroken) throw new Error(stillBroken)

  lastRepair = repaired.declared
  return second
}

export interface LoadOutcome {
  results: ParseResult[]
  errors: { name: string; message: string }[]
}

function withRepairNote(result: ParseResult, repaired: string[]): ParseResult {
  if (repaired.length) {
    result.warnings.push(
      `XML 少了 ${repaired.map((p) => `xmlns:${p}`).join('、')} 的宣告，已自動補上後讀取`,
    )
  }
  return result
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
  if (format === 'gpx') {
    const xml = parseXml(text)
    return withRepairNote(gpxToDoc(xml, file.name), lastRepair)
  }
  if (format === 'kml') {
    const xml = parseXml(text)
    // Plain KML can only reference overlay images by URL.
    const result = kmlToDoc(xml, file.name, (href) =>
      /^https?:/i.test(href) ? { url: href } : null,
    )
    return withRepairNote(result, lastRepair)
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
