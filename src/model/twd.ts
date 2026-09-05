/**
 * Taiwan grid coordinates.
 *
 * Hiking records in Taiwan quote positions three ways: WGS84 degrees (what GPX
 * files store), TWD97 TM2 metres (what maps and rescue services use today), and
 * TWD67 TM2 (still printed on older topographic sheets and in classic reports).
 */

const A = 6378137.0
const F = 1 / 298.257222101
const E2 = F * (2 - F)
const EP2 = E2 / (1 - E2)
const K0 = 0.9999
const FALSE_EASTING = 250000

/** The main island sits in the 121° zone; the outlying islands use 119°. */
export type Zone = 119 | 121

export interface Grid {
  east: number
  north: number
}

export function zoneFor(lng: number): Zone {
  return lng < 120.5 ? 119 : 121
}

/** WGS84 degrees to TWD97 two-degree Transverse Mercator metres. */
export function toTWD97(lng: number, lat: number, zone: Zone = zoneFor(lng)): Grid {
  const rad = Math.PI / 180
  const phi = lat * rad
  const dLon = (lng - zone) * rad

  const sinPhi = Math.sin(phi)
  const cosPhi = Math.cos(phi)
  const tanPhi = Math.tan(phi)

  const n = A / Math.sqrt(1 - E2 * sinPhi * sinPhi)
  const t = tanPhi * tanPhi
  const c = EP2 * cosPhi * cosPhi
  const a1 = dLon * cosPhi

  const m =
    A *
    ((1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 ** 3) / 256) * phi -
      ((3 * E2) / 8 + (3 * E2 * E2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * E2 * E2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * E2 ** 3) / 3072) * Math.sin(6 * phi))

  const east =
    FALSE_EASTING +
    K0 *
      n *
      (a1 +
        ((1 - t + c) * a1 ** 3) / 6 +
        ((5 - 18 * t + t * t + 72 * c - 58 * EP2) * a1 ** 5) / 120)

  const north =
    K0 *
    (m +
      n *
        tanPhi *
        ((a1 * a1) / 2 +
          ((5 - t + 9 * c + 4 * c * c) * a1 ** 4) / 24 +
          ((61 - 58 * t + t * t + 600 * c - 330 * EP2) * a1 ** 6) / 720))

  return { east, north }
}

/**
 * The published approximate shift between the two datums — the same formula
 * Taiwanese mapping tools use. Good to a couple of metres, which is well inside
 * the error of a phone GPS fix.
 */
const SHIFT_A = 0.00001549
const SHIFT_B = 0.000006521

export function twd97ToTWD67({ east, north }: Grid): Grid {
  return {
    east: east - 807.8 - SHIFT_A * east - SHIFT_B * north,
    north: north + 248.6 - SHIFT_A * north - SHIFT_B * east,
  }
}

export function formatGrid({ east, north }: Grid): string {
  return `${Math.round(east).toLocaleString('en-US')} E　${Math.round(north).toLocaleString('en-US')} N`
}

/** Six decimals is about 0.1 m — past the point any consumer GPS can resolve. */
export function formatLngLat(lng: number, lat: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}
