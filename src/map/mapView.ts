import maplibregl, { type LngLatBoundsLike, type Map as MLMap } from 'maplibre-gl'
import { BASEMAPS, TERRAIN, findBasemap, type Basemap } from './basemaps'
import { CompassControl } from './compassControl'

export const SRC_BASEMAP = 'basemap'
export const SRC_TRACKS = 'tracks'
export const SRC_WAYPOINTS = 'waypoints'
export const SRC_VERTICES = 'vertices'
export const SRC_CORNERS = 'corners'

function baseStyle(basemap: Basemap): maplibregl.StyleSpecification {
  return {
    version: 8,
    // Latin glyphs ship with the app; CJK is drawn locally (see createMap).
    glyphs: './fonts/{fontstack}/{range}.pbf',
    sources: {
      [SRC_BASEMAP]: {
        type: 'raster',
        tiles: basemap.tiles,
        tileSize: 256,
        maxzoom: basemap.maxzoom,
        attribution: basemap.attribution,
      },
      [SRC_TRACKS]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      [SRC_WAYPOINTS]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      [SRC_VERTICES]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      [SRC_CORNERS]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    },
    layers: [
      { id: 'basemap', type: 'raster', source: SRC_BASEMAP },
      {
        id: 'track-casing',
        type: 'line',
        source: SRC_TRACKS,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.7 },
      },
      {
        id: 'track-line',
        type: 'line',
        source: SRC_TRACKS,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 3 },
      },
      {
        id: 'track-selected',
        type: 'line',
        source: SRC_TRACKS,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        filter: ['==', ['get', 'key'], ''],
        paint: { 'line-color': ['get', 'color'], 'line-width': 6 },
      },
      {
        id: 'waypoint-circle',
        type: 'circle',
        source: SRC_WAYPOINTS,
        paint: {
          'circle-radius': 6,
          'circle-color': '#ffffff',
          'circle-stroke-color': '#1f2933',
          'circle-stroke-width': 2,
        },
      },
      {
        id: 'waypoint-label',
        type: 'symbol',
        source: SRC_WAYPOINTS,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'text-anchor': 'left',
          'text-offset': [0.8, 0],
          'text-max-width': 12,
          // Drop a label rather than a marker when they collide.
          'text-optional': true,
          'text-padding': 4,
        },
        paint: {
          'text-color': '#1f2933',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      },
      {
        id: 'waypoint-selected',
        type: 'circle',
        source: SRC_WAYPOINTS,
        filter: ['==', ['get', 'key'], ''],
        paint: {
          'circle-radius': 9,
          'circle-color': '#ffd166',
          'circle-stroke-color': '#1f2933',
          'circle-stroke-width': 2,
        },
      },
      // Invisible, finger-sized targets so taps land on the feature, not near it.
      {
        id: 'waypoint-hit',
        type: 'circle',
        source: SRC_WAYPOINTS,
        paint: { 'circle-radius': 20, 'circle-color': '#000000', 'circle-opacity': 0 },
      },
      {
        id: 'vertex-circle',
        type: 'circle',
        source: SRC_VERTICES,
        paint: {
          'circle-radius': ['case', ['get', 'active'], 8, 5],
          'circle-color': ['case', ['get', 'active'], '#ffd166', '#ffffff'],
          'circle-stroke-color': '#1f2933',
          'circle-stroke-width': 2,
        },
      },
      {
        id: 'track-hit',
        type: 'line',
        source: SRC_TRACKS,
        paint: { 'line-color': '#000000', 'line-opacity': 0, 'line-width': 24 },
      },
      {
        id: 'corner-outline',
        type: 'line',
        source: SRC_CORNERS,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': '#2f6fed', 'line-width': 2, 'line-dasharray': [2, 2] },
      },
      {
        id: 'corner-circle',
        type: 'circle',
        source: SRC_CORNERS,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 8,
          'circle-color': '#2f6fed',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      },
      {
        id: 'corner-hit',
        type: 'circle',
        source: SRC_CORNERS,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-radius': 22, 'circle-color': '#000000', 'circle-opacity': 0 },
      },
      // Finger-sized target, drawn last so it wins hit-testing over the line.
      {
        id: 'vertex-hit',
        type: 'circle',
        source: SRC_VERTICES,
        paint: { 'circle-radius': 18, 'circle-color': '#000000', 'circle-opacity': 0 },
      },
    ],
  } as maplibregl.StyleSpecification
}

