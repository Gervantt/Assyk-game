/** Событие для визуальных эффектов. Координаты — в плоскости физики (x, y). */
export type FxEvent =
  | { t: 'sparks'; x: number; y: number; power: number }
  | { t: 'dust'; x: number; y: number; power: number }
  | { t: 'knock'; x: number; y: number; index: number }
  | { t: 'decal'; x: number; y: number; size: number }
  | { t: 'combo'; kind: 'qos' | 'keremet' }

type Listener = (e: FxEvent) => void

const listeners = new Set<Listener>()

export function emitFx(e: FxEvent): void {
  for (const fn of listeners) fn(e)
}

export function onFx(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function clearFx(): void {
  listeners.clear()
}
