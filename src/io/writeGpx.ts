import type { Doc, Track, Waypoint } from '../model/types'

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function tag(name: string, value: string | undefined | null, indent: string): string {
  return value ? `${indent}<${name}>${escapeXml(value)}</${name}>\n` : ''
}

function coordNum(n: number): string {
  // Six decimals is ~0.1 m; more just inflates the file.
  return n.toFixed(6).replace(/\.?0+$/, '') || '0'
}

function waypointXml(w: Waypoint): string {
  const [lng = 0, lat = 0, ele] = w.geometry.coordinates
  let out = `  <wpt lat="${coordNum(lat)}" lon="${coordNum(lng)}">\n`
  if (typeof ele === 'number') out += `    <ele>${ele}</ele>\n`
  out += tag('name', w.name, '    ')
  out += tag('desc', w.description, '    ')
  out += '  </wpt>\n'
  return out
}

function trackXml(t: Track): string {
  let out = '  <trk>\n'
  out += tag('name', t.name, '    ')
  out += '    <trkseg>\n'
  t.geometry.coordinates.forEach(([lng = 0, lat = 0, ele], i) => {
    out += `      <trkpt lat="${coordNum(lat)}" lon="${coordNum(lng)}">`
    if (typeof ele === 'number') out += `<ele>${ele}</ele>`
    const time = t.props.times?.[i]
    if (time) out += `<time>${escapeXml(time)}</time>`
    out += '</trkpt>\n'
  })
  out += '    </trkseg>\n  </trk>\n'
  return out
}

/** GPX 1.1. Overlays have no GPX equivalent and are dropped; the caller warns. */
export function writeGpx(docs: Doc[], name = 'export'): string {
  let out = '<?xml version="1.0" encoding="UTF-8"?>\n'
  out += '<gpx version="1.1" creator="gpx-kml-editor" xmlns="http://www.topografix.com/GPX/1/1">\n'
  out += `  <metadata>\n${tag('name', name, '    ')}  </metadata>\n`
  for (const doc of docs) {
    for (const w of doc.waypoints) out += waypointXml(w)
  }
  for (const doc of docs) {
    for (const t of doc.tracks) out += trackXml(t)
  }
  out += '</gpx>\n'
  return out
}
