import { BASEMAPS } from '../map/basemaps'
import { setBasemap } from '../model/store'
import type { AppState } from '../model/types'
import { clear, h } from './dom'

export interface ToolbarHooks {
  openFiles: (files: File[]) => void
  fitAll: () => void
  togglePanel: () => void
  setCustomBasemap: (url: string | null) => void
}

export function renderToolbar(host: HTMLElement, state: AppState, hooks: ToolbarHooks): void {
  clear(host)

  const input = h('input', {
    type: 'file',
    multiple: true,
    // Mobile pickers filter unreliably, so accept anything and sniff the content.
    accept: '.gpx,.kml,.kmz,.geojson,.json,application/gpx+xml,application/vnd.google-earth.kml+xml',
    style: 'display:none',
  }) as HTMLInputElement
  input.addEventListener('change', () => {
    if (input.files?.length) hooks.openFiles(Array.from(input.files))
    input.value = ''
  })

  const select = h('select', { title: '底圖' }) as HTMLSelectElement
  for (const b of BASEMAPS) {
    select.append(h('option', { value: b.id }, b.label))
  }
  select.append(h('option', { value: 'custom' }, '自訂圖磚網址…'))
  select.value = state.basemapId
  select.addEventListener('change', () => {
    if (select.value === 'custom') {
      const url = window.prompt('輸入 XYZ 圖磚網址，例如 https://example.com/{z}/{x}/{y}.png')
      if (!url) {
        select.value = state.basemapId
        return
      }
      hooks.setCustomBasemap(url)
    }
    setBasemap(select.value)
  })

  host.append(
    h('span.title', {}, 'GPX / KML'),
    h('button.primary', { onclick: () => input.click() }, '開啟檔案'),
    input,
    h('button', { onclick: hooks.fitAll, title: '縮放到全部內容' }, '全覽'),
    h('span.spacer'),
    select,
    h('button.sheet-toggle', { onclick: hooks.togglePanel }, '圖層'),
  )
}
