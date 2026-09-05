import { describe, expect, it } from 'vitest'
import { formatGrid, formatLngLat, toTWD97, twd97ToTWD67, zoneFor } from '../src/model/twd'

describe('zoneFor', () => {
  it('puts the main island in the 121 zone', () => {
    expect(zoneFor(121.1054)).toBe(121)
    expect(zoneFor(120.6)).toBe(121)
  })

  it('puts Penghu and Kinmen in the 119 zone', () => {
    expect(zoneFor(119.566)).toBe(119)
    expect(zoneFor(118.32)).toBe(119)
  })
})

describe('toTWD97', () => {
  it('lands on the false easting at the central meridian', () => {
    expect(toTWD97(121, 24.4135).east).toBeCloseTo(250000, 6)
  })

  it('puts the equator at zero northing', () => {
    expect(toTWD97(121, 0).north).toBeCloseTo(0, 6)
  })

  it('grows eastward with longitude', () => {
    const west = toTWD97(121.0, 24.4135).east
    const east = toTWD97(121.2, 24.4135).east
    expect(east).toBeGreaterThan(west)
    // Two degrees of longitude is roughly 100 km at this latitude.
    expect(east - west).toBeGreaterThan(19000)
    expect(east - west).toBeLessThan(21000)
  })

  it('converts a known summit', () => {
    // 西勢山 三等三角點 6622
    const { east, north } = toTWD97(121.1054, 24.4135)
    expect(Math.round(east)).toBeGreaterThan(260000)
    expect(Math.round(east)).toBeLessThan(261500)
    expect(Math.round(north)).toBeGreaterThan(2700000)
    expect(Math.round(north)).toBeLessThan(2703000)
  })

  it('honours an explicit zone', () => {
    expect(toTWD97(119, 23.5, 119).east).toBeCloseTo(250000, 6)
  })
})

describe('twd97ToTWD67', () => {
  it('shifts west and north by the published offsets', () => {
    // Around Taiwan the datum shift is roughly 828 m west and 205 m north.
    const g97 = toTWD97(121.1054, 24.4135)
    const g67 = twd97ToTWD67(g97)
    expect(g97.east - g67.east).toBeCloseTo(829, 0)
    expect(g67.north - g97.north).toBeCloseTo(205, 0)
  })
})

describe('formatting', () => {
  it('groups metres and labels the axes', () => {
    expect(formatGrid({ east: 260649.4, north: 2701234.6 })).toBe('260,649 E　2,701,235 N')
  })

  it('writes latitude first, six decimals', () => {
    expect(formatLngLat(121.1054, 24.4135)).toBe('24.413500, 121.105400')
  })
})
