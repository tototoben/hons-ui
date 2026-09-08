/**
 * Room event stream — SSE subscriber for room-level state machine events.
 *
 * When the kiosk runs top-level on an RPi400 (not embedded in the visualizer),
 * it connects to the station bridge's `/api/events/stream` SSE endpoint to
 * receive room-level MQTT events that the bridge forwards: `room/reset`,
 * `station/<id>/ui/state`, and any future topics added to the bridge's
 * room event handler.
 *
 * When embedded in the visualizer, the visualizer's `broadcastReset()`
 * postMessage path handles room-reset instead; this SSE subscriber is
 * skipped (no relay target).
 *
 * Usage:
 *   const unsubscribe = connectRoomStream((event) => {
 *     if (event.type === 'room-reset') { ... }
 *     if (event.type === 'ui-state' && event.data.stage === 'reset') { ... }
 *   })
 */

export type RoomEvent =
  | { type: 'room-reset'; data: { topic: string; ts?: number; src?: string; reason?: string } }
  | { type: 'ui-state'; data: { topic: string; stage?: string; data?: unknown; ts?: number; src?: string } }
  | { type: string; data: Record<string, unknown> }

const RELAY_DEFAULT = 'http://localhost:8189'

function isEmbedded(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

function getRelayTarget(): string | null {
  const params = new URLSearchParams(window.location.search)
  const explicit = params.get('relay')
  if (explicit === '0' || explicit === 'false') return null
  if (explicit) return explicit
  if (
    !isEmbedded() &&
    /^(localhost|127\.0\.0\.1|\[::1\])/i.test(window.location.hostname)
  ) {
    return RELAY_DEFAULT
  }
  return null
}

/**
 * Connect to the station bridge's SSE stream for room-level events.
 * Returns an unsubscribe function, or null if there is no relay target
 * (embedded in visualizer, or relay disabled).
 */
export function connectRoomStream(
  handler: (event: RoomEvent) => void,
): (() => void) | null {
  const target = getRelayTarget()
  if (!target) return null

  let source: EventSource | null = null
  let closed = false

  function connect() {
    if (closed) return
    source = new EventSource(`${target}/api/events/stream`)

    source.addEventListener('room-reset', (e: MessageEvent) => {
      try {
        handler({ type: 'room-reset', data: JSON.parse(e.data) })
      } catch { /* ignore malformed */ }
    })

    source.addEventListener('ui-state', (e: MessageEvent) => {
      try {
        handler({ type: 'ui-state', data: JSON.parse(e.data) })
      } catch { /* ignore malformed */ }
    })

    source.onerror = () => {
      source?.close()
      source = null
      if (!closed) {
        // Reconnect after 3s — the bridge may be restarting.
        setTimeout(connect, 3000)
      }
    }
  }

  connect()

  return () => {
    closed = true
    source?.close()
    source = null
  }
}
