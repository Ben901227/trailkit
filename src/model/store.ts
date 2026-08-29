import type { AppState, Doc, Selection, TileLayer } from './types'

type Listener = (state: AppState) => void

const initial: AppState = {
  docs: [],
  layers: [],
  selection: null,
  basemapId: 'osm',
  customBasemapUrl: null,
  editing: false,
  terrain: false,
  vertex: null,
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
    vertex: s.selection?.docId === docId ? null : s.vertex,
  }))
}

export function setSelection(selection: Selection | null): void {
  // A vertex index only means something within one track.
  update((s) => ({ ...s, selection, vertex: null }))
}

export function setEditing(editing: boolean): void {
  update((s) => ({ ...s, editing, vertex: editing ? s.vertex : null }))
}

/** Turning on 3D leaves editing mode: dragging points on a tilted, draped
 * surface is not something you can do accurately. */
export function setTerrain(terrain: boolean): void {
  update((s) => ({
    ...s,
    terrain,
    editing: terrain ? false : s.editing,
    vertex: terrain ? null : s.vertex,
  }))
}

export function setVertex(vertex: number | null): void {
  update((s) => ({ ...s, vertex }))
}

/** Replace the documents wholesale; the editing commands return new arrays. */
export function setDocs(docs: AppState['docs']): void {
  update((s) => ({ ...s, docs }))
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

/* ---------- raster layer stack ---------- */

/** Add layers, skipping any URL the stack already has. */
export function addLayers(layers: TileLayer[]): TileLayer[] {
  const added: TileLayer[] = []
  update((s) => {
    const seen = new Set(s.layers.map((l) => l.url))
    for (const layer of layers) {
      if (seen.has(layer.url)) continue
      seen.add(layer.url)
      added.push(layer)
    }
    return added.length ? { ...s, layers: [...s.layers, ...added] } : s
  })
  return added
}

export function removeLayer(id: string): void {
  update((s) => ({ ...s, layers: s.layers.filter((l) => l.id !== id) }))
}

export function patchLayer(id: string, patch: Partial<TileLayer>): void {
  update((s) => ({
    ...s,
    layers: s.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
  }))
}

/** Move a layer one step up (later = drawn higher) or down the stack. */
export function moveLayer(id: string, direction: -1 | 1): void {
  update((s) => {
    const index = s.layers.findIndex((l) => l.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= s.layers.length) return s
    const layers = s.layers.slice()
    const [moved] = layers.splice(index, 1)
    layers.splice(target, 0, moved as TileLayer)
    return { ...s, layers }
  })
}

export function setCustomBasemapUrl(url: string | null): void {
  update((s) => ({ ...s, customBasemapUrl: url }))
}
