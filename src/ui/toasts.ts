let host: HTMLElement | null = null

export function initToasts(el: HTMLElement): void {
  host = el
}

export function toast(message: string, kind: 'info' | 'error' = 'info'): void {
  if (!host) return
  const el = document.createElement('div')
  el.className = `toast ${kind}`
  el.textContent = message
  host.appendChild(el)
  setTimeout(() => el.remove(), kind === 'error' ? 6000 : 3200)
}
