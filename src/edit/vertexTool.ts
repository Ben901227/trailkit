import type { Map as MLMap, MapMouseEvent, MapTouchEvent } from 'maplibre-gl'
import { insertPoint, movePoint, updateWaypoint } from '../model/commands'
import { checkpoint, checkpointCoalesced } from '../model/history'
import { nearestOnLine } from '../model/geometry'
import { getState, setDocs, setSelection, setVertex } from '../model/store'
import { selectionKey, type Selection } from '../model/types'

type PointerEventLike = MapMouseEvent | MapTouchEvent

/** How far a tap may drift and still count as a tap rather than a drag, in px. */
const TAP_SLOP = 4

interface Drag {
  kind: 'vertex' | 'waypoint'
  /** Vertex index, or waypoint id. */
  ref: number | string
  docId: string
  trackId: string
  startPoint: { x: number; y: number }
  moved: boolean
  label: string
}

function selectedTrack(): Selection | null {
  const sel = getState().selection
  return sel?.kind === 'track' ? sel : null
}

/**
 * Dragging points and inserting new ones.
 *
 * The map's own pan gesture is disabled only while a handle is held, so a
 * single finger still pans everywhere else — the common case on a phone.
 */
export function installVertexTool(map: MLMap): void {
  let drag: Drag | null = null

  const positionOf = (e: PointerEventLike): [number, number] => [e.lngLat.lng, e.lngLat.lat]

  const beginVertexDrag = (e: PointerEventLike) => {
    const state = getState()
    const sel = selectedTrack()
    if (!state.editing || !sel) return
    const feature = map.queryRenderedFeatures(e.point, { layers: ['vertex-hit'] })[0]
    const index = feature?.properties?.['index']
    if (typeof index !== 'number') return

    e.preventDefault()
    map.dragPan.disable()
    drag = {
      kind: 'vertex',
      ref: index,
      docId: sel.docId,
      trackId: sel.id,
      startPoint: { x: e.point.x, y: e.point.y },
      moved: false,
      label: `移動點 ${index + 1}`,
    }
  }

  const beginWaypointDrag = (e: PointerEventLike) => {
    const state = getState()
    if (!state.editing) return
    const feature = map.queryRenderedFeatures(e.point, { layers: ['waypoint-hit'] })[0]
    const key = feature?.properties?.['key']
    if (typeof key !== 'string') return
    const [, docId, id] = key.split(':')
    if (!docId || !id) return

    e.preventDefault()
    map.dragPan.disable()
    drag = {
      kind: 'waypoint',
      ref: id,
      docId,
      trackId: '',
      startPoint: { x: e.point.x, y: e.point.y },
      moved: false,
      label: '移動點位',
    }
  }

  const onMove = (e: PointerEventLike) => {
    if (!drag) return
    const dx = e.point.x - drag.startPoint.x
    const dy = e.point.y - drag.startPoint.y
    if (!drag.moved && Math.hypot(dx, dy) < TAP_SLOP) return
    drag.moved = true

    // Coalesce the whole drag into one undo step.
    checkpointCoalesced(drag.label)
    const docs = getState().docs
    setDocs(
      drag.kind === 'vertex'
        ? movePoint(docs, drag.docId, drag.trackId, drag.ref as number, positionOf(e))
        : updateWaypoint(docs, drag.docId, drag.ref as string, { position: positionOf(e) }),
    )
  }

  const onRelease = () => {
    if (!drag) return
    // A press that never moved is a tap: use it to select.
    if (!drag.moved) {
      if (drag.kind === 'vertex') setVertex(drag.ref as number)
      else setSelection({ kind: 'waypoint', docId: drag.docId, id: drag.ref as string })
    }
    map.dragPan.enable()
    drag = null
  }

  map.on('mousedown', beginVertexDrag)
  map.on('mousedown', beginWaypointDrag)
  map.on('touchstart', beginVertexDrag)
  map.on('touchstart', beginWaypointDrag)
  map.on('mousemove', onMove)
  map.on('touchmove', onMove)
  map.on('mouseup', onRelease)
  map.on('touchend', onRelease)
  map.on('touchcancel', onRelease)

  // Tapping the selected track's line adds a point there.
  map.on('click', (e) => {
    const state = getState()
    const sel = selectedTrack()
    if (!state.editing || !sel) return
    if (map.queryRenderedFeatures(e.point, { layers: ['vertex-hit'] }).length) return

    const hit = map
      .queryRenderedFeatures(e.point, { layers: ['track-hit'] })
      .find((f) => f.properties?.['key'] === selectionKey(sel))
    if (!hit) return

    const track = state.docs.find((d) => d.id === sel.docId)?.tracks.find((t) => t.id === sel.id)
    const nearest = track && nearestOnLine(track.geometry.coordinates, positionOf(e))
    if (!nearest) return

    checkpoint('插入點')
    setDocs(insertPoint(state.docs, sel.docId, sel.id, nearest.index, nearest.position))
    setVertex(nearest.index + 1)
  })
}
