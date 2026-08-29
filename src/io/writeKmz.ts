import JSZip from 'jszip'
import type { Doc, TileLayer } from '../model/types'
import { writeKml, type KmlImage } from './writeKml'

function extensionFor(type: string | undefined): string {
  if (type === 'image/png') return 'png'
  if (type === 'image/gif') return 'gif'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}

/** Package the KML plus every overlay image we still hold bytes for. */
export async function writeKmz(docs: Doc[], name = 'export', layers: TileLayer[] = []): Promise<Blob> {
  const zip = new JSZip()
  const images: KmlImage[] = []

  let index = 0
  for (const doc of docs) {
    for (const overlay of doc.overlays) {
      if (!overlay.blob) continue
      const href = `files/overlay_${index++}.${extensionFor(overlay.blob.type)}`
      zip.file(href, overlay.blob)
      images.push({ overlayId: overlay.id, href })
    }
  }

  zip.file('doc.kml', writeKml(docs, name, images, layers))
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.google-earth.kmz' })
}
