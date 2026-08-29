import type { Map as MLMap, MapMouseEvent, MapTouchEvent } from 'maplibre-gl'
import { insertPoint, moveOverlay, moveOverlayCorner, movePoint, updateWaypoint } from '../model/commands'
import { checkpoint, checkpointCoalesced } from '../model/history'
import { nearestOnLine } from '../model/geometry'
import { getState, setDocs, setSelection, setVertex } from '../model/store'
import { selectionKey, type AppState, type Selection } from '../model/types'

type PointerEventLike = MapMouseEvent | MapTouchEvent

/** How far a tap may drift and still count as a tap rather than a drag, in px. */
const TAP_SLOP = 4

interface Drag {
  kind: 'vertex' | 'waypoint' | 'corner' | 'overlay'
  /** Vertex/corner index, or waypoint/overlay id. */
  ref: number | string
  docId: string
  trackId: string
  startPoint: { x: number; y: number }
  /** Map position where the drag started, for delta-based moves. */
  startLngLat: [number, number]
  moved: boolean
  label: string
}

/** Point-in-quad test, so dragging the image body only starts over the image. */
function insideOverlay(state: AppState, sel: Selection, point: [number, number]): boolean {
  const overlay = state.docs
    .find((d) => d.id === sel.docId)
    ?.overlays.find((o) => o.id === sel.id)
  if (!overlay) return false
  const [x, y] = point
  let inside = false
  const corners = overlay.corners
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const [xi, yi] = corners[i] as [number, number]
    const [xj, yj] = corners[j] as [number, number]
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
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
      startLngLat: positionOf(e),
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
      startLngLat: positionOf(e),
      moved: false,
      label: '移動點位',
    }
  }

  /** Corner handles, and dragging the image body itself. */
  const beginOverlayDrag = (e: PointerEventLike) => {
    const state = getState()
    const sel = state.selection
    if (!state.editing || sel?.kind !== 'overlay') return

    const corner = map.queryRenderedFeatures(e.point, { layers: ['corner-hit'] })[0]
    const index = corner?.properties?.['index']
    const onCorner = typeof index === 'number'
    if (!onCorner && !insideOverlay(state, sel, positionOf(e))) return

    e.preventDefault()
    map.dragPan.disable()
    drag = {
      kind: onCorner ? 'corner' : 'overlay',
      ref: onCorner ? (index as number) : sel.id,
      docId: sel.docId,
      trackId: sel.id,
      startPoint: { x: e.point.x, y: e.point.y },
      startLngLat: positionOf(e),
      moved: false,
      label: onCorner ? `校正疊圖角點 ${(index as number) + 1}` : '移動疊圖',
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
    const to = positionOf(e)
    if (drag.kind === 'vertex') {
      setDocs(movePoint(docs, drag.docId, drag.trackId, drag.ref as number, to))
    } else if (drag.kind === 'waypoint') {
      setDocs(updateWaypoint(docs, drag.docId, drag.ref as string, { position: to }))
    } else if (drag.kind === 'corner') {
      setDocs(moveOverlayCorner(docs, drag.docId, drag.trackId, drag.ref as number, to))
    } else {
      // The image moves by the delta since the last frame, not to the cursor.
      const delta: [number, number] = [to[0] - drag.startLngLat[0], to[1] - drag.startLngLat[1]]
      drag.startLngLat = to
      setDocs(moveOverlay(docs, drag.docId, drag.ref as string, delta))
    }
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
  map.on('mousedown', beginOverlayDrag)
  map.on('touchstart', beginVertexDrag)
  map.on('touchstart', beginWaypointDrag)
  map.on('touchstart', beginOverlayDrag)
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