/**
 * Glyph ranges shipped with the app. MapLibre asks for whichever range each
 * character falls in, and a range we do not have must resolve to a valid empty
 * glyph file: a 404 (or worse, a dev server's HTML fallback) makes the symbol
 * layout throw, which takes down every layer sharing that source.
 */
const BUNDLED_GLYPH_RANGES = new Set(['0-255', '256-511', '8192-8447', '65280-65535'])

function glyphFallback(url: string): string {
  const range = url.match(/\/([0-9]+-[0-9]+)\.pbf(?:\?|$)/)?.[1]
  if (range && BUNDLED_GLYPH_RANGES.has(range)) return url
  return url.replace(/\/[^/]+\.pbf/, '/empty.pbf')
}

export function createMap(container: HTMLElement, basemapId: string): MLMap {
  const map = new maplibregl.Map({
    container,
    style: baseStyle(findBasemap(basemapId, null)),
    center: [121.0, 23.7],
    zoom: 6,
    attributionControl: { compact: true },
    // Google Earth tilts well past MapLibre's default 60° ceiling.
    maxPitch: 85,
    // Keep pinch-rotate; it is the gesture that makes the 3D view usable later.
    pitchWithRotate: true,
    // Waypoint names are mostly Chinese; the browser draws those, so only the
    // Latin ranges have to be shipped as glyph files.
    localIdeographFontFamily: "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif",
    transformRequest: (url, resourceType) =>
      resourceType === 'Glyphs' ? { url: glyphFallback(url) } : { url },
  })
  // The rose by the scale bar names the directions, so the navigation
  // control keeps only its zoom buttons.
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  map.addControl(
    new maplibregl.GeolocateControl({ trackUserLocation: true, showAccuracyCircle: true }),
    'top-right',
  )
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')
  map.addControl(new CompassControl(), 'bottom-left')
  return map
}

export function applyBasemap(map: MLMap, basemapId: string, customUrl: string | null): void {
  const basemap = findBasemap(basemapId, customUrl)
  const source = map.getSource(SRC_BASEMAP)
  if (source && 'setTiles' in source) {
    ;(source as maplibregl.RasterTileSource).setTiles(basemap.tiles)
  }
}

export function fitTo(map: MLMap, box: [number, number, number, number]): void {
  const [w, s, e, n] = box
  const pad = 48
  const bounds: LngLatBoundsLike = [
    [w, s],
    [e, n],
  ]
  if (w === e && s === n) {
    map.easeTo({ center: [w, s], zoom: Math.max(map.getZoom(), 14) })
    return
  }
  map.fitBounds(bounds, { padding: pad, maxZoom: 16 })
}

export { BASEMAPS }


const SRC_TERRAIN = 'terrain-dem'

/**
 * Turn the 3D view on or off. The DEM source is added lazily so a session
 * that never opens 3D never fetches an elevation tile.
 */
export function setTerrain(map: MLMap, on: boolean): void {
  if (on && !map.getSource(SRC_TERRAIN)) {
    map.addSource(SRC_TERRAIN, {
      type: 'raster-dem',
      tiles: [TERRAIN.url],
      encoding: TERRAIN.encoding,
      tileSize: TERRAIN.tileSize,
      maxzoom: TERRAIN.maxzoom,
      attribution: TERRAIN.attribution,
    })
  }
  map.setTerrain(on ? { source: SRC_TERRAIN, exaggeration: 1.3 } : null)
  map.easeTo({ pitch: on ? 62 : 0, duration: 600 })
}


/** Layers that make up the waypoint display, for the global on/off switch. */
export const WAYPOINT_LAYERS = [
  'waypoint-circle',
  'waypoint-label',
  'waypoint-selected',
  'waypoint-hit',
]
