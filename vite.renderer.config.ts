import { resolve } from 'path'
import { defineConfig } from 'vite'

/**
 * Renderer-only dev server, for inspecting UI in a plain browser without
 * Electron. `window.fsim` is absent here, so multiplayer is unavailable and the
 * version badge reads "dev" — both already have fallbacks in the UI.
 */
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  resolve: { alias: { '@': resolve(__dirname, 'src/renderer') } },
})
