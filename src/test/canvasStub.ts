/**
 * Minimal 2D-canvas surface for the node test environment.
 *
 * The suite runs on `environment: 'node'` (no jsdom), but constructing an
 * `Aircraft` builds a `ThrusterEffect`, and that paints its glow sprite into a
 * canvas via `document.createElement`. Nothing renders in a test, so the
 * texture is never sampled — only the calls have to succeed.
 *
 * Deliberately not a general canvas shim: it covers exactly the calls the
 * renderer makes at construction time. If a new one appears, the test that
 * needs it will fail loudly here rather than silently drawing nothing.
 */
interface StubContext {
  createRadialGradient: () => { addColorStop: () => void }
  fillRect: () => void
  fillStyle: unknown
}

interface StubCanvas {
  width: number
  height: number
  getContext: (kind: string) => StubContext | null
}

function makeCanvas(): StubCanvas {
  return {
    width: 0,
    height: 0,
    getContext: (kind: string) =>
      kind === '2d'
        ? {
            createRadialGradient: () => ({ addColorStop: (): void => {} }),
            fillRect: (): void => {},
            fillStyle: null,
          }
        : null,
  }
}

const g = globalThis as unknown as { document?: unknown }

if (g.document === undefined) {
  g.document = {
    createElement: (tag: string) => (tag === 'canvas' ? makeCanvas() : {}),
  }
}
