import { describe, expect, it } from 'vitest'
import { concatIntoDoc, joinGaps, mergeIntoDoc, resolveRefs, type TrackRef } from '../src/model/merge'
import type { Doc, Track } from '../src/model/types'

function track(id: string, coords: number[][], times?: string[]): Track {
  return {
    id,
    name: id,
    color: '#ff0000',
    visible: true,
    geometry: { type: 'LineString', coordinates: coords },
    props: times ? { times } : {},
  }
}

function docs(): Doc[] {
  return [
    {
      id: 'd1',
      name: 'a.gpx',
      sourceFormat: 'gpx',
      tracks: [
        track('a', [[0, 0], [0, 1]], ['t0', 't1']),
        track('b', [[0, 1], [0, 2]], ['t2', 't3']),
      ],
      waypoints: [],
      overlays: [],
    },
    {
      id: 'd2',
      name: 'b.gpx',
      sourceFormat: 'gpx',
      tracks: [track('c', [[0, 5], [0, 6]])],
      waypoints: [],
      overlays: [],
    },
  ]
}

const ref = (docId: string, trackId: string, reversed = false): TrackRef => ({ docId, trackId, reversed })

describe('mergeIntoDoc', () => {
  it('gathers tracks from several files into one new document', () => {
    const out = mergeIntoDoc(docs(), [ref('d1', 'a'), ref('d2', 'c')], '合併')
    expect(out).toHaveLength(3)
    expect(out[2]!.tracks.map((t) => t.name)).toEqual(['a', 'c'])
  })

  it('leaves the source documents in place', () => {
    const out = mergeIntoDoc(docs(), [ref('d1', 'a')], '合併')
    expect(out[0]!.tracks).toHaveLength(2)
  })

  it('gives the copies fresh ids so editing one does not touch the original', () => {
    const out = mergeIntoDoc(docs(), [ref('d1', 'a')], '合併')
    expect(out[2]!.tracks[0]!.id).not.toBe('a')
  })
})

describe('resolveRefs', () => {
  it('applies reversal to coordinates and times', () => {
    const [t] = resolveRefs(docs(), [ref('d1', 'a', true)])
    expect(t!.geometry.coordinates).toEqual([[0, 1], [0, 0]])
    expect(t!.props.times).toEqual(['t1', 't0'])
  })

  it('skips refs that no longer exist', () => {
    expect(resolveRefs(docs(), [ref('d1', 'gone')])).toEqual([])
  })
})

describe('concatIntoDoc', () => {
  it('joins tracks into one, collapsing a repeated seam point', () => {
    const out = concatIntoDoc(docs(), [ref('d1', 'a'), ref('d1', 'b')], '接龍')
    const joined = out[2]!.tracks[0]!
    expect(joined.geometry.coordinates).toEqual([[0, 0], [0, 1], [0, 2]])
    expect(joined.props.times).toEqual(['t0', 't1', 't3'])
  })

  it('keeps both points when the ends are far apart', () => {
    const out = concatIntoDoc(docs(), [ref('d1', 'a'), ref('d2', 'c')], '接龍')
    expect(out[2]!.tracks[0]!.geometry.coordinates).toHaveLength(4)
  })

  it('pads missing timestamps rather than misaligning them', () => {
    const out = concatIntoDoc(docs(), [ref('d1', 'a'), ref('d2', 'c')], '接龍')
    const joined = out[2]!.tracks[0]!
    expect(joined.props.times).toEqual(['t0', 't1', null, null])
    expect(joined.props.times).toHaveLength(joined.geometry.coordinates.length)
  })

  it('drops timestamps entirely when no source track had any', () => {
    const only = concatIntoDoc(docs(), [ref('d2', 'c'), ref('d2', 'c')], '接龍')
    expect(only[2]!.tracks[0]!.props.times).toBeUndefined()
  })

  it('refuses to join fewer than two tracks', () => {
    expect(concatIntoDoc(docs(), [ref('d1', 'a')], '接龍')).toHaveLength(2)
  })
})

describe('joinGaps', () => {
  it('measures the distance across each seam', () => {
    const tracks = resolveRefs(docs(), [ref('d1', 'a'), ref('d1', 'b'), ref('d2', 'c')])
    const gaps = joinGaps(tracks)
    expect(gaps).toHaveLength(2)
    expect(gaps[0]).toBeLessThan(1)
    expect(gaps[1]).toBeGreaterThan(300_000)
  })
})
