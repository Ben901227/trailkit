import { gpx } from '@tmcw/togeojson'
import type { Doc } from '../model/types'
import { newId } from './ids'
import { normalize, type Normalized } from './normalize'

export interface ParseResult {
  doc: Doc
  skipped: string[]
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
      tiles: [],
    },
    skipped: n.skipped,
  }
}

export function gpxToDoc(xml: Document, name: string): ParseResult {
  return build(name, 'gpx', normalize(gpx(xml)))
}

export { build as buildDoc }
