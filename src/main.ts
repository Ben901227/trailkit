import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'

import type { Map as MLMap } from 'maplibre-gl'
import { colorForIndex } from './io/ids'
import { docFromOverlays, isImageFile, overlayFromImage } from './io/imageOverlay'
import { loadFiles } from './io/loadFile'
import { applyBasemap, createMap, fitTo, setTerrain } from './map/mapView'
import { syncOverlayLayers } from './map/overlayLayers'
import { syncTileLayers } from './map/tileLayers'
import { syncCornerLayer, syncTrackLayers, syncVertexLayer, visiblePositions } from './map/trackLayers'
import { bounds } from './model/stats'
import { checkpoint, onHistoryChange, redo, undo } from './model/history'
import { loadLayerPreferences, saveLayerPreferences } from './model/persist'
import { loadSession, saveSession } from './model/session'
import { addDocs, addLayers, getState, setSelection, subscribe } from './model/store'
import { selectionKey, type AppState, type Selection } from './model/types'
import { installCameraTool } from './edit/cameraTool'
import { installVertexTool } from './edit/vertexTool'
import { openExportDialog } from './ui/exportDialog'
import { openMergeDialog } from './ui/mergeDialog'
import { renderPanel, setTab, togglePanel } from './ui/panel'
import { initDropZone } from './ui/dropZone'
import { initToasts, toast } from './ui/toasts'
import { renderToolbar } from './ui/toolbar'

const mapEl = document.getElementById('map') as HTMLElement
const panelEl = document.getElementById('panel') as HTMLElement
const toolbarEl = document.getElementById('toolbar') as HTMLElement
initToasts(document.getElementById('toasts') as HTMLElement)

let lastBasemapId = `${getState().basemapId}|`
let map: MLMap | null = null
// Map sources only exist once the style has loaded; renders before that are UI-only.
let styleReady = false
let terrainOn = false

function positionsFor(state: AppState, sel: Selection) {
  const doc = state.docs.find((d) => d.id === sel.docId)
  if (!doc) return []
  if (sel.kind === 'track') return doc.tracks.find((t) => t.id === sel.id)?.geometry.coordinates ?? []
  if (sel.kind === 'waypoint') {
    const w = doc.waypoints.find((x) => x.id === sel.id)
    return w ? [w.geometry.coordinates] : []
  }
  return doc.overlays.find((o) => o.id === sel.id)?.corners ?? []
}

const hooks = {
  mergeTracks: () => openMergeDialog(),
  exportDocs: () => openExportDialog(),
  zoomTo(sel: Selection) {
    const box = bounds(positionsFor(getState(), sel))
    if (box && map) fitTo(map, box)
  },
  viewportBounds(): [number, number, number, number] | null {
    if (!map) return null
    const b = map.getBounds()
    return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
  },
}

function fitAll(): void {
  const box = bounds(visiblePositions(getState()))
  if (!box) {
    toast('目前沒有可顯示的內容')
    return
  }
  if (map) fitTo(map, box)
}

/** Images are not a file format to parse — they are placed on the map. */
function openImages(images: File[]): boolean {
  if (!images.length || !map) return false
  const box = hooks.viewportBounds()
  if (!box) return false
  const overlays = images.map((file) => overlayFromImage(file, box))
  checkpoint(`加入疊圖 ${overlays.length} 張`)
  addDocs([docFromOverlays(overlays.length === 1 ? overlays[0]!.name : '疊圖', overlays)])
  toast('已加入疊圖。進入編輯模式後拖曳四角校正位置。')
  return true
}

async function openFiles(all: File[]): Promise<void> {
  const images = all.filter(isImageFile)
  const files = all.filter((f) => !isImageFile(f))
  const placedImages = openImages(images)

  if (!files.length) return
  const { results, errors } = await loadFiles(files)
  for (const err of errors) toast(`${err.name}：${err.message}`, 'error')

  for (const warning of results.flatMap((r) => r.warnings)) toast(warning)

  const skipped = results.flatMap((r) => r.skipped)
  if (skipped.length) {
    const more = skipped.length > 1 ? `，另有 ${skipped.length - 1} 項` : ''
    toast(`略過：${skipped[0]}${more}`, 'error')
  }

  const importedLayers = addLayers(results.flatMap((r) => r.tiles))
  if (importedLayers.length) toast(`已加入 ${importedLayers.length} 個圖磚圖層`)

  // A KML that only defines raster layers has no geometry to list as a file.
  const docs = results
    .map((r) => r.doc)
    .filter((d) => d.tracks.length || d.waypoints.length || d.overlays.length)
  if (!docs.length) {
    if (!placedImages && !importedLayers.length) toast('檔案裡沒有可顯示的內容', 'error')
    return
  }
  checkpoint('開啟檔案')

  // Continue the palette across files so two documents don't both open in red.
  let colorIndex = getState().docs.reduce((n, d) => n + d.tracks.length, 0)
  for (const doc of docs) {
    for (const track of doc.tracks) track.color = colorForIndex(colorIndex++)
  }
  addDocs(docs)

  const box = bounds(
    docs.flatMap((d) => [
      ...d.tracks.flatMap((t) => t.geometry.coordinates),
      ...d.waypoints.map((w) => w.geometry.coordinates),
      ...d.overlays.flatMap((o) => o.corners),
    ]),
  )
  if (box && map) fitTo(map, box)
  toast(`已開啟 ${docs.length} 個檔案`)
}

