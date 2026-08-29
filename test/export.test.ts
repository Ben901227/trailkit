import { describe, expect, it } from 'vitest'
import { buildExport } from '../src/io/exportDocs'
import type { AppState, Doc } from '../src/model/types'

function track(id: string, visible: boolean) {
  return {
    id,
    name: id,
    color: '#ff0000',
    visible,
    geometry: { type: 'LineString' as const, coordinates: [[121, 24], [121.1, 24.1]] },
    props: {},
  }
}

const doc: Doc = {
  id: 'd1',
  name: 'demo.gpx',
  sourceFormat: 'gpx',
  tracks: [track('t1', true), track('t2', false)],
  waypoints: [],
  overlays: [
    {
      id: 'o1',
      name: '疊圖',
      visible: true,
      opacity: 0.8,
      corners: [[121, 24.2], [121.2, 24.2], [121.2, 24], [121, 24]],
      url: 'blob:fake',
    },
  ],
}

const state: AppState = { docs: [doc], selection: null, basemapId: 'osm', customBasemapUrl: null, layers: [], editing: false, terrain: false, showWaypoints: true, showWaypointLabels: true, imageOverlays: false, vertex: null }

async function textOf(scope: 'all' | 'visible' | 'selection', format: 'gpx' | 'geojson' = 'gpx') {
  const result = await buildExport(state, { format, scope, filename: 'out' })
  return { text: await result.blob.text(), warnings: result.warnings, filename: result.filename }
}

describe('buildExport', () => {
  it('includes every track when the scope is "all"', async () => {
    const { text, filename } = await textOf('all')
    expect(filename).toBe('out.gpx')
    expect(text).toContain('<name>t1</name>')
    expect(text).toContain('<name>t2</name>')
  })

  it('drops hidden tracks when the scope is "visible"', async () => {
    const { text } = await textOf('visible')
    expect(text).toContain('<name>t1</name>')
    expect(text).not.toContain('<name>t2</name>')
  })

  it('exports only the selected item', async () => {
    const selected: AppState = { ...state, selection: { kind: 'track', docId: 'd1', id: 't2' } }
    const result = await buildExport(selected, { format: 'gpx', scope: 'selection', filename: 'x' })
    const text = await result.blob.text()
    expect(text).toContain('<name>t2</name>')
    expect(text).not.toContain('<name>t1</name>')
  })

  it('warns that GPX cannot carry overlays instead of dropping them silently', async () => {
    const { warnings } = await textOf('all')
    expect(warnings.join()).toContain('疊圖')
  })

  it('refuses to build an empty export', async () => {
    const empty: AppState = { docs: [], selection: null, basemapId: 'osm', customBasemapUrl: null, layers: [], editing: false, terrain: false, showWaypoints: true, showWaypointLabels: true, imageOverlays: false, vertex: null }
    await expect(buildExport(empty, { format: 'gpx', scope: 'all', filename: 'x' })).rejects.toThrow()
  })

  it('replaces the extension rather than appending one', async () => {
    const result = await buildExport(state, { format: 'geojson', scope: 'all', filename: 'route.gpx' })
    expect(result.filename).toBe('route.geojson')
  })
})

describe('export scope "selection"', () => {
  it('exports just the selected waypoint', async () => {
    const withWaypoint: AppState = {
      ...state,
      docs: [
        {
          ...doc,
          waypoints: [
            {
              id: 'w1',
              name: '桃山',
              visible: true,
              geometry: { type: 'Point', coordinates: [121, 24] },
            },
          ],
        },
      ],
      selection: { kind: 'waypoint', docId: 'd1', id: 'w1' },
    }
    const result = await buildExport(withWaypoint, { format: 'gpx', scope: 'selection', filename: 'x' })
    const text = await result.blob.text()
    expect(text).toContain('桃山')
    expect(text).not.toContain('<name>t1</name>')
  })

  it('says what to select rather than failing blankly', async () => {
    await expect(
      buildExport(state, { format: 'gpx', scope: 'selection', filename: 'x' }),
    ).rejects.toThrow('尚未選取任何項目')
  })
})

describe('image overlays default to off', () => {
  it('still exports an overlay a file brought, so the switch only affects display', async () => {
    const result = await buildExport(
      { ...state, imageOverlays: false },
      { format: 'kml', scope: 'all', filename: 'x' },
    )
    expect(await result.blob.text()).toContain('疊圖')
  })
})
