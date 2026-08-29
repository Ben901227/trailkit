import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import { detectFormat } from '../src/io/detect'
import { gpxToDoc } from '../src/io/parseGpx'
import { extractGroundOverlays, kmlToDoc } from '../src/io/parseKml'
import { trackStats } from '../src/model/stats'

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')
}

function parse(text: string): Document {
  return new DOMParser().parseFromString(text, 'text/xml') as unknown as Document
}

describe('detectFormat', () => {
  it('sniffs content ahead of the filename', () => {
    const gpx = fixture('sample.gpx')
    expect(detectFormat('mystery.dat', gpx, new Uint8Array([60, 63, 120, 109]))).toBe('gpx')
    expect(detectFormat('a.kml', fixture('sample.kml'), new Uint8Array([60]))).toBe('kml')
  })

  it('recognises a zip header as KMZ regardless of name', () => {
    expect(detectFormat('route.kml', '', new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe('kmz')
  })

  it('falls back to the extension when content is unrecognisable', () => {
    expect(detectFormat('route.gpx', 'nonsense', new Uint8Array([1, 2, 3, 4]))).toBe('gpx')
    expect(detectFormat('route.bin', 'nonsense', new Uint8Array([1, 2, 3, 4]))).toBeNull()
  })
})

describe('gpxToDoc', () => {
  const { doc, skipped } = gpxToDoc(parse(fixture('sample.gpx')), 'sample.gpx')

  it('reads tracks, waypoints and names', () => {
    expect(skipped).toEqual([])
    expect(doc.tracks).toHaveLength(1)
    expect(doc.tracks[0]!.name).toBe('測試軌跡')
    expect(doc.waypoints[0]!.name).toBe('登山口')
    expect(doc.waypoints[0]!.description).toBe('停車場旁')
  })

  it('keeps elevation in the coordinates and times index-aligned', () => {
    const coords = doc.tracks[0]!.geometry.coordinates
    expect(coords).toHaveLength(3)
    expect(coords[0]![2]).toBe(1200)
    expect(doc.tracks[0]!.props.times).toEqual([
      '2024-01-01T00:00:00Z',
      '2024-01-01T00:10:00Z',
      '2024-01-01T00:20:00Z',
    ])
  })

  it('computes stats, ignoring elevation noise below the threshold', () => {
    const s = trackStats(doc.tracks[0]!)
    expect(s.points).toBe(3)
    expect(s.distance).toBeGreaterThan(200)
    expect(s.ascent).toBe(60)
    expect(s.descent).toBe(30)
    expect(s.start).toBe('2024-01-01T00:00:00Z')
  })
})

describe('kmlToDoc', () => {
  it('reads a line and a point', () => {
    const { doc } = kmlToDoc(parse(fixture('sample.kml')), 'sample.kml')
    expect(doc.tracks.map((t) => t.name)).toEqual(['路線 A'])
    expect(doc.waypoints.map((w) => w.name)).toEqual(['標記 B'])
    expect(doc.waypoints[0]!.description).toBe('說明文字')
  })

  it('extracts GroundOverlay corners clockwise from the north-west', () => {
    const [overlay] = extractGroundOverlays(parse(fixture('sample.kml')))
    expect(overlay!.href).toBe('files/overlay.png')
    expect(overlay!.corners).toEqual([
      [121.0, 24.2],
      [121.2, 24.2],
      [121.2, 24.0],
      [121.0, 24.0],
    ])
    expect(overlay!.opacity).toBeCloseTo(0x80 / 255, 3)
  })

  it('reports an overlay whose image cannot be resolved instead of dropping it', () => {
    const { doc, skipped } = kmlToDoc(parse(fixture('sample.kml')), 'sample.kml', () => null)
    expect(doc.overlays).toHaveLength(0)
    expect(skipped[0]).toContain('疊圖 C')
  })
})

describe('waypoint naming', () => {
  const gpx = (inner: string) =>
    parse(
      `<?xml version="1.0"?><gpx version="1.1" creator="t" xmlns="http://www.topografix.com/GPX/1/1">${inner}</gpx>`,
    )

  it('prefers <name>', () => {
    const { doc } = gpxToDoc(gpx('<wpt lat="24" lon="121"><name>桃山</name><type>方位點</type></wpt>'), 'x')
    expect(doc.waypoints[0]!.name).toBe('桃山')
  })

  it('falls back to <type> when the waypoint has no name', () => {
    const { doc } = gpxToDoc(gpx('<wpt lat="24" lon="121"><type>起點</type><sym>Waypoint</sym></wpt>'), 'x')
    expect(doc.waypoints[0]!.name).toBe('起點')
  })

  it('does not fall back to <sym>, which is the icon and the same for every point', () => {
    const { doc } = gpxToDoc(gpx('<wpt lat="24" lon="121"><sym>Waypoint</sym></wpt>'), 'x')
    expect(doc.waypoints[0]!.name).toBe('航點 1')
  })
})
