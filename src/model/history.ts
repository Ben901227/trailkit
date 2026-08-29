import { getState, update } from './store'
import type { AppState, Doc, Selection } from './types'

interface Entry {
  label: string
  docs: Doc[]
}

/**
 * Snapshots of the `docs` array. Every mutation builds new objects and reuses
 * the untouched ones, so a snapshot only costs the parts that actually changed
 * — much simpler than inverse commands, and bounded by the stack limit below.
 */
const LIMIT = 60

let undoStack: Entry[] = []
let redoStack: Entry[] = []
let listener: (() => void) | null = null

export function onHistoryChange(fn: () => void): void {
  listener = fn
}

function notify(): void {
  listener?.()
}

/** Record the current state so the next mutation can be undone. */
export function checkpoint(label: string): void {
  undoStack.push({ label, docs: getState().docs })
  if (undoStack.length > LIMIT) undoStack = undoStack.slice(-LIMIT)
  redoStack = []
  notify()
}

/**
 * Fold this mutation into the previous checkpoint when it carries the same
 * label — a point drag emits many updates but should undo in one step.
 */
export function checkpointCoalesced(label: string): void {
  const top = undoStack[undoStack.length - 1]
  if (top?.label === label) {
    redoStack = []
    return
  }
  checkpoint(label)
}

export function canUndo(): boolean {
  return undoStack.length > 0
}

export function canRedo(): boolean {
  return redoStack.length > 0
}

/** Keep the selection if it still points at something; drop it otherwise. */
function surviving(docs: Doc[], selection: Selection | null): Selection | null {
  if (!selection) return null
  const doc = docs.find((d) => d.id === selection.docId)
  if (!doc) return null
  const lists = {
    track: doc.tracks,
    waypoint: doc.waypoints,
    overlay: doc.overlays,
    tile: doc.tiles,
  } as const
  return lists[selection.kind].some((item) => item.id === selection.id) ? selection : null
}

function applyEntry(entry: Entry, into: Entry[]): string {
  into.push({ label: entry.label, docs: getState().docs })
  update((s: AppState) => {
    const selection = surviving(entry.docs, s.selection)
    // The restored track may be shorter than it was when the point was picked.
    const track =
      selection?.kind === 'track'
        ? entry.docs
            .find((d) => d.id === selection.docId)
            ?.tracks.find((t) => t.id === selection.id)
        : undefined
    const inRange =
      s.vertex !== null && track !== undefined && s.vertex < track.geometry.coordinates.length
    return { ...s, docs: entry.docs, selection, vertex: inRange ? s.vertex : null }
  })
  notify()
  return entry.label
}

export function undo(): string | null {
  const entry = undoStack.pop()
  return entry ? applyEntry(entry, redoStack) : null
}

export function redo(): string | null {
  const entry = redoStack.pop()
  return entry ? applyEntry(entry, undoStack) : null
}

export function clearHistory(): void {
  undoStack = []
  redoStack = []
  notify()
}
