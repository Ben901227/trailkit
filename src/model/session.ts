import type { Doc, Overlay } from './types'

const DB_NAME = 'gpx-editor'
const STORE = 'session'
const KEY = 'current'

/** Object URLs do not survive a reload; the blob behind them does. */
interface StoredOverlay extends Omit<Overlay, 'url'> {
  url: string | null
}
interface StoredDoc extends Omit<Doc, 'overlays'> {
  overlays: StoredOverlay[]
}
interface Session {
  savedAt: number
  docs: StoredDoc[]
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const request = fn(tx.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        tx.oncomplete = () => db.close()
      }),
  )
}

function toStored(docs: Doc[]): StoredDoc[] {
  return docs.map((doc) => ({
    ...doc,
    overlays: doc.overlays.map((o) => ({
      ...o,
      // A blob-backed overlay rebuilds its URL on restore; a remote one keeps it.
      url: o.blob ? null : o.url,
    })),
  }))
}

function fromStored(docs: StoredDoc[]): Doc[] {
  return docs.map((doc) => ({
    ...doc,
    overlays: doc.overlays.flatMap((o): Overlay[] => {
      if (o.url) return [{ ...o, url: o.url }]
      if (o.blob) return [{ ...o, url: URL.createObjectURL(o.blob) }]
      // Neither a URL nor bytes: nothing left to draw.
      return []
    }),
  }))
}

export async function saveSession(docs: Doc[]): Promise<void> {
  try {
    const session: Session = { savedAt: Date.now(), docs: toStored(docs) }
    await run('readwrite', (store) => store.put(session, KEY))
  } catch {
    // Storage unavailable or over quota: the session simply is not kept.
  }
}

export async function loadSession(): Promise<Doc[]> {
  try {
    const session = await run<Session | undefined>('readonly', (store) => store.get(KEY))
    if (!session?.docs?.length) return []
    return fromStored(session.docs)
  } catch {
    return []
  }
}

export async function clearSession(): Promise<void> {
  try {
    await run('readwrite', (store) => store.delete(KEY))
  } catch {
    // Nothing to do; the next save overwrites it anyway.
  }
}
