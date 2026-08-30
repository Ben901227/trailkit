type Attrs = Record<string, string | number | boolean | ((e: Event) => void)>

/** Tiny element helper: h('button.primary', { onclick }, '匯出') */
export function h<K extends keyof HTMLElementTagNameMap>(
  spec: string,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const [tagAndId = 'div', ...classes] = spec.split('.')
  const [tag = 'div', id] = tagAndId.split('#')
  const el = document.createElement(tag)
  if (id) el.id = id
  if (classes.length) el.className = classes.join(' ')

  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'function') {
      el.addEventListener(key.replace(/^on/, ''), value as EventListener)
    } else if (value === false || value === undefined || value === null) {
      continue
    } else if (value === true) {
      el.setAttribute(key, '')
    } else {
      el.setAttribute(key, String(value))
    }
  }

  for (const child of children) {
    if (child === null || child === undefined) continue
    el.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return el as HTMLElementTagNameMap[K]
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild)
}

export const HELP_URL = 'https://github.com/Ben901227/trailkit#使用說明'

/** The one gesture nobody guesses; shown wherever a panel would be empty. */
export const CAMERA_HINT = '拖曳平移地圖；按住 Shift 或 ⌘（Windows 為 Ctrl）拖曳可旋轉與傾斜視角。'
