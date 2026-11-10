/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  // The code runner's worker loads these. Prepared up front, so the dev
  // server doesn't reload the page the first time someone presses Run.
  optimizeDeps: {
    include: ['@bjorn3/browser_wasi_shim', '@jitl/quickjs-wasmfile-release-sync', 'quickjs-emscripten-core', 'sucrase'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})