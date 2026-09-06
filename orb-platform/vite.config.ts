import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isVercel = Boolean(process.env.VERCEL)

export default defineConfig({
  plugins: [react()],
  // Visualizer embeds this app at /orb/. The Vercel preview is the app itself at /.
  base: isVercel ? '/' : '/orb/',
  test: {
    css: true,
    // Vitest 4 no longer mirrors vite `base` into import.meta.env.BASE_URL (always "/").
    // Match the non-Vercel embed base so base()-prefixed asset paths are exercised.
    env: {
      BASE_URL: '/orb/',
    },
  },
  server: {
    port: Number(process.env.PORT) || 5176,
    host: true,
    strictPort: true,
    open: process.env.VITE_NO_OPEN !== '1',
    allowedHosts: true,
  },
  build: {
    outDir: isVercel ? 'dist' : '../../visualizer/public/orb',
    emptyOutDir: true,
  },
})
