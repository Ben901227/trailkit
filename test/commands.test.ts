import { describe, expect, it } from 'vitest'
import {
  addWaypoint,
  deletePoints,
  deleteWaypoint,
  insertPoint,
  movePoint,
  reverseTrack,
  splitTrack,
  trimTrack,
  updateWaypoint,
} from '../src/model/commands'
import type { Doc } from '../src/model/types'

function docs(): Doc[] {
  return [
    {
      id: 'd',
      name: 'demo',
      sourceFormat: 'gpx',
      tracks: [
        {
          id: 't',
          name: '軌跡',
          color: '#ff0000',
          visible: true,
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0, 100],
              [1, 1, 110],
              [2, 2, 120],
              [3, 3, 130],
            ],
          },
          props: { times: ['a', 'b', 'c', 'd'] },
        },
      ],
      waypoints: [],
      overlays: [],
      tiles: [],
    },
  ]
}

const track = (d: Doc[]) => d[0]!.tracks[0]!
const coordsOf = (d: Doc[], i = 0) => d[0]!.tracks[i]!.geometry.coordinates

describe('movePoint', () => {
  it('moves horizontally and keeps the elevation', () => {
    const out = movePoint(docs(), 'd', 't', 1, [9, 9])
    expect(coordsOf(out)[1]).toEqual([9, 9, 110])
  })

  it('leaves the input untouched', () => {
    const before = docs()
    movePoint(before, 'd', 't', 1, [9, 9])
    expect(before[0]!.tracks[0]!.geometry.coordinates[1]).toEqual([1, 1, 110])
  })
})

describe('insertPoint', () => {
  it('inserts after the given index and keeps times aligned', () => {
    const out = insertPoint(docs(), 'd', 't', 1, [1.5, 1.5])
    expect(coordsOf(out)).toHaveLength(5)
    expect(coordsOf(out)[2]).toEqual([1.5, 1.5])
    expect(track(out).props.times).toEqual(['a', 'b', null, 'c', 'd'])
  })
})

describe('deletePoints', () => {
  it('removes points and their times together', () => {
    const out = deletePoints(docs(), 'd', 't', [1, 2])
    expect(coordsOf(out)).toEqual([
      [0, 0, 100],
      [3, 3, 130],
    ])
    expect(track(out).props.times).toEqual(['a', 'd'])
  })

  it('drops a track that would be left with fewer than two points', () => {
    const out = deletePoints(docs(), 'd', 't', [0, 1, 2])
    expect(out[0]!.tracks).toHaveLength(0)
  })
})

describe('trimTrack', () => {
  it('keeps the inclusive range', () => {
    const out = trimTrack(docs(), 'd', 't', 1, 2)
    expect(coordsOf(out)).toEqual([
      [1, 1, 110],
      [2, 2, 120],
    ])
    expect(track(out).props.times).toEqual(['b', 'c'])
  })

  it('accepts the range in either order', () => {
    expect(coordsOf(trimTrack(docs(), 'd', 't', 2, 1))).toEqual(coordsOf(trimTrack(docs(), 'd', 't', 1, 2)))
  })
})

describe('splitTrack', () => {
  it('shares the split point so neither half has a gap', () => {
    const out = splitTrack(docs(), 'd', 't', 1)
    expect(out[0]!.tracks).toHaveLength(2)
    expect(coordsOf(out, 0)).toEqual([
      [0, 0, 100],
      [1, 1, 110],
    ])
    expect(coordsOf(out, 1)![0]).toEqual([1, 1, 110])
  })

  it('refuses to split at an endpoint', () => {
    expect(splitTrack(docs(), 'd', 't', 0)[0]!.tracks).toHaveLength(1)
    expect(splitTrack(docs(), 'd', 't', 3)[0]!.tracks).toHaveLength(1)
  })
})

describe('reverseTrack', () => {
  it('reverses coordinates and times together', () => {
    const out = reverseTrack(docs(), 'd', 't')
    expect(coordsOf(out)[0]).toEqual([3, 3, 130])
    expect(track(out).props.times).toEqual(['d', 'c', 'b', 'a'])
  })

  it('is its own inverse', () => {
    const out = reverseTrack(reverseTrack(docs(), 'd', 't'), 'd', 't')
    expect(coordsOf(out)).toEqual(coordsOf(docs()))
  })
})

describe('waypoints', () => {
  it('adds, renames, moves and deletes', () => {
    let out = addWaypoint(docs(), 'd', [5, 5], '新點')
    const id = out[0]!.waypoints[0]!.id
    expect(out[0]!.waypoints[0]!.name).toBe('新點')

    out = updateWaypoint(out, 'd', id, { name: '改名', position: [6, 6] })
    expect(out[0]!.waypoints[0]!.name).toBe('改名')
    expect(out[0]!.waypoints[0]!.geometry.coordinates).toEqual([6, 6])

    out = deleteWaypoint(out, 'd', id)
    expect(out[0]!.waypoints).toHaveLength(0)
  })
})
