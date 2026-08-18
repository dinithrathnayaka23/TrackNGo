import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The repository .env is three levels above this Vite config:
  // my-react-app -> admin-web -> frontend -> TrackNGo.
  const rootEnv = loadEnv(mode, path.resolve(__dirname, '../../../'), '')
  const googleMapsApiKey =
    rootEnv.VITE_GOOGLE_MAPS_API_KEY || rootEnv.GOOGLE_MAPS_API_KEY || ''

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(googleMapsApiKey),
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8080',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://127.0.0.1:8080',
          changeOrigin: true,
        },
        '/ws': {
          target: 'ws://127.0.0.1:8080',
          ws: true,
          changeOrigin: true,
        },
      },
    },
  }
})
