import type { Map as MLMap } from 'maplibre-gl'

/** Degrees of camera movement per pixel dragged. */
const ROTATE_PER_PX = 0.4
const PITCH_PER_PX = 0.4

export const MAX_PITCH = 85

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Google Earth's look-around gesture: hold Shift or ⌘ and drag to swing the
 * camera — sideways rotates, up and down tilts.
 *
 * MapLibre binds Shift+drag to box zoom and ⌘/Ctrl+drag to its own rotate,
 * neither of which matches. Box zoom is turned off and this handler owns both
 * modifiers so the gesture behaves the same either way.
 */
export function installCameraTool(map: MLMap): void {
  map.boxZoom.disable()

  let drag: { x: number; y: number; bearing: number; pitch: number } | null = null

  map.getCanvasContainer().addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !(e.shiftKey || e.metaKey)) return
    e.preventDefault()
    // Stop the pan that this same mousedown would otherwise start.
    map.dragPan.disable()
    drag = { x: e.clientX, y: e.clientY, bearing: map.getBearing(), pitch: map.getPitch() }
  })

  // On window, so the swing keeps up with a cursor dragged off the canvas.
  window.addEventListener('mousemove', (e) => {
    if (!drag) return
    map.jumpTo({
      bearing: drag.bearing + (e.clientX - drag.x) * ROTATE_PER_PX,
      pitch: clamp(drag.pitch - (e.clientY - drag.y) * PITCH_PER_PX, 0, MAX_PITCH),
    })
  })

  const end = () => {
    if (!drag) return
    drag = null
    map.dragPan.enable()
  }
  window.addEventListener('mouseup', end)
  window.addEventListener('blur', end)
}

/** True while a modifier that means "move the camera" is held. */
export function isCameraModifier(e: { shiftKey?: boolean; metaKey?: boolean }): boolean {
  return Boolean(e.shiftKey || e.metaKey)
}
