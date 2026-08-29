import { BASEMAPS } from '../map/basemaps'
import {
  DEFAULT_LAYER_OPACITY,
  TILE_CATALOG,
  layerFromCatalog,
  type CatalogEntry,
} from '../map/tileCatalog'
import {
  addLayers,
  setImageOverlays,
  setShowPeaks,
  setShowWaypointLabels,
  setShowWaypoints,
  moveLayer,
  patchLayer,
  removeLayer,
  setBasemap,
  setCustomBasemapUrl,
} from '../model/store'
import type { AppState, TileLayer } from '../model/types'
import { clear, h } from './dom'
import { icon } from './icons'
import { keepAlive } from './panelLock'
import { toast } from './toasts'

function basemapPicker(state: AppState): HTMLElement {
  const select = h('select') as HTMLSelectElement
  for (const b of BASEMAPS) select.append(h('option', { value: b.id }, b.label))
  select.append(h('option', { value: 'custom' }, '自訂圖磚網址…'))
  select.value = state.basemapId
  select.addEventListener('change', () => {
    if (select.value === 'custom') {
      const url = window.prompt('輸入 XYZ 圖磚網址，例如 https://example.com/{z}/{x}/{y}.png')
      if (!url) {
        select.value = state.basemapId
        return
      }
      setCustomBasemapUrl(url)
    }
    setBasemap(select.value)
  })

  const box = h('div.layer-section')
  box.append(h('div.section-label', {}, '底圖'), select)
  return box
}

function layerRow(layer: TileLayer, index: number, total: number): HTMLElement {
  const row = h('div.layer')

  const check = h('input', { type: 'checkbox' }) as HTMLInputElement
  check.checked = layer.visible
  check.addEventListener('change', () => patchLayer(layer.id, { visible: check.checked }))

  const slider = h('input.opacity', {
    type: 'range',
    min: '0',
    max: '100',
    step: '5',
    value: String(Math.round(layer.opacity * 100)),
    title: '不透明度：往右更不透明',
    'aria-label': `${layer.name} 不透明度`,
  }) as HTMLInputElement
  const readout = h('span.meta', {}, `${Math.round(layer.opacity * 100)}%`)
  keepAlive(slider)
  slider.addEventListener('input', () => {
    // The panel is locked while dragging, so update the readout by hand.
    readout.textContent = `${slider.value}%`
    patchLayer(layer.id, { opacity: Number(slider.value) / 100 })
  })

  const up = h('button.icon', {
    title: '上移一層',
    onclick: () => moveLayer(layer.id, 1),
  }, icon('chevronUp')) as HTMLButtonElement
  up.disabled = index === total - 1

  const down = h('button.icon', {
    title: '下移一層',
    onclick: () => moveLayer(layer.id, -1),
  }, icon('chevronDown')) as HTMLButtonElement
  down.disabled = index === 0

  row.append(
    h('div.layer-head', {}, check, h('span.name', { title: layer.origin }, layer.name), up, down,
      h('button.icon.danger', { title: '移除圖層', onclick: () => removeLayer(layer.id) }, icon('close'))),
    h('div.layer-controls', {}, slider, readout),
  )
  return row
}

/** Past this many, a list of buttons is a wall; use a dropdown instead. */
const CHIP_LIMIT = 8

function addFromCatalog(entry: CatalogEntry): void {
  if (addLayers([layerFromCatalog(entry)]).length === 0) toast('這個圖層已經在清單裡了')
}

function chipGroup(entries: CatalogEntry[], have: Set<string>): HTMLElement {
  const chips = h('div.chips')
  for (const entry of entries) {
    const btn = h('button', {
      title: have.has(entry.url) ? '已在圖層清單中' : entry.attribution,
      onclick: () => addFromCatalog(entry),
    }) as HTMLButtonElement
    btn.textContent = entry.name
    btn.disabled = have.has(entry.url)
    chips.append(btn)
  }
  return chips
}

