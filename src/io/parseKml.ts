import { kml } from '@tmcw/togeojson'
import type { Overlay } from '../model/types'
import { DEFAULT_LAYER_OPACITY } from '../map/tileCatalog'
import { newId } from './ids'
import { normalize } from './normalize'
import { buildDoc, type ParseResult } from './parseGpx'

function text(el: Element, tag: string): string | null {
  const found = el.getElementsByTagName(tag)[0]
  return found?.textContent?.trim() ?? null
}

function num(el: Element, tag: string): number | null {
  const t = text(el, tag)
  if (t === null) return null
  const v = Number(t)
  return Number.isFinite(v) ? v : null
}

/** Rotate a corner around the box centre, as KML's LatLonBox/rotation specifies. */
function rotateCorners(
  corners: [number, number][],
  degrees: number,
  centre: [number, number],
): [number, number][] {
  if (!degrees) return corners
  // Positive rotation is counter-clockwise in KML.
  const rad = (degrees * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  // Scale longitude so the rotation stays visually square away from the equator.
  const latScale = Math.cos((centre[1] * Math.PI) / 180) || 1
  return corners.map(([lng, lat]) => {
    const x = (lng - centre[0]) * latScale
    const y = lat - centre[1]
    return [centre[0] + (x * cos - y * sin) / latScale, centre[1] + (x * sin + y * cos)]
  })
}

/**
 * Google Earth writes XYZ templates with doubled braces, and the href is often
 * percent-encoded. Normalise both into MapLibre's {z}/{x}/{y} form.
 */
export function normalizeTileTemplate(href: string): string | null {
  let url = href
  if (/%7[bB]/.test(url)) {
    try {
      url = decodeURIComponent(url)
    } catch {
      // Keep the raw string; the braces below may still be present.
    }
  }
  url = url.replace(/\{\{\s*([zxy])\s*\}\}/gi, (_, axis: string) => `{${axis.toLowerCase()}}`)
  return /\{z\}/.test(url) && /\{x\}/.test(url) && /\{y\}/.test(url) ? url : null
}

/**
 * getElementsByTagName matches the qualified name, so `gx:minLevel` is not
 * found by `minLevel`. Try both spellings.
 */
function firstByLocalName(el: Element | Document, local: string): Element | null {
  const direct = el.getElementsByTagName(local)[0]
  if (direct) return direct
  const prefixed = el.getElementsByTagName(`gx:${local}`)[0]
  return prefixed ?? null
}

function numByLocalName(el: Element, local: string): number | null {
  const found = firstByLocalName(el, local)
  const value = Number(found?.textContent?.trim())
  return found && Number.isFinite(value) ? value : null
}

export interface RawOverlay {
  name: string
  /** `href` exactly as written in the KML; resolved by the caller. */
  href: string
  corners: [number, number][]
  opacity: number
}

export interface RawTileLayer {
  name: string
  url: string
  bounds?: [number, number, number, number]
  minzoom: number
  maxzoom: number
  opacity: number
}

/**
 * Tile pyramids and static image overlays both live inside <GroundOverlay>;
 * a pyramid's <Icon> is only a placeholder pixel, so the two must not be mixed.
 */
export function extractTileLayers(xml: Document): RawTileLayer[] {
  const out: RawTileLayer[] = []
  const nodes = xml.getElementsByTagName('GroundOverlay')
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i]
    if (!el) continue
    const pyramid = firstByLocalName(el, 'MapTilePyramid')
    if (!pyramid) continue
    const link = firstByLocalName(pyramid, 'Link') ?? pyramid
    const url = normalizeTileTemplate(text(link, 'href') ?? '')
    if (!url) continue

    const box = el.getElementsByTagName('LatLonBox')[0]
    const north = box ? num(box, 'north') : null
    const south = box ? num(box, 'south') : null
    const east = box ? num(box, 'east') : null
    const west = box ? num(box, 'west') : null

    const colour = text(el, 'color')
    const alpha = colour && colour.length === 8 ? parseInt(colour.slice(0, 2), 16) / 255 : 1

    const layer: RawTileLayer = {
      name: text(el, 'name') ?? `圖磚圖層 ${out.length + 1}`,
      url,
      minzoom: numByLocalName(pyramid, 'minLevel') ?? 0,
      maxzoom: numByLocalName(pyramid, 'maxLevel') ?? 19,
      opacity: Number.isFinite(alpha) ? alpha : 1,
    }
    if (north !== null && south !== null && east !== null && west !== null) {
      layer.bounds = [west, south, east, north]
    }
    out.push(layer)
  }
  return out
}

