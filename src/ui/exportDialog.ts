import { buildExport, type ExportFormat, type ExportScope } from '../io/exportDocs'
import { saveFile } from '../io/download'
import { getState } from '../model/store'
import { findOverlay, findTrack, findWaypoint, type AppState } from '../model/types'
import { h } from './dom'
import { toast } from './toasts'

const FORMATS: { id: ExportFormat; label: string; hint: string }[] = [
  { id: 'gpx', label: 'GPX', hint: '軌跡與點位，相容度最高' },
  { id: 'kml', label: 'KML', hint: 'Google Earth；疊圖只存路徑' },
  { id: 'kmz', label: 'KMZ', hint: 'KML + 疊圖圖片一起打包' },
  { id: 'geojson', label: 'GeoJSON', hint: '給 GIS 工具使用' },
]

const SCOPES: { id: ExportScope; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'visible', label: '僅顯示中' },
  { id: 'selection', label: '僅選取項目' },
]

/** What "僅選取項目" would actually export right now, if anything. */
function selectionName(state: AppState): string | null {
  const sel = state.selection
  if (!sel) return null
  if (sel.kind === 'track') return findTrack(state, sel.docId, sel.id)?.name ?? null
  if (sel.kind === 'waypoint') return findWaypoint(state, sel.docId, sel.id)?.name ?? null
  return findOverlay(state, sel.docId, sel.id)?.name ?? null
}

export interface ExportPreset {
  /** Pre-scope the dialog to one file, as the download button in the list does. */
  docId: string
  filename: string
}

export function openExportDialog(preset?: ExportPreset): void {
  const state = getState()
  if (!state.docs.length) {
    toast('尚未開啟任何檔案')
    return
  }

  const backdrop = h('div.modal-backdrop')
  const box = h('div.modal')

  const format = h('div.chips')
  let chosenFormat: ExportFormat = 'gpx'
  const formatButtons = FORMATS.map((f) => {
    const btn = h('button', {
      title: f.hint,
      'aria-pressed': String(f.id === chosenFormat),
      onclick: () => {
        chosenFormat = f.id
        formatButtons.forEach((b, i) =>
          b.setAttribute('aria-pressed', String(FORMATS[i]!.id === chosenFormat)),
        )
      },
    })
    btn.textContent = f.label
    format.append(btn)
    return btn
  })

  const selected = selectionName(state)
  const scope = h('div.chips')
  let chosenScope: ExportScope = preset ? 'doc' : 'all'
  const scopeNote = h('p.hint')

  const describeScope = () => {
    scopeNote.textContent =
      chosenScope === 'selection'
        ? selected
          ? `將只匯出「${selected}」`
          : ''
        : chosenScope === 'doc' && preset
          ? `將只匯出「${preset.filename}」`
          : ''
  }

  const scopes = preset
    ? [{ id: 'doc' as ExportScope, label: `僅這個檔案` }, ...SCOPES]
    : SCOPES

  const scopeButtons = scopes.map((s) => {
    const btn = h('button', {
      'aria-pressed': String(s.id === chosenScope),
      onclick: () => {
        chosenScope = s.id
        scopeButtons.forEach((b, i) =>
          b.setAttribute('aria-pressed', String(scopes[i]!.id === chosenScope)),
        )
        describeScope()
      },
    }) as HTMLButtonElement
    btn.textContent = s.label
    // Offering a scope that cannot produce a file is a dead end.
    if (s.id === 'selection' && !selected) {
      btn.disabled = true
      btn.title = '先在地圖或檔案清單點一條軌跡、點位或疊圖'
    }
    scope.append(btn)
    return btn
  })

  const nameInput = h('input.text', {
    type: 'text',
    value: (preset?.filename ?? state.docs[0]?.name ?? 'export').replace(/\.[^.]+$/, ''),
  }) as HTMLInputElement

  const close = () => backdrop.remove()

  const run = async () => {
    try {
      const result = await buildExport(getState(), {
        format: chosenFormat,
        scope: chosenScope,
        filename: nameInput.value,
        ...(preset ? { docId: preset.docId } : {}),
      })
      for (const w of result.warnings) toast(w, 'error')
      const how = await saveFile(result.blob, result.filename)
      toast(how === 'shared' ? `已分享 ${result.filename}` : `已下載 ${result.filename}`)
      close()
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
    }
  }

  box.append(
    h('h3', {}, '匯出'),
    h('label', {}, '格式'),
    format,
    h('label', {}, '範圍'),
    scope,
    scopeNote,
    h('label', {}, '檔名'),
    nameInput,
    h(
      'div.modal-actions',
      {},
      h('button', { onclick: close }, '取消'),
      h('button.primary', { onclick: () => void run() }, '匯出'),
    ),
  )

  describeScope()
  backdrop.append(box)
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close()
  })
  document.body.append(backdrop)
}
