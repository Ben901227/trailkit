import { gpx } from '@tmcw/togeojson'
import type { Doc, TileLayer } from '../model/types'
import { newId } from './ids'
import { normalize, type Normalized } from './normalize'

export interface ParseResult {
  doc: Doc
  /** Raster layers the file defined; these join the shared layer stack. */
  tiles: TileLayer[]
  skipped: string[]
  /** Things the reader worked around, worth telling the user about. */
  warnings: string[]
}

function build(name: string, format: Doc['sourceFormat'], n: Normalized): ParseResult {
  return {
    doc: {
      id: newId('doc'),
      name,
      sourceFormat: format,
      tracks: n.tracks,
      waypoints: n.waypoints,
      overlays: [],
    },
    tiles: [],
    skipped: n.skipped,
    warnings: [],
  }
}

export function gpxToDoc(xml: Document, name: string): ParseResult {
  return build(name, 'gpx', normalize(gpx(xml)))
}

export { build as buildDoc }
