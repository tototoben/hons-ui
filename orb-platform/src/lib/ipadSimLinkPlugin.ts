import type { IncomingMessage, ServerResponse } from 'http'
import type { ViteDevServer } from 'vite'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

type FocusState = {
  mode: string
  left?: string
  right?: string
  value?: number
  prompt?: string
}

function pluginPath(url: string) {
  const path = url.split('?')[0] ?? ''
  return path.replace(/^\/orb(?=\/|$)/, '') || '/'
}

function json(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function stationIdFor(station: unknown): string | null {
  if (station === 'station-1' || station === '1') return '1'
  if (station === 'station-2' || station === '2') return '2'
  if (station === 'station-3' || station === 'mirror' || station === '3') return '3'
  return null
}

function readBody(req: IncomingMessage, done: (body: string) => void) {
  let body = ''
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString()
  })
  req.on('end', () => done(body))
}

/** Loopback between orb-platform (this Vite) and the iPad Simulator. */
export function ipadSimLinkPlugin() {
  const focusByStation = new Map<string, FocusState>()
  const keyClients = new Set<ServerResponse>()

  return {
    name: 'ipad-sim-link',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''
        const path = pluginPath(url)

        if (req.method === 'POST' && path === '/__hons/firehose') {
          readBody(req, (raw) => {
            try {
              const msg = JSON.parse(raw) as {
                source?: string
                station?: string
                event?: string
                data?: FocusState
              }
              if (msg.source === 'orb-firehose' && msg.event === 'keyboard_focus') {
                const id = stationIdFor(msg.station)
                if (id && msg.data && typeof msg.data.mode === 'string') {
                  focusByStation.set(id, msg.data)
                }
              }
            } catch {
              json(res, 400, { ok: false })
              return
            }
            json(res, 200, { ok: true })
          })
          return
        }

        if (req.method === 'GET' && path === '/__hons/keyboard-focus') {
          const station = new URL(url, 'http://localhost').searchParams.get('station') ?? '1'
          json(res, 200, focusByStation.get(station) ?? { mode: 'text' })
          return
        }

        if (req.method === 'POST' && path === '/__hons/remote-key') {
          readBody(req, (raw) => {
            let payload: unknown
            try {
              payload = JSON.parse(raw)
            } catch {
              json(res, 400, { ok: false })
              return
            }
            const frame = `data: ${JSON.stringify(payload)}\n\n`
            for (const client of keyClients) {
              client.write(frame)
            }
            json(res, 200, { ok: true })
          })
          return
        }

        if (req.method === 'GET' && path === '/__hons/remote-key/stream') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          })
          res.write('\n')
          keyClients.add(res)
          req.on('close', () => {
            keyClients.delete(res)
          })
          return
        }

        if (req.method === 'POST' && path === '/__hons/ars-interview') {
          readBody(req, (raw) => {
            try {
              const payload = JSON.parse(raw) as {
                users?: unknown
                conversation?: unknown
              }
              if (!payload.users || !Array.isArray(payload.conversation)) {
                json(res, 400, { ok: false })
                return
              }
              const dataDir = resolve(process.cwd(), '../../hons-avatar/data')
              mkdirSync(dataDir, { recursive: true })
              writeFileSync(
                resolve(dataDir, 'users.json'),
                `${JSON.stringify(payload.users, null, 4)}\n`,
              )
              writeFileSync(
                resolve(dataDir, 'conversation.json'),
                `${JSON.stringify(payload.conversation, null, 4)}\n`,
              )
              json(res, 200, { ok: true })
              fetch('http://127.0.0.1:8190/api/kiosk-interview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: raw,
              }).catch(() => {})
            } catch {
              json(res, 400, { ok: false })
            }
          })
          return
        }

        next()
      })
    },
  }
}
