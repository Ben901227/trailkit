import type { Position } from 'geojson'
import { haversine } from '../model/stats'
import type { Track } from '../model/types'
import { TERRAIN } from './basemaps'

/**
 * Elevation from two very different sources.
 *
 * Track and waypoint coordinates already carry the file's own `<ele>`, so the
 * only work there is finding which point was tapped. Bare map taps have no
 * such data, so a DEM tile is fetched and decoded by hand.
 */

export interface NearestPoint {
  position: Position
  index: number
  /** Metres from the tap to that point. */
  distance: number
}

export function nearestPointOnTrack(track: Track, lng: number, lat: number): NearestPoint | null {
  const coords = track.geometry.coordinates
  if (!coords.length) return null

  const at: Position = [lng, lat]
  let best = -1
  let bestDistance = Infinity
  for (let i = 0; i < coords.length; i++) {
    const d = haversine(at, coords[i] as Position)
    if (d < bestDistance) {
      bestDistance = d
      best = i
    }
  }
  const position = coords[best] as Position | undefined
  if (!position) return null
  return { position, index: best, distance: bestDistance }
}

/** Metres along the track from its start to `index`. */
export function distanceAlong(track: Track, index: number): number {
  const coords = track.geometry.coordinates
  let total = 0
  for (let i = 1; i <= index && i < coords.length; i++) {
    total += haversine(coords[i - 1] as Position, coords[i] as Position)
  }
  return total
}

/** The third coordinate, when the source file supplied one. */
export function elevationOf(position: Position | undefined): number | null {
  const ele = position?.[2]
  return typeof ele === 'number' && Number.isFinite(ele) ? ele : null
}

/* ---------- terrain DEM ---------- */

/**
 * Terrarium packs metres into the RGB channels. The 32768 offset is what
 * allows elevations below sea level.
 */
export function decodeTerrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768
}

const TILE = TERRAIN.tileSize
const MAX_CACHED_TILES = 32
/** A wedged request must not leave the caller waiting forever. */
const TILE_TIMEOUT_MS = 8000
const tiles = new Map<string, Promise<ImageData | null>>()

function tileUrl(z: number, x: number, y: number): string {
  return TERRAIN.url.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    void work.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(null)
      },
    )
  })
}

async function loadTile(z: number, x: number, y: number): Promise<ImageData | null> {
  const image = new Image()
  // Reading pixels back is stricter than texturing; without this the canvas
  // is tainted and getImageData throws.
  image.crossOrigin = 'anonymous'
  image.src = tileUrl(z, x, y)
  try {
    // decode() can hang indefinitely on a background tab or a stalled connection.
    if ((await withTimeout(image.decode(), TILE_TIMEOUT_MS)) === null && !image.complete) return null
    const canvas = document.createElement('canvas')
    canvas.width = TILE
    canvas.height = TILE
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(image, 0, 0, TILE, TILE)
    return ctx.getImageData(0, 0, TILE, TILE)
  } catch {
    // Offline, a 404, or a CORS refusal. The caller degrades to no reading.
    return null
  }
}

function cachedTile(z: number, x: number, y: number): Promise<ImageData | null> {
  const key = `${z}/${x}/${y}`
  const hit = tiles.get(key)
  if (hit) return hit
  // A failure is not cached: the next right-click should be free to retry.
  const pending = loadTile(z, x, y).then((data) => {
    if (!data) tiles.delete(key)
    return data
  })
  tiles.set(key, pending)
  if (tiles.size > MAX_CACHED_TILES) {
    const oldest = tiles.keys().next().value
    if (oldest !== undefined) tiles.delete(oldest)
  }
  return pending
}

/**
 * Terrain height at a position, or null when the DEM cannot be read. Deliberately
 * never throws: a bare map tap must not break because an elevation tile is missing.
 */
export async function terrainElevation(
  lng: number,
  lat: number,
  zoom: number,
): Promise<number | null> {
  if (!Number.isFinite(lat) || Math.abs(lat) > 85.05) return null

  const z = Math.max(0, Math.min(TERRAIN.maxzoom, Math.round(zoom)))
  const scale = 2 ** z
  const sinLat = Math.sin((lat * Math.PI) / 180)
  const worldX = ((lng + 180) / 360) * scale
  const worldY = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale

  const x = Math.floor(worldX)
  const y = Math.floor(worldY)
  if (y < 0 || y >= scale) return null

  const data = await cachedTile(z, ((x % scale) + scale) % scale, y)
  if (!data) return null

  const px = Math.min(TILE - 1, Math.floor((worldX - x) * TILE))
  const py = Math.min(TILE - 1, Math.floor((worldY - y) * TILE))
  const i = (py * TILE + px) * 4
  const r = data.data[i]
  const g = data.data[i + 1]
  const b = data.data[i + 2]
  if (r === undefined || g === undefined || b === undefined) return null

  const ele = decodeTerrarium(r, g, b)
  // Terrarium writes 0 for ocean/no-data; anything wildly out of range is junk.
  return ele < -500 || ele > 9000 ? null : ele
}
