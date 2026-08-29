import type { TileLayer } from '../model/types'

/**
 * Layers worth having without importing a KML first.
 *
 * The list, the names and the sheet ids are taken from a Google Earth
 * 魯地圖+航跡圖 export, so every entry is one the services actually publish
 * rather than a URL guessed at from a pattern.
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

export const HIKING_GROUP = '登山圖資'
export const HISTORY_GROUP = '百年歷史地圖'

/**
 * Academia Sinica serves each sheet in one format only, and asking for the
 * wrong one returns a blank placeholder tile rather than an error — a layer
 * that quietly draws nothing. Each of these was checked against the service.
 */
export const SINICA_TILE_FORMAT: Record<string, 'png' | 'jpg'> = {
  JM400K_1899: 'png',
  JM20K_1904: 'jpg',
  JM100K_1905: 'png',
  JM50K_1916: 'jpg',
  JM50K_1920: 'png',
  JM25K_1921: 'png',
  JM20K_1921: 'jpg',
  JM50K_1924: 'jpg',
  JM300K_1924: 'png',
  JM300K_1939: 'png',
  AM25K_1944A: 'png',
  AM50K_1944: 'png',
  AMCityPlan_1945: 'png',
  '1956_Landuse': 'png',
  TM50K_1956: 'jpg',
  TM25K_1966: 'png',
  TM100K_1987: 'png',
  TM25K_1989: 'jpg',
  TM25K_1993: 'jpg',
  TM25K_2001: 'jpg',
  TM25K_2003: 'jpg',
}

export function sinicaTileUrl(id: string): string {
  const format = SINICA_TILE_FORMAT[id] ?? 'png'
  return `https://gis.sinica.edu.tw/tileserver/file-exists.php?img=${id}-${format}-{z}-{x}-{y}`
}

function happyman(id: string, name: string): CatalogEntry {
  return {
    id,
    name,
    group: HIKING_GROUP,
    url: `https://tile.happyman.idv.tw/map/${id}/{z}/{x}/{y}.png`,
    minzoom: 0,
    maxzoom: 16,
    attribution: '魯地圖 (Happyman)',
  }
}

function sinica(id: string, name: string): CatalogEntry {
  return {
    id,
    name,
    group: HISTORY_GROUP,
    url: sinicaTileUrl(id),
    minzoom: 0,
    maxzoom: 16,
    attribution: '中央研究院 GIS 專題中心',
    bounds: TAIWAN,
  }
}

export const TILE_CATALOG: CatalogEntry[] = [
  happyman('rudy', '魯地圖 - 彩色版'),
  happyman('moi_osm', '魯地圖 - 紙圖版'),
  happyman('rudy_bn', '魯地圖 - 黑白'),
  happyman('rudy_en', '魯地圖 - 英文'),
  happyman('happyman', 'Happyman GPX 疊圖'),
  happyman('forest', '林班界'),
  sinica('JM400K_1899', '1899-日治臺灣全圖-1:400,000'),
  sinica('JM20K_1904', '1904-日治臺灣堡圖(明治版)-1:20,000'),
  sinica('JM100K_1905', '1905-日治臺灣圖-1:100,000'),
  sinica('JM50K_1916', '1916-日治蕃地地形圖-1:50,000'),
  sinica('JM50K_1920', '1920-日治地形圖(總督府土木局)-1:50,000'),
  sinica('JM25K_1921', '1921-日治地形圖-1:25,000'),
  sinica('JM20K_1921', '1921-日治臺灣堡圖(大正版)-1:20,000'),
  sinica('JM50K_1924', '1924-日治地形圖(陸地測量部)-1:50,000'),
  sinica('JM300K_1924', '1924-日治臺灣全圖(第三版)-1:300,000'),
  sinica('JM300K_1939', '1939-日治臺灣全圖(第五版)-1:300,000'),
  sinica('AM25K_1944A', '1944-美軍地形圖-1:25,000'),
  sinica('AM50K_1944', '1944-美軍地形圖-1:50,000'),
  sinica('AMCityPlan_1945', '1945-美軍繪製臺灣城市地圖'),
  sinica('1956_Landuse', '1956-臺灣土地利用及林型圖'),
  sinica('TM50K_1956', '1956-臺灣地形圖-1:50,000'),
  sinica('TM25K_1966', '1957~1969-臺灣二萬五千分一地形圖'),
  sinica('TM100K_1987', '1987-臺灣地形圖-1:100,000'),
  sinica('TM25K_1989', '1989-臺灣經建1版地形圖-1:25,000'),
  sinica('TM25K_1993', '1993-臺灣經建2版地形圖-1:25,000'),
  sinica('TM25K_2001', '2001-臺灣經建3版地形圖-1:25,000'),
  sinica('TM25K_2003', '2003-臺灣經建4版地形圖-1:25,000'),
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
