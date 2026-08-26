import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    css: true,
  },
  server: {
    port: Number(process.env.PORT) || 5176,
    host: true,
    open: true,
  },
})
