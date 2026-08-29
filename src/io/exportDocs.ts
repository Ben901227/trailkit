import type { AppState, Doc, Selection } from '../model/types'
import { writeGeoJson } from './writeGeoJson'
import { writeGpx } from './writeGpx'
import { writeKml } from './writeKml'
import { writeKmz } from './writeKmz'

export type ExportFormat = 'gpx' | 'kml' | 'kmz' | 'geojson'
export type ExportScope = 'all' | 'visible' | 'selection'

export interface ExportRequest {
  format: ExportFormat
  scope: ExportScope
  filename: string
}

export interface ExportResult {
  blob: Blob
  filename: string
  /** Content that the chosen format cannot represent, for warning the user. */
  warnings: string[]
}

function pick(state: AppState, scope: ExportScope): Doc[] {
  if (scope === 'all') return state.docs
  if (scope === 'visible') {
    return state.docs
      .map((d) => ({
        ...d,
        tracks: d.tracks.filter((t) => t.visible),
        waypoints: d.waypoints.filter((w) => w.visible),
        overlays: d.overlays.filter((o) => o.visible),
        tiles: d.tiles.filter((t) => t.visible),
      }))
      .filter((d) => d.tracks.length || d.waypoints.length || d.overlays.length || d.tiles.length)
  }

  const sel: Selection | null = state.selection
  if (!sel) return []
  const doc = state.docs.find((d) => d.id === sel.docId)
  if (!doc) return []
  return [
    {
      ...doc,
      tracks: sel.kind === 'track' ? doc.tracks.filter((t) => t.id === sel.id) : [],
      waypoints: sel.kind === 'waypoint' ? doc.waypoints.filter((w) => w.id === sel.id) : [],
      overlays: sel.kind === 'overlay' ? doc.overlays.filter((o) => o.id === sel.id) : [],
      tiles: sel.kind === 'tile' ? doc.tiles.filter((t) => t.id === sel.id) : [],
    },
  ]
}

const MIME: Record<ExportFormat, string> = {
  gpx: 'application/gpx+xml',
  kml: 'application/vnd.google-earth.kml+xml',
  kmz: 'application/vnd.google-earth.kmz',
  geojson: 'application/geo+json',
}

export async function buildExport(state: AppState, req: ExportRequest): Promise<ExportResult> {
  const docs = pick(state, req.scope)
  if (!docs.length) throw new Error('沒有可匯出的內容')

  const warnings: string[] = []
  const tiles = docs.reduce((n, d) => n + d.tiles.length, 0)
  if (tiles && req.format !== 'kml' && req.format !== 'kmz') {
    warnings.push(`只有 KML/KMZ 能保存圖磚圖層，${tiles} 個圖層未包含`)
  }

  const overlays = docs.reduce((n, d) => n + d.overlays.length, 0)
  if (overlays && req.format !== 'kmz' && req.format !== 'kml') {
    warnings.push(`${req.format.toUpperCase()} 無法儲存疊圖，${overlays} 個疊圖未包含`)
  }
  if (overlays && req.format === 'kml') {
    warnings.push('KML 只會引用疊圖圖片的路徑；要一起打包請匯出 KMZ')
  }

  const base = req.filename.replace(/\.[^.]+$/, '') || 'export'
  const filename = `${base}.${req.format}`

  if (req.format === 'kmz') {
    return { blob: await writeKmz(docs, base), filename, warnings }
  }

  const text =
    req.format === 'gpx'
      ? writeGpx(docs, base)
      : req.format === 'kml'
        ? writeKml(docs, base)
        : writeGeoJson(docs)
  return { blob: new Blob([text], { type: MIME[req.format] }), filename, warnings }
}
