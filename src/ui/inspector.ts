import { formatDistance, formatTime, trackStats } from '../model/stats'
import { update } from '../model/store'
import type { AppState } from '../model/types'
import { findOverlay, findTrack, findWaypoint } from '../model/types'
import { clear, h } from './dom'

function stats(rows: [string, string][]): HTMLElement {
  const dl = h('dl.stats')
  for (const [key, value] of rows) {
    dl.append(h('dt', {}, key), h('dd', {}, value))
  }
  return dl
}

export function renderInspector(host: HTMLElement, state: AppState): void {
  clear(host)
  const sel = state.selection
  if (!sel) {
    host.append(h('div.empty', {}, '在地圖或圖層清單選一個項目，這裡會顯示它的資訊。'))
    return
  }

  if (sel.kind === 'track') {
    const track = findTrack(state, sel.docId, sel.id)
    if (!track) return
    const s = trackStats(track)
    host.append(
      h('h3', {}, track.name),
      stats([
        ['點數', String(s.points)],
        ['距離', formatDistance(s.distance)],
        ['爬升', s.ascent === null ? '無高度資料' : `${Math.round(s.ascent)} m`],
        ['下降', s.descent === null ? '無高度資料' : `${Math.round(s.descent)} m`],
        ['開始', formatTime(s.start)],
        ['結束', formatTime(s.end)],
      ]),
    )
    return
  }

  if (sel.kind === 'waypoint') {
    const wpt = findWaypoint(state, sel.docId, sel.id)
    if (!wpt) return
    const [lng = 0, lat = 0, ele] = wpt.geometry.coordinates
    host.append(
      h('h3', {}, wpt.name),
      stats([
        ['座標', `${lat.toFixed(6)}, ${lng.toFixed(6)}`],
        ['高度', typeof ele === 'number' ? `${Math.round(ele)} m` : '—'],
      ]),
    )
    if (wpt.description) host.append(h('p', {}, wpt.description))
    return
  }

  const overlay = findOverlay(state, sel.docId, sel.id)
  if (!overlay) return
  const slider = h('input', {
    type: 'range',
    min: '0',
    max: '100',
    value: String(Math.round(overlay.opacity * 100)),
  }) as HTMLInputElement
  slider.addEventListener('input', () => {
    const opacity = Number(slider.value) / 100
    update((s) => ({
      ...s,
      docs: s.docs.map((d) =>
        d.id === sel.docId
          ? { ...d, overlays: d.overlays.map((o) => (o.id === sel.id ? { ...o, opacity } : o)) }
          : d,
      ),
    }))
  })
  host.append(h('h3', {}, overlay.name), h('label', {}, '透明度'), slider)
}
