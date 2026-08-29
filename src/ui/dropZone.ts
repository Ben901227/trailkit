/** Desktop drag-and-drop. Mobile has no equivalent; the file input covers it. */
export function initDropZone(target: HTMLElement, onFiles: (files: File[]) => void): void {
  const stop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  target.addEventListener('dragover', (e) => {
    stop(e)
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  })
  target.addEventListener('drop', (e) => {
    stop(e)
    const files = Array.from(e.dataTransfer?.files ?? [])
    if (files.length) onFiles(files)
  })
}
