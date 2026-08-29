import type { ControlPosition, IControl, Map as MLMap } from 'maplibre-gl'

const SIZE = 62

/**
 * A compass rose beside the scale bar. The built-in control only shows a
 * needle; once Shift-drag can swing the camera it is worth naming the
 * directions outright, and it doubles as the way back to north.
 */
export class CompassControl implements IControl {
  private map: MLMap | null = null
  private container: HTMLElement | null = null
  private rose: HTMLElement | null = null

  onAdd(map: MLMap): HTMLElement {
    this.map = map

    const container = document.createElement('div')
    // Not a ctrl-group: the rose draws its own dial, and the group's white
    // square would box it in.
    container.className = 'maplibregl-ctrl compass-ctrl'

    const button = document.createElement('button')
    button.type = 'button'
    button.title = '轉回正北'
    button.setAttribute('aria-label', '轉回正北')
    button.addEventListener('click', () => map.easeTo({ bearing: 0, duration: 400 }))

    const rose = document.createElement('div')
    rose.className = 'compass-rose'
    rose.innerHTML = ROSE_SVG
    button.append(rose)
    container.append(button)

    this.container = container
    this.rose = rose
    this.update()
    map.on('rotate', this.update)
    map.on('pitch', this.update)
    return container
  }

  onRemove(): void {
    this.map?.off('rotate', this.update)
    this.map?.off('pitch', this.update)
    this.container?.remove()
    this.map = null
  }

  getDefaultPosition(): ControlPosition {
    return 'bottom-left'
  }

  private update = (): void => {
    if (!this.map || !this.rose) return
    // Lean with the camera, but only a hint of it: matching the pitch outright
    // squashes the dial into an ellipse and the labels stop being readable,
    // which defeats the point of naming the directions.
    const lean = Math.min(this.map.getPitch() * 0.3, 20)
    this.rose.style.transform = `rotateX(${lean}deg) rotate(${-this.map.getBearing()}deg)`
  }
}

/** Labels turn with the rose, the way the face of a real compass does. */
const ROSE_SVG = `
<svg viewBox="0 0 100 100" width="${SIZE}" height="${SIZE}" aria-hidden="true">
  <circle cx="50" cy="50" r="47" fill="var(--surface)" stroke="var(--line)" stroke-width="2"/>
  <g stroke="var(--line)" stroke-width="1">
    <line x1="50" y1="16" x2="50" y2="84"/>
    <line x1="16" y1="50" x2="84" y2="50"/>
  </g>
  <polygon points="50,22 43,52 57,52" fill="#d64545"/>
  <polygon points="50,78 43,48 57,48" fill="#98a2b3"/>
  <g font-size="16" font-weight="700" text-anchor="middle"
     font-family="system-ui, sans-serif" fill="var(--ink)">
    <text x="50" y="19">N</text>
    <text x="50" y="89">S</text>
    <text x="82" y="56">E</text>
    <text x="18" y="56">W</text>
  </g>
</svg>`
