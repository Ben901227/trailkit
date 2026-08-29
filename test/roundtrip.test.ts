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
