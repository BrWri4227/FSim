/**
 * Namespaced, crash-proof key/value persistence over `localStorage`.
 *
 * Every key is stored under `fsim.v1.<name>` so a schema bump (v2…) can be done
 * without colliding with old data. All access is wrapped in try/catch: private
 * windows, disabled site-data, and the Node test environment (no `localStorage`)
 * all degrade to "nothing persisted" instead of throwing.
 */

const NAMESPACE = 'fsim.v1.'

/** Minimal subset of the DOM Storage interface we rely on. */
export interface KVBackend {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

let injectedBackend: KVBackend | null = null

/** Test hook — swap in a Map-backed fake. Pass `null` to restore `localStorage`. */
export function setStorageBackend(backend: KVBackend | null): void {
  injectedBackend = backend
}

function backend(): KVBackend | null {
  if (injectedBackend) return injectedBackend
  try {
    const ls = (globalThis as { localStorage?: KVBackend }).localStorage
    return ls ?? null
  } catch {
    return null
  }
}

/** Read and JSON-parse a stored value, returning `fallback` on any failure. */
export function readJSON<T>(name: string, fallback: T): T {
  const b = backend()
  if (!b) return fallback
  try {
    const raw = b.getItem(NAMESPACE + name)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** JSON-serialise and store a value. Silently no-ops when storage is unavailable. */
export function writeJSON(name: string, value: unknown): void {
  const b = backend()
  if (!b) return
  try {
    b.setItem(NAMESPACE + name, JSON.stringify(value))
  } catch {
    // Quota exceeded / serialisation error — not fatal for gameplay.
  }
}

/** Remove a stored value. */
export function removeKey(name: string): void {
  const b = backend()
  if (!b) return
  try {
    b.removeItem(NAMESPACE + name)
  } catch {
    // ignore
  }
}

/** In-memory `KVBackend` for tests. */
export function createMemoryBackend(): KVBackend {
  const map = new Map<string, string>()
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => { map.set(k, v) },
    removeItem: (k) => { map.delete(k) },
  }
}
