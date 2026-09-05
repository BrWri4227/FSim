import { resolve } from 'path'
import { readFileSync } from 'fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

// Single source of truth for the version the app reports on screen. The preload
// used to hard-code it, which meant the badge silently lied whenever package.json
// was bumped on its own.
const APP_VERSION: string = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf-8')
).version

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/main',
      rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
    build: {
      outDir: 'dist-electron/preload',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
        // CommonJS, and a `.cjs` extension, both deliberately.
        //
        // package.json is `"type": "module"`, so electron-vite would otherwise
        // emit `index.mjs` — and a `.js` here would be read as ESM too. But the
        // BrowserWindow runs with `sandbox: true`, and Electron only loads
        // CommonJS preload scripts under sandbox. An ESM preload fails silently:
        // `contextBridge.exposeInMainWorld` never runs, `window.fsim` is
        // undefined, and the lobby reports "Multiplayer is unavailable in this
        // runtime" while the version badge quietly reads "dev".
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      outDir: resolve(__dirname, 'dist-electron/renderer'),
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
        output: { manualChunks: { three: ['three'] } }
      }
    },
    resolve: { alias: { '@': resolve(__dirname, 'src/renderer') } }
  }
})
