import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import { detectFormat } from '../src/io/detect'
import { gpxToDoc } from '../src/io/parseGpx'
import { kmlToDoc } from '../src/io/parseKml'
import { kmzToDoc } from '../src/io/parseKmz'

const parse = (t: string) => new DOMParser().parseFromString(t, 'text/xml') as unknown as Document
// KMZ overlay images become object URLs, which Node has no notion of.
const globalUrl = URL as unknown as { createObjectURL?: () => string }
globalUrl.createObjectURL ??= () => 'blob:stub'

const DIR = 'test data'


// A folder of real-world exports from GPS apps and Google Earth. It is not
// checked in, so the suite skips rather than fails when it is absent.
describe.skipIf(!existsSync(DIR))('real-world files', () => {
it('imports every one of them without dropping content', async () => {
  const rows: string[] = []
  let failures = 0
  for (const name of readdirSync(DIR).filter((n) => !n.startsWith('.')).sort()) {
    const buf = readFileSync(`${DIR}/${name}`)
    const bytes = new Uint8Array(buf)
    const head = new TextDecoder().decode(bytes.slice(0, 2048))
    const fmt = detectFormat(name, head, bytes)
    const t0 = Date.now()
    try {
      let r
      if (fmt === 'kmz') r = await kmzToDoc(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), name, parse)
      else if (fmt === 'gpx') r = gpxToDoc(parse(new TextDecoder().decode(bytes)), name)
      else if (fmt === 'kml') r = kmlToDoc(parse(new TextDecoder().decode(bytes)), name, () => null)
      else throw new Error('unrecognised')
      const pts = r.doc.tracks.reduce((n, t) => n + t.geometry.coordinates.length, 0)
      rows.push(`${fmt}\t${Date.now() - t0}ms\ttrk=${r.doc.tracks.length}(${pts}pt) wpt=${r.doc.waypoints.length} tile=${r.tiles.length} ovl=${r.doc.overlays.length} skip=${r.skipped.length}\t${name}`)
      if (r.skipped.length) rows.push(`   skipped: ${r.skipped.slice(0, 3).join(' ; ')}`)
      expect(
        r.doc.tracks.length + r.doc.waypoints.length + r.tiles.length + r.doc.overlays.length,
        `${name} produced nothing`,
      ).toBeGreaterThan(0)
      expect(r.skipped, `${name} skipped content`).toEqual([])
    } catch (e) {
      failures += 1
      rows.push(`FAIL\t${name}\t${e instanceof Error ? e.message : e}`)
    }
  }
  console.log('\n' + rows.join('\n'))
  expect(failures, 'files that failed to open').toBe(0)
}, 120000)
})
