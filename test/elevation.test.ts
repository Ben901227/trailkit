import { describe, expect, it } from 'vitest'
import { decodeTerrarium, distanceAlong, elevationOf, nearestPointOnTrack } from '../src/map/elevation'
import type { Track } from '../src/model/types'

function track(coordinates: number[][]): Track {
  return {
    id: 't',
    name: 'test',
    color: '#ff0000',
    visible: true,
    geometry: { type: 'LineString', coordinates },
    props: {},
  }
}

describe('nearestPointOnTrack', () => {
  const line = track([
    [121.0, 24.0, 1000],
    [121.01, 24.0, 1200],
    [121.02, 24.0, 1400],
  ])

  it('picks the closest vertex', () => {
    expect(nearestPointOnTrack(line, 121.0104, 24.0)?.index).toBe(1)
    expect(nearestPointOnTrack(line, 120.999, 24.0)?.index).toBe(0)
    expect(nearestPointOnTrack(line, 121.03, 24.0)?.index).toBe(2)
  })

  it('reports how far the tap fell from the track', () => {
    const near = nearestPointOnTrack(line, 121.0, 24.0)
    expect(near?.distance).toBeLessThan(1)
  })

  it('returns null for an empty track', () => {
    expect(nearestPointOnTrack(track([]), 121, 24)).toBeNull()
  })
})

describe('elevationOf', () => {
  it('reads the third coordinate', () => {
    expect(elevationOf([121, 24, 1650])).toBe(1650)
  })

  it('is null when the file carried no elevation', () => {
    expect(elevationOf([121, 24])).toBeNull()
    expect(elevationOf(undefined)).toBeNull()
  })
})

describe('distanceAlong', () => {
  it('accumulates only up to the given index', () => {
    const line = track([
      [121.0, 24.0],
      [121.01, 24.0],
      [121.02, 24.0],
    ])
    const one = distanceAlong(line, 1)
    expect(one).toBeGreaterThan(900)
    expect(one).toBeLessThan(1100)
    expect(distanceAlong(line, 2)).toBeCloseTo(one * 2, 0)
    expect(distanceAlong(line, 0)).toBe(0)
  })
})

describe('decodeTerrarium', () => {
  it('decodes sea level', () => {
    expect(decodeTerrarium(128, 0, 0)).toBe(0)
  })

  it('decodes a summit', () => {
    // 西勢山, 2773 m
    expect(Math.round(decodeTerrarium(138, 213, 0))).toBe(2773)
  })

  it('decodes below sea level', () => {
    expect(decodeTerrarium(126, 0, 0)).toBe(-512)
  })
})
