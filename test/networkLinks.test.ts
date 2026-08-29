import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import { extractNetworkLayers } from '../src/io/networkLinks'

const parse = (t: string) => new DOMParser().parseFromString(t, 'text/xml') as unknown as Document

const kml = (inner: string) =>
  parse(`<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>${inner}</Document></kml>`)

const link = (name: string, href: string) =>
  `<NetworkLink><name>${name}</name><Link><href>${href}</href></Link></NetworkLink>`

describe('extractNetworkLayers', () => {
  it('turns an Academia Sinica super-overlay into its tile URL', () => {
    const { layers } = extractNetworkLayers(
      kml(link('1989-臺灣經建1版地形圖', 'http://gis.sinica.edu.tw/googlemap/TM25K_1989/LOD.kml')),
    )
    expect(layers).toHaveLength(1)
    expect(layers[0]!.url).toBe(
      'https://gis.sinica.edu.tw/tileserver/file-exists.php?img=TM25K_1989-png-{z}-{x}-{y}',
    )
    expect(layers[0]!.name).toBe('1989-臺灣經建1版地形圖')
  })

  it('upgrades the link to https, since the app is served over https', () => {
    const { layers } = extractNetworkLayers(
      kml(link('rudy', 'http://tile.happyman.idv.tw/mp/kml/rudy/gm_grid/6/53/36.kml')),
    )
    expect(layers[0]!.url.startsWith('https://')).toBe(true)
  })

  it('drops the grid coordinates from the layer name', () => {
    const { layers } = extractNetworkLayers(
      kml(link('rudy - (53, 36, 6)', 'http://tile.happyman.idv.tw/mp/kml/rudy/gm_grid/6/53/36.kml')),
    )
    expect(layers[0]!.name).toBe('rudy')
  })

  it('collapses the many grid tiles of one layer into a single layer', () => {
    const { layers } = extractNetworkLayers(
      kml(
        link('rudy - (53, 36, 6)', 'http://tile.happyman.idv.tw/mp/kml/rudy/gm_grid/6/53/36.kml') +
          link('rudy - (107, 71, 7)', 'http://tile.happyman.idv.tw/mp/kml/rudy/gm_grid/7/107/71.kml'),
      ),
    )
    expect(layers).toHaveLength(1)
  })

  it('reports a layer it cannot translate instead of guessing a URL', () => {
    const { layers, unsupported } = extractNetworkLayers(
      kml(link('rudy_twmap', 'http://tile.happyman.idv.tw/mp/kml/rudy_twmap/gm_grid/6/53/36.kml')),
    )
    expect(layers).toHaveLength(0)
    expect(unsupported[0]).toContain('rudy_twmap')
  })

  it('reports an unrelated network link rather than dropping it silently', () => {
    const { unsupported } = extractNetworkLayers(kml(link('別處', 'https://example.com/x.kml')))
    expect(unsupported[0]).toContain('別處')
  })
})
