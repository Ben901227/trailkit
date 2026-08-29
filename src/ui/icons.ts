/**
 * Inline SVG glyphs, drawn on a 24×24 grid with a 2px round stroke.
 *
 * Deliberately hand-authored rather than pulled from an icon service: these
 * ship inside a public repository, and the common free icon licences forbid
 * redistributing the files themselves. Inline SVG also inherits the text
 * colour, so the icons follow the theme with no extra work.
 */

const PATHS = {
  download: ['M12 3v11', 'm7.5 10 4.5 4.5 4.5-4.5', 'M4.5 20.5h15'],
  eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  eyeOff: [
    'm3.5 3.5 17 17',
    'M10.7 5.7A9.3 9.3 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-3.4 4.2',
    'M6.6 6.9A17.3 17.3 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4-.9',
    'M9.9 9.9a3 3 0 0 0 4.2 4.2',
  ],
  close: ['M18 6 6 18', 'm6 6 12 12'],
  expand: ['M14.5 3.5h6v6', 'M9.5 20.5h-6v-6', 'm20.5 3.5-7.5 7.5', 'm3.5 20.5 7.5-7.5'],
  chevronUp: ['m6 14.5 6-6 6 6'],
  chevronDown: ['m6 9.5 6 6 6-6'],
  chevronRight: ['m9.5 6 6 6-6 6'],
  undo: ['M9 13.5 4.5 9 9 4.5', 'M4.5 9h9.5a5.5 5.5 0 0 1 0 11H10'],
  redo: ['M15 13.5 19.5 9 15 4.5', 'M19.5 9H10a5.5 5.5 0 0 0 0 11h4'],
  arrowRight: ['M4.5 12h14', 'm13 6.5 5.5 5.5-5.5 5.5'],
  swap: ['m16.5 4 4 4-4 4', 'M20.5 8H10', 'M7.5 20l-4-4 4-4', 'M3.5 16H14'],
  plus: ['M12 5v14', 'M5 12h14'],
} as const

export type IconName = keyof typeof PATHS

export function icon(name: IconName, size = 16): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  for (const d of PATHS[name]) {
    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', d)
    svg.append(path)
  }
  return svg
}
