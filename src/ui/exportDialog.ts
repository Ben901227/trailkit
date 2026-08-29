import { buildExport, type ExportFormat, type ExportScope } from '../io/exportDocs'
import { saveFile } from '../io/download'
import { getState } from '../model/store'
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

export function openExportDialog(): void {
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

  const scope = h('div.chips')
  let chosenScope: ExportScope = 'all'
  const scopeButtons = SCOPES.map((s) => {
    const btn = h('button', {
      'aria-pressed': String(s.id === chosenScope),
      onclick: () => {
        chosenScope = s.id
        scopeButtons.forEach((b, i) =>
          b.setAttribute('aria-pressed', String(SCOPES[i]!.id === chosenScope)),
        )
      },
    })
    btn.textContent = s.label
    scope.append(btn)
    return btn
  })

  const nameInput = h('input.text', {
    type: 'text',
    value: (state.docs[0]?.name ?? 'export').replace(/\.[^.]+$/, ''),
  }) as HTMLInputElement

  const close = () => backdrop.remove()

  const run = async () => {
    try {
      const result = await buildExport(getState(), {
        format: chosenFormat,
        scope: chosenScope,
        filename: nameInput.value,
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
    h('label', {}, '檔名'),
    nameInput,
    h(
      'div.modal-actions',
      {},
      h('button', { onclick: close }, '取消'),
      h('button.primary', { onclick: () => void run() }, '匯出'),
    ),
  )

  backdrop.append(box)
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close()
  })
  document.body.append(backdrop)
}