/** GroundOverlays, which togeojson does not model. */
export function extractGroundOverlays(xml: Document): RawOverlay[] {
  const out: RawOverlay[] = []
  const nodes = xml.getElementsByTagName('GroundOverlay')
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i]
    if (!el) continue
    // A tile pyramid is handled by extractTileLayers; its Icon is a stub pixel.
    if (firstByLocalName(el, 'MapTilePyramid')) continue
    const box = el.getElementsByTagName('LatLonBox')[0]
    const href = el.getElementsByTagName('Icon')[0]
    const hrefText = href ? text(href, 'href') : null
    if (!box || !hrefText) continue
    const north = num(box, 'north')
    const south = num(box, 'south')
    const east = num(box, 'east')
    const west = num(box, 'west')
    if (north === null || south === null || east === null || west === null) continue

    const centre: [number, number] = [(east + west) / 2, (north + south) / 2]
    const corners = rotateCorners(
      [
        [west, north],
        [east, north],
        [east, south],
        [west, south],
      ],
      num(box, 'rotation') ?? 0,
      centre,
    )

    // KML colour is aabbggrr; the alpha byte drives overlay opacity.
    const colour = text(el, 'color')
    const alpha = colour && colour.length === 8 ? parseInt(colour.slice(0, 2), 16) / 255 : 1

    out.push({
      name: text(el, 'name') ?? `Overlay ${out.length + 1}`,
      href: hrefText,
      corners,
      opacity: Number.isFinite(alpha) ? alpha : 1,
    })
  }
  return out
}

/**
 * Parse a KML document. `resolveImage` turns a GroundOverlay href into a
 * displayable URL (KMZ supplies blobs; plain KML passes the href through).
 */
export function kmlToDoc(
  xml: Document,
  name: string,
  resolveImage?: (href: string) => { url: string; blob?: Blob } | null,
): ParseResult {
  const result = buildDoc(name, 'kml', normalize(kml(xml)))

  // A file like happyman_XYZ.kml defines eight alternative basemaps; showing
  // them all at once just stacks opaque tiles, so only the first starts on.
  result.tiles = extractTileLayers(xml).map((raw, index) => ({
    id: newId('tile'),
    name: raw.name,
    visible: index === 0,
    // Honour an explicit alpha; otherwise use the shared semi-transparent default.
    opacity: raw.opacity < 1 ? raw.opacity : DEFAULT_LAYER_OPACITY,
    url: raw.url,
    ...(raw.bounds ? { bounds: raw.bounds } : {}),
    minzoom: raw.minzoom,
    maxzoom: raw.maxzoom,
    tms: false,
    origin: name,
  }))

  if (!resolveImage) return result

  const overlays: Overlay[] = []
  for (const raw of extractGroundOverlays(xml)) {
    const image = resolveImage(raw.href)
    if (!image) {
      result.skipped.push(`GroundOverlay "${raw.name}" (image not found: ${raw.href})`)
      continue
    }
    overlays.push({
      id: newId('ovl'),
      name: raw.name,
      visible: true,
      opacity: raw.opacity,
      corners: raw.corners,
      url: image.url,
      blob: image.blob,
    })
  }
  result.doc.overlays = overlays
  return result
}
