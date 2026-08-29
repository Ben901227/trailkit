import type { AppState, Doc, Selection } from './types'

type Listener = (state: AppState) => void

const initial: AppState = {
  docs: [],
  selection: null,
  basemapId: 'osm',
}

let state: AppState = initial
const listeners = new Set<Listener>()

export function getState(): AppState {
  return state
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Replace state via a pure updater. The only way state ever changes. */
export function update(fn: (s: AppState) => AppState): void {
  const next = fn(state)
  if (next === state) return
  state = next
  for (const l of listeners) l(state)
}

export function addDocs(docs: Doc[]): void {
  update((s) => ({ ...s, docs: [...s.docs, ...docs] }))
}

export function removeDoc(docId: string): void {
  update((s) => ({
    ...s,
    docs: s.docs.filter((d) => d.id !== docId),
    selection: s.selection?.docId === docId ? null : s.selection,
  }))
}

export function setSelection(selection: Selection | null): void {
  update((s) => ({ ...s, selection }))
}

export function setBasemap(basemapId: string): void {
  update((s) => ({ ...s, basemapId }))
}

/** Toggle visibility of one item inside a doc. */
export function setVisible(sel: Selection, visible: boolean): void {
  update((s) => ({
    ...s,
    docs: s.docs.map((d) => {
      if (d.id !== sel.docId) return d
      if (sel.kind === 'track')
        return { ...d, tracks: d.tracks.map((t) => (t.id === sel.id ? { ...t, visible } : t)) }
      if (sel.kind === 'waypoint')
        return { ...d, waypoints: d.waypoints.map((w) => (w.id === sel.id ? { ...w, visible } : w)) }
      return { ...d, overlays: d.overlays.map((o) => (o.id === sel.id ? { ...o, visible } : o)) }
    }),
  }))
}

export function setTrackColor(docId: string, trackId: string, color: string): void {
  update((s) => ({
    ...s,
    docs: s.docs.map((d) =>
      d.id === docId
        ? { ...d, tracks: d.tracks.map((t) => (t.id === trackId ? { ...t, color } : t)) }
        : d,
    ),
  }))
}
