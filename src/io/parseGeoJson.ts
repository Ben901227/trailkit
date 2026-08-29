import type { FeatureCollection } from 'geojson'
import { normalize } from './normalize'
import { buildDoc, type ParseResult } from './parseGpx'

export function geoJsonToDoc(text: string, name: string): ParseResult {
  const parsed = JSON.parse(text) as unknown
  const fc = toCollection(parsed)
  return buildDoc(name, 'geojson', normalize(fc))
}

function toCollection(value: unknown): FeatureCollection {
  const v = value as { type?: string }
  if (v?.type === 'FeatureCollection') return value as FeatureCollection
  if (v?.type === 'Feature')
    return { type: 'FeatureCollection', features: [value as FeatureCollection['features'][number]] }
  if (typeof v?.type === 'string')
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: value as never }],
    }
  throw new Error('Not recognisable GeoJSON')
}
