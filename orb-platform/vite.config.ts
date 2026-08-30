import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/orb/',
  test: {
    css: true,
  },
  server: {
    port: 5176,
    host: true,
    strictPort: true,
    open: process.env.VITE_NO_OPEN !== '1',
    allowedHosts: true,
  },
  build: {
    outDir: '../../visualizer/public/orb',
    emptyOutDir: true,
  },
})
