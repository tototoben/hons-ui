import { defineConfig, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'

/**
 * Vite middleware that accepts perf metric beacons from the browser at
 * `POST /api/log-perf` and appends them as JSON lines to `perf-log.jsonl`
 * in the project root.  Enabled unconditionally — the client only sends
 * beacons when `?perf=1` is in the URL, so there is zero overhead in
 * normal use.
 */
function perfFileLogger() {
  return {
    name: 'perf-file-logger',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/log-perf', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          try {
            const logPath = resolve(process.cwd(), 'perf-log.jsonl')
            const dir = dirname(logPath)
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
            writeFileSync(logPath, body + '\n', { flag: 'a' })
          } catch (e) {
            // Never let logging crash the server
          }
          res.end('ok')
        })
      })
    },
  }
}

const isVercel = Boolean(process.env.VERCEL)

export default defineConfig({
  plugins: [react(), perfFileLogger()],
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
    // When the dev server is forwarded to a kiosk via socat (localhost:8765
    // -> dev_host:5176), the Vite HMR client can't establish a WebSocket
    // through the TCP forwarder. Point the HMR client directly at this
    // machine's LAN IP so the kiosk browser connects to ws://192.168.88.x:5176
    // for hot updates, while page loads still go through the forwarder.
    hmr: process.env.VITE_HMR_HOST
      ? { host: process.env.VITE_HMR_HOST, port: Number(process.env.PORT) || 5176 }
      : undefined,
  },
  build: {
    outDir: isVercel ? 'dist' : '../../visualizer/public/orb',
    emptyOutDir: true,
  },
})
