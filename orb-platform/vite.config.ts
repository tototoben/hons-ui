import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isVercel = Boolean(process.env.VERCEL)

export default defineConfig({
  plugins: [react()],
  // Visualizer embeds this app at /orb/. The Vercel preview is the app itself at /.
  base: isVercel ? '/' : '/orb/',
  test: {
    css: true,
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
