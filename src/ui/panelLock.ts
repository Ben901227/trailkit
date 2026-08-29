/**
 * A continuous control — a slider being dragged, a field being typed into — is
 * destroyed if the panel rebuilds under it, which ends the drag after the first
 * pixel. While such a control is in use the panel defers its re-render.
 */
let locked = false
let flush: (() => void) | null = null

export function isPanelLocked(): boolean {
  return locked
}

/** Registered by the panel: catch up on whatever state arrived while locked. */
export function onPanelUnlock(fn: () => void): void {
  flush = fn
}

export function lockPanel(): void {
  locked = true
}

export function unlockPanel(): void {
  if (!locked) return
  locked = false
  flush?.()
}

/** Keep this control from being rebuilt while it is being used. */
export function keepAlive(el: HTMLElement): void {
  el.addEventListener('focus', lockPanel)
  el.addEventListener('blur', unlockPanel)
  el.addEventListener('pointerdown', () => {
    lockPanel()
    // The pointer is usually released outside the element, so listen wide.
    window.addEventListener('pointerup', unlockPanel, { once: true })
    window.addEventListener('pointercancel', unlockPanel, { once: true })
  })
}
