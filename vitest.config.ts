import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
    // Stands up the sliver of DOM that renderer construction touches, so entity
    // and scene code can be unit-tested without pulling in jsdom.
    setupFiles: ['src/test/canvasStub.ts'],
  },
})
