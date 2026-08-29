import type { TileLayer } from '../model/types'

/**
 * Layers worth having without importing a KML first. Every URL here is one
 * the sample files already point at, so they are known-good and CORS-open.
 */
export interface CatalogEntry {
  id: string
  name: string
  group: string
  url: string
  minzoom: number
  maxzoom: number
  attribution: string
  bounds?: [number, number, number, number]
}

/** Roughly Taiwan, used for the sheets that only cover it. */
const TAIWAN: [number, number, number, number] = [119.2, 21.8, 122.15, 25.7]

export const TILE_CATALOG: CatalogEntry[] = [
  {
    id: 'rudy',
    name: '魯地圖 - 彩色版',
    group: '登山圖資',
    url: 'https://tile.happyman.idv.tw/map/rudy/{z}/{x}/{y}.png',
    minzoom: 0,
    maxzoom: 16,
    attribution: '魯地圖 (Happyman)',
  },
  {
    id: 'rudy-paper',
    name: '魯地圖 - 紙圖版',
    group: '登山圖資',
    url: 'https://tile.happyman.idv.tw/map/moi_osm/{z}/{x}/{y}.png',
    minzoom: 0,
    maxzoom: 16,
    attribution: '魯地圖 (Happyman)',
  },
  {
    id: 'happyman-gpx',
    name: 'Happyman GPX 疊圖',
    group: '登山圖資',
    url: 'https://tile.happyman.idv.tw/map/happyman/{z}/{x}/{y}.png',
    minzoom: 0,
    maxzoom: 16,
    attribution: 'Happyman',
  },
  {
    id: 'forest',
    name: '林班界',
    group: '登山圖資',
    url: 'https://tile.happyman.idv.tw/map/forest/{z}/{x}/{y}.png',
    minzoom: 0,
    maxzoom: 16,
    attribution: 'Happyman',
  },
  {
    id: 'sinica-1924',
    name: '1924 日治五萬分一地形圖',
    group: '百年歷史地圖',
    url: 'https://gis.sinica.edu.tw/tileserver/file-exists.php?img=JM50K_1924_new-png-{z}-{x}-{y}',
    minzoom: 0,
    maxzoom: 16,
    attribution: '中央研究院 GIS 專題中心',
    bounds: TAIWAN,
  },
  {
    id: 'sinica-1944',
    name: '1944 美軍地形圖 1:25,000',
    group: '百年歷史地圖',
    url: 'https://gis.sinica.edu.tw/tileserver/file-exists.php?img=AM25K_1944A-png-{z}-{x}-{y}',
    minzoom: 0,
    maxzoom: 16,
    attribution: '中央研究院 GIS 專題中心',
    bounds: TAIWAN,
  },
  {
    id: 'sinica-1966',
    name: '1957–1969 臺灣二萬五千分一地形圖',
    group: '百年歷史地圖',
    url: 'https://gis.sinica.edu.tw/tileserver/file-exists.php?img=TM25K_1966-png-{z}-{x}-{y}',
    minzoom: 0,
    maxzoom: 16,
    attribution: '中央研究院 GIS 專題中心',
    bounds: TAIWAN,
  },
]

/** New layers start半透明 so the map underneath stays readable. */
export const DEFAULT_LAYER_OPACITY = 0.6

export function layerFromCatalog(entry: CatalogEntry): TileLayer {
  return {
    id: `builtin:${entry.id}`,
    name: entry.name,
    visible: true,
    opacity: DEFAULT_LAYER_OPACITY,
    url: entry.url,
    ...(entry.bounds ? { bounds: entry.bounds } : {}),
    minzoom: entry.minzoom,
    maxzoom: entry.maxzoom,
    tms: false,
    origin: entry.name,
  }
}
