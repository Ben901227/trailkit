import { checkpoint } from '../model/history'
import { concatIntoDoc, joinGaps, mergeIntoDoc, resolveRefs, type TrackRef } from '../model/merge'
import { formatDistance } from '../model/stats'
import { getState, setDocs } from '../model/store'
import { h } from './dom'
import { toast } from './toasts'

interface Row extends TrackRef {
  label: string
  chosen: boolean
}

function allTracks(): Row[] {
  const rows: Row[] = []
  for (const doc of getState().docs) {
    for (const track of doc.tracks) {
      rows.push({
        docId: doc.id,
        trackId: track.id,
        reversed: false,
        chosen: false,
        label: `${track.name} — ${doc.name}`,
      })
    }
  }
  return rows
}

export function openMergeDialog(): void {
  const rows = allTracks()
  if (rows.length < 2) {
    toast('至少要有兩條軌跡才能合併', 'error')
    return
  }

  const backdrop = h('div.modal-backdrop')
  const box = h('div.modal')
  const list = h('div.merge-list')
  const selectAll = h('div.merge-toolbar')
  const summary = h('p.hint')
  const nameInput = h('input.text', { type: 'text', value: '合併結果' }) as HTMLInputElement

  const chosen = () => rows.filter((r) => r.chosen)

  function setAll(value: boolean): void {
    for (const row of rows) row.chosen = value
    render()
  }

  function move(index: number, direction: -1 | 1): void {
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    const [row] = rows.splice(index, 1)
    rows.splice(target, 0, row as Row)
    render()
  }

  function updateSummary(): void {
    const picked = chosen()
    if (picked.length < 2) {
      summary.textContent = '勾選兩條以上的軌跡。上下箭頭決定接龍順序，→ 可反轉單條方向。'
      return
    }
    const gaps = joinGaps(resolveRefs(getState().docs, picked))
    const worst = Math.max(...gaps)
    summary.textContent =
      `已選 ${picked.length} 條。首尾相接時最大接縫距離 ${formatDistance(worst)}` +
      (worst > 500 ? '——距離不小，確認順序與方向是否正確。' : '。')
  }

  function render(): void {
    list.replaceChildren()
    rows.forEach((row, index) => {
      const item = h('div.merge-row' + (row.chosen ? '.chosen' : ''))

      const check = h('input', { type: 'checkbox' }) as HTMLInputElement
      check.checked = row.chosen
      check.addEventListener('change', () => {
        // Update in place: re-rendering the list here would detach the very
        // checkbox the user is clicking through.
        row.chosen = check.checked
        item.classList.toggle('chosen', row.chosen)
        updateSummary()
      })

      const reverse = h('button.icon', {
        title: '反轉這條的方向',
        onclick: () => {
          row.reversed = !row.reversed
          reverse.textContent = row.reversed ? '⇄' : '→'
          reverse.classList.toggle('on', row.reversed)
          updateSummary()
        },
      }, row.reversed ? '⇄' : '→') as HTMLButtonElement
      reverse.classList.toggle('on', row.reversed)

      item.append(
        check,
        h('span.name', { title: row.label }, row.label),
        reverse,
        h('button.icon', { title: '上移', onclick: () => move(index, -1) }, '▲'),
        h('button.icon', { title: '下移', onclick: () => move(index, 1) }, '▼'),
      )
      list.append(item)
    })
    updateSummary()
  }

  const close = () => backdrop.remove()

  function run(kind: 'merge' | 'concat'): void {
    const picked = chosen()
    if (picked.length < 2) {
      toast('請勾選至少兩條軌跡', 'error')
      return
    }
    const name = nameInput.value.trim() || '合併結果'
    const label = kind === 'merge' ? `合成一檔：${name}` : `首尾相接：${name}`
    checkpoint(label)
    const docs = getState().docs
    setDocs(kind === 'merge' ? mergeIntoDoc(docs, picked, name) : concatIntoDoc(docs, picked, name))
    toast(label)
    close()
  }

  selectAll.append(
    h('span.meta', {}, `共 ${rows.length} 條軌跡`),
    h('button', { onclick: () => setAll(true) }, '全選'),
    h('button', { onclick: () => setAll(false) }, '全不選'),
  )

  box.append(
    h('h3', {}, '合併軌跡'),
    selectAll,
    list,
    summary,
    h('label', {}, '新檔案名稱'),
    nameInput,
    h(
      'div.modal-actions',
      {},
      h('button', { onclick: close }, '取消'),
      h('button', { onclick: () => run('merge'), title: '各軌跡維持獨立' }, '合成一檔'),
      h('button.primary', { onclick: () => run('concat'), title: '串成單一軌跡' }, '首尾相接'),
    ),
  )

  render()
  backdrop.append(box)
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close()
  })
  document.body.append(backdrop)
}