function render(state: AppState): void {
  renderToolbar(toolbarEl, state, {
    openFiles: (files) => void openFiles(files),
    exportDocs: openExportDialog,
    mergeTracks: openMergeDialog,
    fitAll,
    togglePanel: () => togglePanel(panelEl),
    openLayers: () => {
      setTab('layers')
      togglePanel(panelEl, true)
      renderPanel(panelEl, getState(), hooks)
    },
  })
  renderPanel(panelEl, state, hooks)

  if (!map || !styleReady) return
  const basemapKey = `${state.basemapId}|${state.customBasemapUrl ?? ''}`
  if (basemapKey !== lastBasemapId) {
    lastBasemapId = basemapKey
    applyBasemap(map, state.basemapId, state.customBasemapUrl)
  }
  if (state.terrain !== terrainOn) {
    terrainOn = state.terrain
    setTerrain(map, state.terrain)
  }
  syncTrackLayers(map, state)
  syncVertexLayer(map, state)
  syncCornerLayer(map, state)
  syncTileLayers(map, state)
  syncOverlayLayers(map, state)
}

function selectFromMap(features: maplibregl.MapGeoJSONFeature[]): void {
  const key = features[0]?.properties?.['key']
  if (typeof key !== 'string') return
  const [kind, docId, id] = key.split(':')
  if (!kind || !docId || !id) return
  setSelection({ kind, docId, id } as Selection)
  setTab('info')
  renderPanel(panelEl, getState(), hooks)
}

async function restoreSession(): Promise<void> {
  const docs = await loadSession()
  if (!docs.length || getState().docs.length) return
  addDocs(docs)
  const box = bounds(visiblePositions(getState()))
  if (box && map) fitTo(map, box)
  toast(`已還原上次的 ${docs.length} 個檔案`)
}

function installShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey
    if (!mod || e.key.toLowerCase() !== 'z') return
    const target = e.target as HTMLElement | null
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
    e.preventDefault()
    const label = e.shiftKey ? redo() : undo()
    if (label) toast(`${e.shiftKey ? '重做' : '復原'}：${label}`)
  })
}

function start(): void {
  map = createMap(mapEl, getState().basemapId)
  // 'style.load' fires as soon as the style is applied; 'load' also waits for
  // the first tiles, which never arrive when the tile host is unreachable.
  map.on('style.load', () => {
    styleReady = true
    render(getState())
  })

  // The map is created before the grid has laid out, and the mobile sheet
  // changes the viewport; keep the canvas matched to its container.
  new ResizeObserver(() => map?.resize()).observe(mapEl)

  map.on('click', (e) => {
    const state = getState()
    const hits = map!.queryRenderedFeatures(e.point, { layers: ['waypoint-hit', 'track-hit'] })

    if (state.editing) {
      // In editing mode the vertex tool owns taps on the current track; only
      // a tap on a *different* feature should change the selection.
      const current = state.selection ? selectionKey(state.selection) : ''
      const other = hits.find((f) => f.properties?.['key'] !== current)
      if (other) selectFromMap([other])
      return
    }

    if (hits.length) selectFromMap(hits)
    else setSelection(null)
  })
  for (const layer of ['waypoint-hit', 'track-hit']) {
    map.on('mouseenter', layer, () => (map!.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', layer, () => (map!.getCanvas().style.cursor = ''))
  }

  // Handy for poking at the map from the dev console; never shipped.
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>)['__map'] = map

  installCameraTool(map)
  installVertexTool(map)
  loadLayerPreferences()
  void restoreSession()

  let saveTimer: number | undefined
  let savedDocs = getState().docs
  subscribe((state) => {
    // Sliders and drags fire continuously; write at most once per idle moment.
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      saveLayerPreferences(state)
      if (state.docs !== savedDocs) {
        savedDocs = state.docs
        void saveSession(state.docs)
      }
    }, 600)
  })
  initDropZone(document.body, (files) => void openFiles(files))
  onHistoryChange(() => render(getState()))
  installShortcuts()
  subscribe(render)
  render(getState())
}

start()
