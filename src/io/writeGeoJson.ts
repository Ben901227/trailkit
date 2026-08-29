import type { Feature, FeatureCollection } from 'geojson'
import type { Doc } from '../model/types'

export function writeGeoJson(docs: Doc[]): string {
  const features: Feature[] = []
  for (const doc of docs) {
    for (const t of doc.tracks) {
      features.push({
        type: 'Feature',
        geometry: t.geometry,
        properties: {
          name: t.name,
          stroke: t.color,
          source: doc.name,
          ...(t.props.times ? { coordinateProperties: { times: t.props.times } } : {}),
          ...(t.extra ?? {}),
        },
      })
    }
    for (const w of doc.waypoints) {
      features.push({
        type: 'Feature',
        geometry: w.geometry,
        properties: {
          name: w.name,
          ...(w.description ? { description: w.description } : {}),
          source: doc.name,
          ...(w.extra ?? {}),
        },
      })
    }
  }
  const fc: FeatureCollection = { type: 'FeatureCollection', features }
  return JSON.stringify(fc, null, 2)
}
