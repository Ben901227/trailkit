let counter = 0

/** Stable-ish unique id. crypto.randomUUID is not available in every context. */
export function newId(prefix = 'id'): string {
  counter += 1
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${counter}_${rand}`
}

const PALETTE = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4',
  '#008080', '#f032e6', '#9a6324', '#800000', '#000075',
]

export function colorForIndex(i: number): string {
  return PALETTE[i % PALETTE.length] as string
}
