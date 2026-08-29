import { getState, update } from './store'
import type { Doc } from './types'

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

export function undo(): string | null {
  const entry = undoStack.pop()
  if (!entry) return null
  redoStack.push({ label: entry.label, docs: getState().docs })
  update((s) => ({ ...s, docs: entry.docs, selection: null }))
  notify()
  return entry.label
}

export function redo(): string | null {
  const entry = redoStack.pop()
  if (!entry) return null
  undoStack.push({ label: entry.label, docs: getState().docs })
  update((s) => ({ ...s, docs: entry.docs, selection: null }))
  notify()
  return entry.label
}

export function clearHistory(): void {
  undoStack = []
  redoStack = []
  notify()
}
