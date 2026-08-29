import type { Doc, Overlay, TileLayer, Track, Waypoint } from '../model/types'
import { escapeXml } from './writeGpx'

/** `#rrggbb` -> KML's `aabbggrr`. */
export function kmlColor(hex: string, opacity = 1): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  const rgb = m?.[1] ?? '3388ff'
  const rr = rgb.slice(0, 2)
  const gg = rgb.slice(2, 4)
  const bb = rgb.slice(4, 6)
  const aa = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0')
  return `${aa}${bb}${gg}${rr}`.toLowerCase()
}

function coords(list: number[][]): string {
  return list.map(([lng = 0, lat = 0, ele]) => `${lng},${lat}${ele === undefined ? '' : `,${ele}`}`).join(' ')
}

function trackXml(t: Track, styleId: string): string {
  return (
    `    <Placemark>\n` +
    `      <name>${escapeXml(t.name)}</name>\n` +
    `      <styleUrl>#${styleId}</styleUrl>\n` +
    `      <LineString><tessellate>1</tessellate><coordinates>${coords(
      t.geometry.coordinates,
    )}</coordinates></LineString>\n` +
    `    </Placemark>\n`
  )
}

function waypointXml(w: Waypoint): string {
  return (
    `    <Placemark>\n` +
    `      <name>${escapeXml(w.name)}</name>\n` +
    (w.description ? `      <description>${escapeXml(w.description)}</description>\n` : '') +
    `      <Point><coordinates>${coords([w.geometry.coordinates])}</coordinates></Point>\n` +
    `    </Placemark>\n`
  )
}

/**
 * A rotated overlay cannot be expressed as a LatLonBox, so we write the
 * axis-aligned bounding box and note the loss. gx:LatLonQuad would be exact
 * but is a Google extension many readers ignore.
 */
function overlayXml(o: Overlay, href: string): string {
  const lngs = o.corners.map((c) => c[0])
  const lats = o.corners.map((c) => c[1])
  return (
    `    <GroundOverlay>\n` +
    `      <name>${escapeXml(o.name)}</name>\n` +
    `      <color>${kmlColor('#ffffff', o.opacity)}</color>\n` +
    `      <Icon><href>${escapeXml(href)}</href></Icon>\n` +
    `      <gx:LatLonQuad xmlns:gx="http://www.google.com/kml/ext/2.2">\n` +
    `        <coordinates>${[o.corners[3], o.corners[2], o.corners[1], o.corners[0]]
      .map((c) => `${c?.[0]},${c?.[1]}`)
      .join(' ')}</coordinates>\n` +
    `      </gx:LatLonQuad>\n` +
    `      <LatLonBox>\n` +
    `        <north>${Math.max(...lats)}</north><south>${Math.min(...lats)}</south>\n` +
    `        <east>${Math.max(...lngs)}</east><west>${Math.min(...lngs)}</west>\n` +
    `      </LatLonBox>\n` +
    `    </GroundOverlay>\n`
  )
}

/** Google Earth reads XYZ layers back from a GroundOverlay + gx:MapTilePyramid. */
function tileXml(t: TileLayer): string {
  const [west, south, east, north] = t.bounds ?? [-180, -85.05, 180, 85.05]
  const href = t.url.replace(/\{([zxy])\}/g, '{{$1}}')
  return (
    `    <GroundOverlay>\n` +
    `      <name>${escapeXml(t.name)}</name>\n` +
    `      <color>${kmlColor('#ffffff', t.opacity)}</color>\n` +
    // A 1x1 transparent GIF, the placeholder Google Earth itself writes.
    `      <Icon><href>data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==</href></Icon>\n` +
    `      <LatLonBox><north>${north}</north><south>${south}</south>` +
    `<east>${east}</east><west>${west}</west></LatLonBox>\n` +
    `      <gx:MapTilePyramid xmlns:gx="http://www.google.com/kml/ext/2.2">\n` +
    `        <Link><href>${escapeXml(href)}</href></Link>\n` +
    `        <gx:minLevel>${t.minzoom}</gx:minLevel>\n` +
    `        <gx:maxLevel>${t.maxzoom}</gx:maxLevel>\n` +
    `      </gx:MapTilePyramid>\n` +
    `    </GroundOverlay>\n`
  )
}

export interface KmlImage {
  overlayId: string
  href: string
}

/** `images` maps overlays to the href they will live at (used by the KMZ packer). */
export function writeKml(
  docs: Doc[],
  name = 'export',
  images: KmlImage[] = [],
  layers: TileLayer[] = [],
): string {
  const styles: string[] = []
  const body: string[] = []

  if (layers.length) {
    body.push(`  <Folder>\n    <name>圖磚圖層</name>\n${layers.map(tileXml).join('')}  </Folder>\n`)
  }

  docs.forEach((doc) => {
    const parts: string[] = []
    doc.tracks.forEach((t) => {
      const styleId = `s_${t.id}`
      styles.push(
        `  <Style id="${styleId}"><LineStyle><color>${kmlColor(
          t.color,
        )}</color><width>4</width></LineStyle></Style>\n`,
      )
      parts.push(trackXml(t, styleId))
    })
    doc.waypoints.forEach((w) => parts.push(waypointXml(w)))
    doc.overlays.forEach((o) => {
      const href = images.find((i) => i.overlayId === o.id)?.href ?? o.url
      parts.push(overlayXml(o, href))
    })
    if (!parts.length) return
    body.push(
      `  <Folder>\n    <name>${escapeXml(doc.name)}</name>\n${parts.join('')}  </Folder>\n`,
    )
  })

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<kml xmlns="http://www.opengis.net/kml/2.2">\n' +
    `  <Document>\n    <name>${escapeXml(name)}</name>\n` +
    styles.join('') +
    body.join('') +
    '  </Document>\n</kml>\n'
  )
}
