import type { AppState } from '../model/types'
import { clear, h } from './dom'
import { renderInspector } from './inspector'
import { renderLayerPanel, type PanelHooks } from './layerPanel'
import { renderLayersPanel } from './layersPanel'

type Tab = 'files' | 'layers' | 'info'
let activeTab: Tab = 'files'

export function setTab(tab: Tab): void {
  activeTab = tab
}

export function isOpen(panel: HTMLElement): boolean {
  return panel.classList.contains('open')
}

export function togglePanel(panel: HTMLElement, open?: boolean): void {
  const next = open ?? !panel.classList.contains('open')
  panel.classList.toggle('open', next)
  // Lets the floating toggle move clear of the sheet on mobile.
  document.body.classList.toggle('sheet-open', next)
}

export function renderPanel(panel: HTMLElement, state: AppState, hooks: PanelHooks): void {
  clear(panel)

  const body = h('div.panel-body')
  const tabs = h('div.panel-tabs')
  const mk = (id: Tab, label: string) => {
    const btn = h('button', {
      'aria-selected': activeTab === id,
      onclick: () => {
        activeTab = id
        renderPanel(panel, state, hooks)
      },
    })
    btn.textContent = label
    return btn
  }
  tabs.append(mk('files', '檔案'), mk('layers', '圖層'), mk('info', '資訊'))
  panel.append(tabs, body)

  if (activeTab === 'files') renderLayerPanel(body, state, hooks)
  else if (activeTab === 'layers') renderLayersPanel(body, state)
  else renderInspector(body, state, hooks)
}
