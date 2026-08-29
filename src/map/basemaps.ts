export interface Basemap {
  id: string
  label: string
  tiles: string[]
  attribution: string
  maxzoom: number
  /** Notes shown in the UI where a source has usage limits. */
  note?: string
}

/**
 * Key-free raster sources only, so the app stays a static site.
 * OSM's own tiles are rate-limited and their policy discourages public
 * deployments — swap this for your own tile URL before promoting the site.
 */
export const BASEMAPS: Basemap[] = [
  {
    id: 'osm',
    label: 'OpenStreetMap',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '© OpenStreetMap contributors',
    maxzoom: 19,
    note: 'OSM 官方圖磚有使用政策限制，正式站台請改用自訂網址',
  },
  {
    id: 'opentopo',
    label: 'OpenTopoMap 地形',
    tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'],
    attribution: '© OpenTopoMap (CC-BY-SA), © OpenStreetMap contributors',
    maxzoom: 17,
  },
  {
    id: 'esri-imagery',
    label: '衛星影像 (Esri)',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ],
    attribution: 'Esri, Maxar, Earthstar Geographics',
    maxzoom: 19,
  },
  {
    id: 'nlsc-emap',
    label: '臺灣通用電子地圖 (NLSC)',
    tiles: ['https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}'],
    attribution: '© 內政部國土測繪中心',
    maxzoom: 20,
  },
]

const CUSTOM_KEY = 'custom'

export function customBasemap(url: string): Basemap {
  return {
    id: CUSTOM_KEY,
    label: '自訂圖磚',
    tiles: [url],
    attribution: '自訂來源',
    maxzoom: 22,
  }
}

export function findBasemap(id: string, customUrl: string | null): Basemap {
  if (id === CUSTOM_KEY && customUrl) return customBasemap(customUrl)
  return BASEMAPS.find((b) => b.id === id) ?? (BASEMAPS[0] as Basemap)
}

/**
 * Elevation tiles for the 3D view. AWS Open Data's terrarium set is free and
 * needs no key; MapLibre decodes the 'terrarium' encoding natively.
 */
export const TERRAIN = {
  url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  encoding: 'terrarium' as const,
  tileSize: 256,
  maxzoom: 15,
  attribution: 'Terrain: AWS Open Data / Mapzen',
}
