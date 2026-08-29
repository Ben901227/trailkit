import { checkpoint, checkpointCoalesced } from '../model/history'
import { removeDoc, setSelection, setTrackColor, setVisible } from '../model/store'
import { formatDistance, trackStats } from '../model/stats'
import type { AppState, Selection } from '../model/types'
import { selectionKey } from '../model/types'
import { CAMERA_HINT, clear, h } from './dom'

export interface PanelHooks {
  zoomTo: (sel: Selection) => void
  mergeTracks: () => void
  exportDocs: () => void
  /** Current map view as [west, south, east, north], for snapping overlays. */
  viewportBounds: () => [number, number, number, number] | null
}

/**
 * A single GPX can hold hundreds of waypoints, so documents collapse by
 * default past this size — otherwise every state change re-renders thousands
 * of rows.
 */
const AUTO_COLLAPSE_ITEMS = 12

const expanded = new Set<string>()
const collapsed = new Set<string>()

function isExpanded(docId: string, itemCount: number): boolean {
  if (expanded.has(docId)) return true
  if (collapsed.has(docId)) return false
  return itemCount <= AUTO_COLLAPSE_ITEMS
}

function toggleDoc(docId: string, itemCount: number): void {
  if (isExpanded(docId, itemCount)) {
    expanded.delete(docId)
    collapsed.add(docId)
  } else {
    collapsed.delete(docId)
    expanded.add(docId)
  }
}

function itemRow(
  state: AppState,
  sel: Selection,
  label: string,
  meta: string | null,
  visible: boolean,
  hooks: PanelHooks,
  color?: { value: string; onChange: (c: string) => void },
): HTMLElement {
  const selected = state.selection && selectionKey(state.selection) === selectionKey(sel)
  const row = h('div.item' + (selected ? '.selected' : ''), {
    onclick: () => setSelection(sel),
  })

  const check = h('input', { type: 'checkbox' }) as HTMLInputElement
  check.checked = visible
  check.addEventListener('click', (e) => e.stopPropagation())
  check.addEventListener('change', () => setVisible(sel, check.checked))
  row.append(check)

  if (color) {
    const picker = h('input', { type: 'color', value: color.value }) as HTMLInputElement
    picker.addEventListener('click', (e) => e.stopPropagation())
    picker.addEventListener('input', () => {
      // A colour drag fires continuously; keep it to one undo step.
      checkpointCoalesced(`改變顏色：${label}`)
      color.onChange(picker.value)
    })
    row.append(picker)
  }

  row.append(h('span.name', { title: label }, label))
  if (meta) row.append(h('span.meta', {}, meta))
  row.append(
    h(
      'button.icon',
      {
        title: '縮放到此圖層',
        onclick: (e: Event) => {
          e.stopPropagation()
          hooks.zoomTo(sel)
        },
      },
      '⤢',
    ),
  )
  return row
}

export function renderLayerPanel(host: HTMLElement, state: AppState, hooks: PanelHooks): void {
  clear(host)

  if (!state.docs.length) {
    host.append(
      h(
        'div.empty',
        {},
        '尚未開啟檔案。點上方「開啟檔案」，或把 GPX / KML / KMZ / 圖片拖進來。',
      ),
      h('p.hint', {}, CAMERA_HINT),
    )
    return
  }

  host.append(
    h(
      'div.panel-actions',
      {},
      h('button', { onclick: hooks.mergeTracks }, '合併'),
      h('button', { onclick: hooks.exportDocs }, '匯出'),
      h(
        'button.danger',
        {
          onclick: () => {
            if (!window.confirm('關閉全部檔案？（圖層設定會保留）')) return
            checkpoint('關閉全部檔案')
            for (const doc of [...state.docs]) removeDoc(doc.id)
          },
        },
        '關閉全部',
      ),
    ),
  )

  for (const doc of state.docs) {
    const itemCount = doc.tracks.length + doc.waypoints.length + doc.overlays.length
    const open = isExpanded(doc.id, itemCount)
    const card = h('div.doc')
    card.append(
      h(
        'div.doc-head',
        {
          onclick: () => {
            toggleDoc(doc.id, itemCount)
            renderLayerPanel(host, state, hooks)
          },
        },
        h('span.caret', {}, open ? '▾' : '▸'),
        h('span.name', { title: doc.name }, doc.name),
        h('span.tag', {}, `${itemCount} 項`),
        h(
          'button.icon.danger',
          {
          title: '關閉此檔案',
          onclick: (e: Event) => {
            e.stopPropagation()
            checkpoint(`關閉 ${doc.name}`)
            removeDoc(doc.id)
          },
        },
          '✕',
        ),
      ),
    )

    if (!open) {
      host.append(card)
      continue
    }

    if (doc.tracks.length) card.append(h('div.section-label', {}, `軌跡 (${doc.tracks.length})`))
    for (const track of doc.tracks) {
      const stats = trackStats(track)
      card.append(
        itemRow(
          state,
          { kind: 'track', docId: doc.id, id: track.id },
          track.name,
          formatDistance(stats.distance),
          track.visible,
          hooks,
          { value: track.color, onChange: (c) => setTrackColor(doc.id, track.id, c) },
        ),
      )
    }

    if (doc.waypoints.length) card.append(h('div.section-label', {}, `點位 (${doc.waypoints.length})`))
    for (const wpt of doc.waypoints) {
      card.append(
        itemRow(
          state,
          { kind: 'waypoint', docId: doc.id, id: wpt.id },
          wpt.name,
          null,
          wpt.visible,
          hooks,
        ),
      )
    }

    if (doc.overlays.length) card.append(h('div.section-label', {}, `疊圖 (${doc.overlays.length})`))
    for (const overlay of doc.overlays) {
      card.append(
        itemRow(
          state,
          { kind: 'overlay', docId: doc.id, id: overlay.id },
          overlay.name,
          `${Math.round(overlay.opacity * 100)}%`,
          overlay.visible,
          hooks,
        ),
      )
    }

    host.append(card)
  }
}
