import { formatDistance, formatTime, trackStats } from '../model/stats'
import { update } from '../model/store'
import type { AppState } from '../model/types'
import { findOverlay, findTile, findTrack, findWaypoint } from '../model/types'
import { clear, h } from './dom'
import { trackActions, waypointActions } from './trackEditor'

function stats(rows: [string, string][]): HTMLElement {
  const dl = h('dl.stats')
  for (const [key, value] of rows) {
    dl.append(h('dt', {}, key), h('dd', {}, value))
  }
  return dl
}

function patchTile(docId: string, id: string, patch: Partial<{ opacity: number; tms: boolean }>): void {
  update((s) => ({
    ...s,
    docs: s.docs.map((d) =>
      d.id === docId
        ? { ...d, tiles: d.tiles.map((t) => (t.id === id ? { ...t, ...patch } : t)) }
        : d,
    ),
  }))
}

function opacitySlider(value: number, onChange: (opacity: number) => void): HTMLElement {
  const wrap = h('div')
  const slider = h('input', {
    type: 'range',
    min: '0',
    max: '100',
    value: String(Math.round(value * 100)),
  }) as HTMLInputElement
  slider.addEventListener('input', () => onChange(Number(slider.value) / 100))
  wrap.append(h('label', {}, '透明度'), slider)
  return wrap
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
      trackActions(state, sel, track),
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
    host.append(waypointActions(sel, wpt.name, wpt.description))
    return
  }

  if (sel.kind === 'tile') {
    const tile = findTile(state, sel.docId, sel.id)
    if (!tile) return
    host.append(
      h('h3', {}, tile.name),
      stats([
        ['縮放範圍', `z${tile.minzoom} – z${tile.maxzoom}`],
        ['Y 軸', tile.tms ? 'TMS（由南往北）' : 'XYZ（由北往南）'],
      ]),
      h('p.url', { title: tile.url }, tile.url),
      opacitySlider(tile.opacity, (opacity) =>
        patchTile(sel.docId, sel.id, { opacity }),
      ),
      h(
        'div.actions',
        {},
        h(
          'button',
          { onclick: () => patchTile(sel.docId, sel.id, { tms: !tile.tms }) },
          '切換 Y 軸方向',
        ),
        h('p.hint', {}, '圖磚上下顛倒或對不上時，切換這個開關。'),
      ),
    )
    return
  }

  const overlay = findOverlay(state, sel.docId, sel.id)
  if (!overlay) return
  host.append(
    h('h3', {}, overlay.name),
    opacitySlider(overlay.opacity, (opacity) => {
      update((s) => ({
        ...s,
        docs: s.docs.map((d) =>
          d.id === sel.docId
            ? { ...d, overlays: d.overlays.map((o) => (o.id === sel.id ? { ...o, opacity } : o)) }
            : d,
        ),
      }))
    }),
  )
}
