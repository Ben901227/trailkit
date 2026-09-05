/**
 * Desktop sidebar collapse.
 *
 * Purely a view concern, so it lives beside the other UI-local flags rather
 * than in AppState — the same way the active tab and the mobile sheet do.
 * Only the desktop layout reacts to the class; on mobile the panel is a
 * bottom sheet with its own show/hide.
 */

const KEY = 'gpx-editor:sidebar:v1'

let collapsed = false

export function isSidebarCollapsed(): boolean {
  return collapsed
}

function apply(): void {
  document.body.classList.toggle('panel-collapsed', collapsed)
}

export function initSidebar(): void {
  try {
    collapsed = localStorage.getItem(KEY) === '1'
  } catch {
    // Private mode; the panel simply starts expanded.
  }
  apply()
}

export function toggleSidebar(next?: boolean): void {
  collapsed = next ?? !collapsed
  apply()
  try {
    localStorage.setItem(KEY, collapsed ? '1' : '0')
  } catch {
    // Private mode or a full quota; the choice just does not persist.
  }
}
