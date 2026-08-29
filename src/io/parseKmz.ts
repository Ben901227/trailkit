import JSZip from 'jszip'
import { kmlToDoc } from './parseKml'
import type { ParseResult } from './parseGpx'

function normalizeHref(href: string): string {
  return href.replace(/^\.\//, '').replace(/^\//, '').toLowerCase()
}

function mimeFor(path: string): string {
  const ext = path.toLowerCase().split('.').pop()
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  return 'image/jpeg'
}

/** Open a KMZ: the KML inside plus any images its GroundOverlays reference. */
export async function kmzToDoc(
  buffer: ArrayBuffer,
  name: string,
  parseXml: (text: string) => Document,
): Promise<ParseResult> {
  const zip = await JSZip.loadAsync(buffer)
  const entries = Object.values(zip.files).filter((f) => !f.dir)

  const kmlEntry =
    entries.find((f) => f.name.toLowerCase() === 'doc.kml') ??
    entries.find((f) => f.name.toLowerCase().endsWith('.kml'))
  if (!kmlEntry) throw new Error(`${name}: no .kml found inside the archive`)

  const xml = parseXml(await kmlEntry.async('text'))

  // Pre-load images so the synchronous KML parser can resolve hrefs.
  const images = new Map<string, Blob>()
  for (const entry of entries) {
    if (!/\.(png|jpe?g|gif|webp)$/i.test(entry.name)) continue
    const blob = new Blob([await entry.async('arraybuffer')], { type: mimeFor(entry.name) })
    images.set(normalizeHref(entry.name), blob)
    const base = normalizeHref(entry.name.split('/').pop() ?? '')
    if (!images.has(base)) images.set(base, blob)
  }

  const result = kmlToDoc(xml, name, (href) => {
    if (/^https?:/i.test(href)) return { url: href }
    const blob =
      images.get(normalizeHref(href)) ?? images.get(normalizeHref(href.split('/').pop() ?? ''))
    if (!blob) return null
    return { url: URL.createObjectURL(blob), blob }
  })
  result.doc.sourceFormat = 'kmz'
  return result
}
