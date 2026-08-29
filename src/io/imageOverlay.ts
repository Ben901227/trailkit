import { newId } from './ids'
import type { Doc, Overlay } from '../model/types'

export const IMAGE_TYPES = /^image\/(png|jpeg|gif|webp)$/i

export function isImageFile(file: File): boolean {
  if (IMAGE_TYPES.test(file.type)) return true
  return /\.(png|jpe?g|gif|webp)$/i.test(file.name)
}

/**
 * Drop an image onto the map as a GroundOverlay covering `box`
 * ([west, south, east, north]), inset so its edges stay grabbable.
 */
export function overlayFromImage(file: File, box: [number, number, number, number]): Overlay {
  const [west, south, east, north] = box
  const insetX = (east - west) * 0.12
  const insetY = (north - south) * 0.12
  const w = west + insetX
  const e = east - insetX
  const s = south + insetY
  const n = north - insetY

  return {
    id: newId('ovl'),
    name: file.name.replace(/\.[^.]+$/, ''),
    visible: true,
    opacity: 0.75,
    corners: [
      [w, n],
      [e, n],
      [e, s],
      [w, s],
    ],
    url: URL.createObjectURL(file),
    blob: file,
  }
}

export function docFromOverlays(name: string, overlays: Overlay[]): Doc {
  return {
    id: newId('doc'),
    name,
    sourceFormat: 'kmz',
    tracks: [],
    waypoints: [],
    overlays,
  }
}
