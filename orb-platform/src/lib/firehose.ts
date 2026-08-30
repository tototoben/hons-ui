/**
 * Firehose — transport-agnostic event emitter for orb-platform.
 *
 * Every station state change and key interaction is published to the parent
 * window via `postMessage`. Consumers (the visualizer iframe host, the cog
 * kiosk, or any other embedder) listen for these messages and relay them to
 * whatever transport they use (MQTT, HTTP, WebSocket, …).
 *
 * The message format is stable and self-describing so that any consumer can
 * filter on station, phase, or event type without knowing the reducer internals.
 *
 * Message shape (posted to `window.parent`):
 *   { source: 'orb-firehose', station: 'station-1', event: string, data?: unknown, ts: number }
 *
 * When running standalone (not in an iframe), messages are also logged to the
 * console so `pnpm dev` of orb-platform alone still shows the event stream.
 */

export interface FirehoseMessage {
  source: 'orb-firehose'
  station: string
  event: string
  data?: unknown
  ts: number
}

const SOURCE = 'orb-firehose'

function isEmbedded(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

/**
 * Publish a firehose event to the parent window.
 * Safe to call at module scope — checks for `window.parent` existence.
 */
export function publish(station: string, event: string, data?: unknown): void {
  const msg: FirehoseMessage = {
    source: SOURCE,
    station,
    event,
    data,
    ts: Date.now(),
  }

  if (isEmbedded() && window.parent) {
    window.parent.postMessage(msg, '*')
  }

  // Always log in dev so standalone `pnpm dev` shows the event stream.
  if (import.meta.env.DEV) {
    console.log('[firehose]', station, event, data ?? '')
  }
}

/**
 * Wrap a React reducer so every dispatched action is published to the firehose
 * before the state transition runs. Returns a new reducer with the same
 * signature.
 *
 * Usage:
 *   const [state, dispatch] = useReducer(
 *     firehoseReducer('station-1', stationOneReducer),
 *     undefined,
 *     createStationOneState,
 *   )
 */
export function firehoseReducer<S, A>(
  station: string,
  reducer: (state: S, action: A) => S,
  actionToEvent?: (action: A) => { event: string; data?: unknown } | null,
): (state: S, action: A) => S {
  return (state: S, action: A): S => {
    if (actionToEvent) {
      const mapped = actionToEvent(action)
      if (mapped) publish(station, mapped.event, mapped.data)
    } else {
      // Default: use the action type as the event name.
      const event = typeof action === 'object' && action !== null && 'type' in action
        ? String((action as { type: unknown }).type)
        : 'unknown'
      publish(station, event, action)
    }
    return reducer(state, action)
  }
}

/**
 * Listen for firehose messages from orb-platform iframes.
 * Returns an unsubscribe function.
 *
 * Usage (in the visualizer or kiosk host):
 *   const unsubscribe = subscribeToFirehose((msg) => {
 *     if (msg.station === 'station-1' && msg.event === 'SUBMIT_NAME') { ... }
 *   })
 */
export function subscribeToFirehose(
  handler: (msg: FirehoseMessage) => void,
): () => void {
  function listener(e: MessageEvent) {
    if (e.source !== window) return // only from child iframes
    const data = e.data as FirehoseMessage | undefined
    if (!data || data.source !== SOURCE) return
    handler(data)
  }
  window.addEventListener('message', listener)
  return () => window.removeEventListener('message', listener)
}
