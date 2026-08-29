import {
  deleteOverlay,
  deletePoints,
  deleteTrack,
  deleteWaypoint,
  renameTrack,
  reverseTrack,
  splitTrack,
  trimTrack,
  updateWaypoint,
} from '../model/commands'
import { checkpoint } from '../model/history'
import { patchOverlay } from '../model/commands'
import { getState, setDocs, setEditing, setSelection, setVertex } from '../model/store'
import type { AppState, Selection, Track } from '../model/types'
import { h } from './dom'
import { toast } from './toasts'

function act(label: string, fn: (docs: AppState['docs']) => AppState['docs']): void {
  checkpoint(label)
  setDocs(fn(getState().docs))
  toast(label)
}

/** Editing actions for the selected track, including the tapped point. */
export function trackActions(state: AppState, sel: Selection & { kind: 'track' }, track: Track): HTMLElement {
  const box = h('div.actions')
  const vertex = state.vertex
  const total = track.geometry.coordinates.length

  if (!state.editing) {
    box.append(
      h(
        'button.primary',
        { onclick: () => setEditing(true) },
        '進入編輯模式',
      ),
      h('p.hint', {}, '編輯模式下：拖曳圓點移動、點軌跡線插入新點、點圓點選取該點。'),
    )
    return box
  }

  box.append(
    h(
      'button',
      {
        onclick: () => act(`反轉方向：${track.name}`, (docs) => reverseTrack(docs, sel.docId, sel.id)),
      },
      '反轉方向',
    ),
    h(
      'button',
      {
        onclick: () => {
          const name = window.prompt('軌跡名稱', track.name)
          if (name && name !== track.name) {
            act(`重新命名：${name}`, (docs) => renameTrack(docs, sel.docId, sel.id, name))
          }
        },
      },
      '重新命名',
    ),
    h(
      'button.danger',
      {
        onclick: () => {
          if (!window.confirm(`刪除軌跡「${track.name}」？`)) return
          act(`刪除軌跡：${track.name}`, (docs) => deleteTrack(docs, sel.docId, sel.id))
          setSelection(null)
        },
      },
      '刪除軌跡',
    ),
  )

  if (vertex === null) {
    box.append(h('p.hint', {}, '點一下軌跡上的圓點，即可刪除該點、從該點分割或剪裁。'))
    return box
  }

  box.append(
    h('p.hint', {}, `已選第 ${vertex + 1} / ${total} 點`),
    h(
      'button',
      {
        onclick: () => {
          act(`刪除第 ${vertex + 1} 點`, (docs) => deletePoints(docs, sel.docId, sel.id, [vertex]))
          setVertex(null)
        },
      },
      '刪除此點',
    ),
    h(
      'button',
      {
        onclick: () => {
          if (vertex <= 0 || vertex >= total - 1) {
            toast('端點無法分割', 'error')
            return
          }
          act(`分割：${track.name}`, (docs) => splitTrack(docs, sel.docId, sel.id, vertex))
          setSelection(null)
        },
      },
      '從此分割',
    ),
    h(
      'button',
      {
        onclick: () => {
          act(`保留前段（1–${vertex + 1}）`, (docs) => trimTrack(docs, sel.docId, sel.id, 0, vertex))
          setVertex(null)
        },
      },
      '只保留前段',
    ),
    h(
      'button',
      {
        onclick: () => {
          act(`保留後段（${vertex + 1}–${total}）`, (docs) =>
            trimTrack(docs, sel.docId, sel.id, vertex, total - 1),
          )
          setVertex(null)
        },
      },
      '只保留後段',
    ),
  )
  return box
}

export function waypointActions(sel: Selection & { kind: 'waypoint' }, name: string, description: string | undefined): HTMLElement {
  const box = h('div.actions')
  box.append(
    h(
      'button',
      {
        onclick: () => {
          const next = window.prompt('名稱', name)
          if (next && next !== name) {
            act(`重新命名：${next}`, (docs) => updateWaypoint(docs, sel.docId, sel.id, { name: next }))
          }
        },
      },
      '重新命名',
    ),
    h(
      'button',
      {
        onclick: () => {
          const next = window.prompt('說明', description ?? '')
          if (next !== null) {
            act('編輯說明', (docs) => updateWaypoint(docs, sel.docId, sel.id, { description: next }))
          }
        },
      },
      '編輯說明',
    ),
    h(
      'button.danger',
      {
        onclick: () => {
          act(`刪除點位：${name}`, (docs) => deleteWaypoint(docs, sel.docId, sel.id))
          setSelection(null)
        },
      },
      '刪除點位',
    ),
    h('p.hint', {}, '編輯模式下可直接拖曳地圖上的點位移動位置。'),
  )
  return box
}

/** Calibration controls for an image overlay. */
export function overlayActions(
  state: AppState,
  sel: Selection & { kind: 'overlay' },
  name: string,
  viewportBounds: () => [number, number, number, number] | null,
): HTMLElement {
  const box = h('div.actions')

  if (!state.editing) {
    box.append(
      h('button.primary', { onclick: () => setEditing(true) }, '進入編輯模式'),
      h('p.hint', {}, '編輯模式下可拖曳四個藍色角點校正，或拖曳圖面整張移動。'),
    )
    return box
  }

  box.append(
    h(
      'button',
      {
        onclick: () => {
          const bounds = viewportBounds()
          if (!bounds) return
          const [west, south, east, north] = bounds
          act(`重設疊圖範圍：${name}`, (docs) =>
            patchOverlay(docs, sel.docId, sel.id, {
              corners: [
                [west, north],
                [east, north],
                [east, south],
                [west, south],
              ],
            }),
          )
        },
      },
      '貼齊目前畫面',
    ),
    h(
      'button',
      {
        onclick: () => {
          const next = window.prompt('疊圖名稱', name)
          if (next && next !== name) {
            act(`重新命名：${next}`, (docs) => patchOverlay(docs, sel.docId, sel.id, { name: next }))
          }
        },
      },
      '重新命名',
    ),
    h(
      'button.danger',
      {
        onclick: () => {
          if (!window.confirm(`刪除疊圖「${name}」？`)) return
          act(`刪除疊圖：${name}`, (docs) => deleteOverlay(docs, sel.docId, sel.id))
          setSelection(null)
        },
      },
      '刪除疊圖',
    ),
    h('p.hint', {}, '拖曳角點做四角校正；四角可自由變形，不限矩形。'),
  )
  return box
}