function selectGroup(entries: CatalogEntry[], have: Set<string>): HTMLElement {
  const select = h('select') as HTMLSelectElement
  select.append(h('option', { value: '' }, `選一個加入…（${entries.length} 張）`))
  for (const entry of entries) {
    const option = h('option', { value: entry.id }, entry.name) as HTMLOptionElement
    option.disabled = have.has(entry.url)
    select.append(option)
  }
  select.addEventListener('change', () => {
    const entry = entries.find((e) => e.id === select.value)
    if (entry) addFromCatalog(entry)
    select.value = ''
  })
  return select
}

function catalogPicker(state: AppState): HTMLElement {
  const box = h('div.layer-section')
  box.append(h('div.section-label', {}, '加入圖層'))

  const have = new Set(state.layers.map((l) => l.url))
  const groups = new Map<string, CatalogEntry[]>()
  for (const entry of TILE_CATALOG) {
    const list = groups.get(entry.group) ?? []
    list.push(entry)
    groups.set(entry.group, list)
  }

  for (const [group, entries] of groups) {
    box.append(
      h('div.group-label', {}, group),
      entries.length > CHIP_LIMIT ? selectGroup(entries, have) : chipGroup(entries, have),
    )
  }
  return box
}

function toggleRow(
  label: string,
  checked: boolean,
  onChange: (on: boolean) => void,
  disabled = false,
): HTMLElement {
  const check = h('input', { type: 'checkbox' }) as HTMLInputElement
  check.checked = checked
  check.disabled = disabled
  check.addEventListener('change', () => onChange(check.checked))
  return h('label.toggle-row', {}, check, h('span', {}, label))
}

function waypointSettings(state: AppState): HTMLElement {
  const box = h('div.layer-section')
  const total = state.docs.reduce((n, d) => n + d.waypoints.length, 0)
  box.append(
    h('div.section-label', {}, `航點 (${total})`),
    toggleRow('在地圖上顯示航點', state.showWaypoints, setShowWaypoints),
    toggleRow('顯示航點名稱', state.showWaypointLabels, setShowWaypointLabels, !state.showWaypoints),
  )
  if (!total) box.append(h('p.hint', {}, '目前開啟的檔案沒有航點。'))
  return box
}

function peakSettings(state: AppState): HTMLElement {
  const box = h('div.layer-section')
  box.append(
    h('div.section-label', {}, '臺灣山頭'),
    toggleRow('顯示山頭（3,669 座）', state.showPeaks, setShowPeaks),
    h('p.hint', {}, '內建清單，離線也能用；放大到一定程度才會標出名稱與高程。'),
  )
  return box
}

function overlaySettings(state: AppState): HTMLElement {
  const box = h('div.layer-section')
  const count = state.docs.reduce((n, d) => n + d.overlays.length, 0)
  box.append(
    h('div.section-label', {}, '圖片疊圖'),
    toggleRow('顯示圖片疊圖，並可拖入圖片', state.imageOverlays, setImageOverlays),
    h(
      'p.hint',
      {},
      count
        ? `目前開啟的檔案帶有 ${count} 個圖片疊圖，打開才會顯示。`
        : '關閉時，拖進來的圖片會被忽略，KML/KMZ 內的 GroundOverlay 也不會畫出來。',
    ),
  )
  return box
}

export function renderLayersPanel(host: HTMLElement, state: AppState): void {
  clear(host)
  host.append(
    basemapPicker(state),
    peakSettings(state),
    waypointSettings(state),
    overlaySettings(state),
  )

  const stack = h('div.layer-section')
  stack.append(h('div.section-label', {}, `疊加圖層 (${state.layers.length})`))
  if (!state.layers.length) {
    stack.append(h('p.hint', {}, '還沒有疊加圖層。從下方加入，或匯入含圖磚圖層的 KML。'))
  } else {
    // Top of the list is the top of the map, so render the stack reversed.
    for (let i = state.layers.length - 1; i >= 0; i--) {
      stack.append(layerRow(state.layers[i] as TileLayer, i, state.layers.length))
    }
    stack.append(
      h('p.hint', {}, `新加入的圖層預設 ${Math.round(DEFAULT_LAYER_OPACITY * 100)}% 不透明，可用滑桿調整。`),
    )
  }
  host.append(stack, catalogPicker(state))
}
