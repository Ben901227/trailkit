import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import { gpxToDoc } from '../src/io/parseGpx'
import { kmlToDoc } from '../src/io/parseKml'
import { geoJsonToDoc } from '../src/io/parseGeoJson'
import { writeGeoJson } from '../src/io/writeGeoJson'
import { writeGpx } from '../src/io/writeGpx'
import { kmlColor, writeKml } from '../src/io/writeKml'

function parse(text: string): Document {
  return new DOMParser().parseFromString(text, 'text/xml') as unknown as Document
}

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')
}

const original = gpxToDoc(parse(fixture('sample.gpx')), 'sample.gpx').doc

describe('GPX round-trip', () => {
  const again = gpxToDoc(parse(writeGpx([original], 'sample')), 'sample.gpx').doc

  it('keeps track names, geometry and elevation', () => {
    expect(again.tracks).toHaveLength(1)
    expect(again.tracks[0]!.name).toBe(original.tracks[0]!.name)
    expect(again.tracks[0]!.geometry.coordinates).toEqual(original.tracks[0]!.geometry.coordinates)
  })

  it('keeps timestamps aligned with the points', () => {
    expect(again.tracks[0]!.props.times).toEqual(original.tracks[0]!.props.times)
  })

  it('keeps waypoint name and description', () => {
    expect(again.waypoints[0]!.name).toBe(original.waypoints[0]!.name)
    expect(again.waypoints[0]!.description).toBe(original.waypoints[0]!.description)
  })

  it('escapes characters that would otherwise break the XML', () => {
    const doc = structuredClone(original)
    doc.tracks[0]!.name = 'A & B <"quoted">'
    const reparsed = gpxToDoc(parse(writeGpx([doc])), 'x').doc
    expect(reparsed.tracks[0]!.name).toBe('A & B <"quoted">')
  })
})

describe('KML round-trip', () => {
  it('survives GPX -> KML -> parse with names and geometry intact', () => {
    const again = kmlToDoc(parse(writeKml([original], 'sample')), 'sample.kml').doc
    expect(again.tracks[0]!.name).toBe(original.tracks[0]!.name)
    expect(again.tracks[0]!.geometry.coordinates).toEqual(original.tracks[0]!.geometry.coordinates)
    expect(again.waypoints[0]!.name).toBe(original.waypoints[0]!.name)
  })

  it('writes colours as aabbggrr', () => {
    expect(kmlColor('#e6194b')).toBe('ff4b19e6')
    expect(kmlColor('#ffffff', 0.5)).toBe('80ffffff')
  })
})

describe('GeoJSON round-trip', () => {
  it('keeps geometry and names', () => {
    const again = geoJsonToDoc(writeGeoJson([original]), 'sample.geojson').doc
    expect(again.tracks[0]!.geometry.coordinates).toEqual(original.tracks[0]!.geometry.coordinates)
    expect(again.tracks[0]!.props.times).toEqual(original.tracks[0]!.props.times)
    expect(again.waypoints[0]!.name).toBe(original.waypoints[0]!.name)
  })
})

describe('tile layer round-trip', () => {
  const source = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <GroundOverlay>
      <name>魯地圖</name>
      <color>80ffffff</color>
      <Icon><href>data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==</href></Icon>
      <LatLonBox><north>25.7</north><south>21.8</south><east>122.1</east><west>119.2</west></LatLonBox>
      <gx:MapTilePyramid>
        <Link><href>https://tile.example.tw/map/rudy/%7B%7Bz%7D%7D/%7B%7Bx%7D%7D/%7B%7By%7D%7D.png</href></Link>
        <gx:minLevel>5</gx:minLevel>
        <gx:maxLevel>17</gx:maxLevel>
      </gx:MapTilePyramid>
    </GroundOverlay>
  </Document>
</kml>`

  it('decodes a percent-encoded, double-braced XYZ template', () => {
    const { tiles } = kmlToDoc(parse(source), 'tiles.kml')
    expect(tiles).toHaveLength(1)
    expect(tiles[0]!.url).toBe('https://tile.example.tw/map/rudy/{z}/{x}/{y}.png')
    expect(tiles[0]!.minzoom).toBe(5)
    expect(tiles[0]!.maxzoom).toBe(17)
    expect(tiles[0]!.bounds).toEqual([119.2, 21.8, 122.1, 25.7])
    expect(tiles[0]!.opacity).toBeCloseTo(0x80 / 255, 3)
    expect(tiles[0]!.origin).toBe('tiles.kml')
  })

  it('does not also report the pyramid as an image overlay', () => {
    const { doc, skipped } = kmlToDoc(parse(source), 'tiles.kml', () => null)
    expect(doc.overlays).toHaveLength(0)
    expect(skipped).toEqual([])
  })

  it('writes the layer back in a form it can read again', () => {
    const first = kmlToDoc(parse(source), 'tiles.kml')
    const again = kmlToDoc(parse(writeKml([first.doc], 'tiles', [], first.tiles)), 'tiles.kml')
    expect(again.tiles[0]!.url).toBe(first.tiles[0]!.url)
    expect(again.tiles[0]!.minzoom).toBe(5)
    expect(again.tiles[0]!.maxzoom).toBe(17)
    expect(again.tiles[0]!.name).toBe('魯地圖')
  })
})

describe('image overlay corners', () => {
  const quad = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <GroundOverlay>
      <name>掃描圖</name>
      <Icon><href>files/scan.png</href></Icon>
      <gx:LatLonQuad>
        <coordinates>120.9,23.9 121.1,23.9 121.05,24.1 120.85,24.1</coordinates>
      </gx:LatLonQuad>
      <LatLonBox><north>24.1</north><south>23.9</south><east>121.1</east><west>120.85</west></LatLonBox>
    </GroundOverlay>
  </Document>
</kml>`

  it('prefers the quad over the bounding box, so a skewed fit survives', () => {
    const { doc } = kmlToDoc(parse(quad), 'q.kml', () => ({ url: 'blob:x' }))
    expect(doc.overlays[0]!.corners).toEqual([
      [120.85, 24.1],
      [121.05, 24.1],
      [121.1, 23.9],
      [120.9, 23.9],
    ])
  })

  it('writes corners that read back unchanged', () => {
    const first = kmlToDoc(parse(quad), 'q.kml', () => ({ url: 'blob:x' })).doc
    const again = kmlToDoc(parse(writeKml([first], 'q')), 'q.kml', () => ({ url: 'blob:x' })).doc
    expect(again.overlays[0]!.corners).toEqual(first.overlays[0]!.corners)
  })

  it('still reads a plain box overlay with no quad', () => {
    const { doc } = kmlToDoc(parse(fixture('sample.kml')), 'sample.kml', () => ({ url: 'blob:x' }))
    expect(doc.overlays[0]!.corners).toEqual([
      [121.0, 24.2],
      [121.2, 24.2],
      [121.2, 24.0],
      [121.0, 24.0],
    ])
  })
})
