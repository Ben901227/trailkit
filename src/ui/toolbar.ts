import { canRedo, canUndo, redo, undo } from '../model/history'
import { setEditing } from '../model/store'
import type { AppState } from '../model/types'
import { clear, h } from './dom'

export interface ToolbarHooks {
  exportDocs: () => void
  mergeTracks: () => void
  openLayers: () => void
  openFiles: (files: File[]) => void
  fitAll: () => void
  togglePanel: () => void
}

export function renderToolbar(host: HTMLElement, state: AppState, hooks: ToolbarHooks): void {
  clear(host)

  const input = h('input', {
    type: 'file',
    multiple: true,
    // Mobile pickers filter unreliably, so accept anything and sniff the content.
    accept: '.gpx,.kml,.kmz,.geojson,.json,.png,.jpg,.jpeg,image/*',
    style: 'display:none',
  }) as HTMLInputElement
  input.addEventListener('change', () => {
    if (input.files?.length) hooks.openFiles(Array.from(input.files))
    input.value = ''
  })

  const undoBtn = h('button.icon', { title: '復原 (⌘Z)', onclick: () => undo() }, '↶')
  const redoBtn = h('button.icon', { title: '重做 (⇧⌘Z)', onclick: () => redo() }, '↷')
  ;(undoBtn as HTMLButtonElement).disabled = !canUndo()
  ;(redoBtn as HTMLButtonElement).disabled = !canRedo()

  host.append(
    h('span.title', {}, 'GPX / KML'),
    h('button.primary', { onclick: () => input.click() }, '開啟檔案'),
    input,
    h('button', { onclick: hooks.mergeTracks, title: '合併多條軌跡' }, '合併'),
    h('button', { onclick: hooks.exportDocs, title: '匯出檔案' }, '匯出'),
    undoBtn,
    redoBtn,
    h(
      'button' + (state.editing ? '.primary' : ''),
      {
        title: state.selection?.kind === 'track' ? '編輯選取的軌跡' : '先選一條軌跡',
        onclick: () => setEditing(!state.editing),
      },
      state.editing ? '編輯中' : '編輯',
    ),
    h('button', { onclick: hooks.fitAll, title: '縮放到全部內容' }, '全覽'),
    h('span.spacer'),
    h('button.layers-shortcut', { onclick: hooks.openLayers, title: '底圖與疊加圖層' }, '圖層'),
    h('button.sheet-toggle', { onclick: hooks.togglePanel }, '面板'),
  )
}
