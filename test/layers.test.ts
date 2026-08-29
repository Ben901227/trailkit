import { beforeEach, describe, expect, it } from 'vitest'
import { TILE_CATALOG, layerFromCatalog } from '../src/map/tileCatalog'
import { addLayers, getState, moveLayer, patchLayer, removeLayer, update } from '../src/model/store'

const rudy = layerFromCatalog(TILE_CATALOG[0]!)
const sinica = layerFromCatalog(TILE_CATALOG[4]!)

beforeEach(() => {
  update((s) => ({ ...s, layers: [] }))
})

describe('the shared layer stack', () => {
  it('ignores a layer whose tile URL is already in the stack', () => {
    expect(addLayers([rudy])).toHaveLength(1)
    expect(addLayers([{ ...rudy, id: 'other', name: '魯地圖（副本）' }])).toHaveLength(0)
    expect(getState().layers).toHaveLength(1)
  })

  it('adds new layers on top', () => {
    addLayers([rudy, sinica])
    expect(getState().layers.map((l) => l.id)).toEqual([rudy.id, sinica.id])
  })

  it('moves a layer up and down without disturbing the rest', () => {
    addLayers([rudy, sinica])
    moveLayer(rudy.id, 1)
    expect(getState().layers.map((l) => l.id)).toEqual([sinica.id, rudy.id])
    moveLayer(rudy.id, -1)
    expect(getState().layers.map((l) => l.id)).toEqual([rudy.id, sinica.id])
  })

  it('refuses to move past either end', () => {
    addLayers([rudy, sinica])
    moveLayer(rudy.id, -1)
    moveLayer(sinica.id, 1)
    expect(getState().layers.map((l) => l.id)).toEqual([rudy.id, sinica.id])
  })

  it('patches opacity and visibility in place', () => {
    addLayers([rudy])
    patchLayer(rudy.id, { opacity: 0.25, visible: false })
    expect(getState().layers[0]!.opacity).toBe(0.25)
    expect(getState().layers[0]!.visible).toBe(false)
  })

  it('removes a layer', () => {
    addLayers([rudy, sinica])
    removeLayer(rudy.id)
    expect(getState().layers.map((l) => l.id)).toEqual([sinica.id])
  })

  it('starts every catalogue layer semi-transparent', () => {
    for (const entry of TILE_CATALOG) {
      expect(layerFromCatalog(entry).opacity).toBeLessThan(1)
    }
  })
})
