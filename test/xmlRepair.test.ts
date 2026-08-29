import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import { gpxToDoc } from '../src/io/parseGpx'
import { declareMissingNamespaces, findUndeclaredPrefixes } from '../src/io/xmlRepair'

const oruxLike = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<gpx version="1.1" creator="GPX Editor" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
<trk><name>北稜</name><trkseg>
<trkpt lat="24.43" lon="121.38"><ele>1500</ele>
  <extensions><om:oruxmapsextensions xmlns:om="ignored-here-on-purpose"><om:ext type="ICON">0</om:ext></om:oruxmapsextensions></extensions>
</trkpt>
<trkpt lat="24.44" lon="121.39"><ele>1520</ele></trkpt>
</trkseg></trk>
</gpx>`.replace(' xmlns:om="ignored-here-on-purpose"', '')

describe('findUndeclaredPrefixes', () => {
  it('finds an element prefix that was never declared', () => {
    expect(findUndeclaredPrefixes(oruxLike)).toEqual(['om'])
  })

  it('ignores prefixes that are declared', () => {
    expect(findUndeclaredPrefixes('<a xmlns:b="urn:x"><b:c/></a>')).toEqual([])
  })

  it('never reports the reserved xml prefix', () => {
    expect(findUndeclaredPrefixes('<a xml:lang="zh"><b/></a>')).toEqual([])
  })

  it('catches an undeclared prefix used only on an attribute', () => {
    expect(findUndeclaredPrefixes('<a foo:bar="1"/>')).toEqual(['foo'])
  })
})

describe('declareMissingNamespaces', () => {
  it('leaves a well-formed document untouched', () => {
    const text = '<gpx xmlns:xsi="urn:x" xsi:a="1"/>'
    expect(declareMissingNamespaces(text)).toEqual({ text, declared: [] })
  })

  it('adds the declaration to the root element', () => {
    const { text, declared } = declareMissingNamespaces(oruxLike)
    expect(declared).toEqual(['om'])
    expect(text).toContain('xmlns:om="urn:x-undeclared:om"')
    expect(text.indexOf('xmlns:om')).toBeLessThan(text.indexOf('<trk>'))
  })

  it('handles a self-closing root', () => {
    const { text } = declareMissingNamespaces('<a><b:c/></a>'.replace('<a>', '<a/>'))
    expect(text).toContain('xmlns:b=')
  })

  it('makes the document parseable, with its data intact', () => {
    const strict = (t: string) =>
      new DOMParser({
        onError: (level, msg) => {
          if (level === 'fatalError') throw new Error(String(msg))
        },
      }).parseFromString(t, 'text/xml') as unknown as Document

    expect(() => strict(oruxLike)).toThrow()

    const { doc } = gpxToDoc(strict(declareMissingNamespaces(oruxLike).text), 'orux.gpx')
    expect(doc.tracks[0]!.name).toBe('北稜')
    expect(doc.tracks[0]!.geometry.coordinates).toEqual([
      [121.38, 24.43, 1500],
      [121.39, 24.44, 1520],
    ])
  })
})
