import { lightingCueFor, postLightingCue } from './lightingCues'

/**
 * Firehose — transport-agnostic event emitter for orb-platform.
 *
 * Every station state change and key interaction is published to the station
 * Python bridge (which relays it to MQTT for the central orchestrator). Two
 * transports, decided at runtime:
 *
 *  - **Embedded (visualizer host):** when running inside an iframe, messages
 *    are posted to `window.parent` via `postMessage`. The visualizer host
 *    relays them to MQTT itself.
 *  - **Top-level (cog kiosk):** when running as the top document — as it does
 *    on an RPi station screen — messages are POSTed straight to the station
 *    Python bridge's local endpoint (`POST /api/firehose`, default
 *    `http://localhost:8189`, overridable with the `relay=` query param).
 *
 * The message format is stable and self-describing so that any consumer can
 * filter on station, phase, or event type without knowing the reducer internals.
 *
 * Message shape:
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

// Default station bridge the cog kiosk forwards events to. The bridge serves
// `/api/firehose` on the station's local HTTP port (STATION_HEALTH_PORT).
const RELAY_DEFAULT = 'http://localhost:8189'

function isEmbedded(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

// Lazily-resolved relay endpoint: undefined = not decided yet.
let relayTarget: string | null | undefined

/**
 * Where top-level firings go. `?relay=` (or `relay=0` to disable) wins; else
 * default to the local station bridge when served from a loopback hostname —
 * the kiosk page is always `http://localhost:<port>` for the webcam's secure
 * context. Embedded (visualizer) runs skip the direct relay.
 */
function getRelayTarget(): string | null {
  if (relayTarget !== undefined) return relayTarget
  const params = new URLSearchParams(window.location.search)
  const explicit = params.get('relay')
  if (explicit === '0' || explicit === 'false') {
    relayTarget = null
  } else if (explicit) {
    relayTarget = explicit
  } else if (
    !isEmbedded() &&
    /^(localhost|127\.0\.0\.1|\[::1\])/i.test(window.location.hostname)
  ) {
    relayTarget = RELAY_DEFAULT
  } else {
    relayTarget = null
  }
  return relayTarget
}

function postToStation(msg: FirehoseMessage): void {
  const target = getRelayTarget()
  if (!target) return
  // Most telemetry is intentionally fire-and-forget. Terminal events are
  // different: a dropped `interview_done`/`reveal_ready` strands the visit,
  // while a dropped loading transition makes the wall appear to skip a job.
  // Retry only those small, state-changing messages so transient Wi-Fi/SSH
  // forwarding loss cannot strand an otherwise completed kiosk flow.
  const retryable =
    msg.event === 'interview_done' || msg.event === 'reveal_ready' || msg.event === 'phase:loading'
  const attempts = retryable ? 3 : 1
  const body = JSON.stringify(msg)
  void (async () => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetch(`${target}/api/firehose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        if (response.ok || attempt === attempts - 1) return
      } catch {
        if (attempt === attempts - 1) return
      }
      await new Promise((resolve) => window.setTimeout(resolve, 150 * (attempt + 1)))
    }
  })()
}

/**
 * Publish a firehose event. Safe to call at module scope — checks for
 * `window.parent` existence and only fetches when a relay target is set.
 */
export function publish(station: string, event: string, data?: unknown): void {
  const msg: FirehoseMessage = {
    source: SOURCE,
    station,
    event,
    data,
    ts: Date.now(),
  }

  postFirehose(msg)

  const cue = lightingCueFor(station, event)
  if (!cue) return
  postLightingCue(cue, station, event)
  postFirehose({
    source: SOURCE,
    station: 'lighting',
    event: 'cue',
    data: { cue, from: { station, event } },
    ts: Date.now(),
  })
}

function postFirehose(msg: FirehoseMessage) {
  if (isEmbedded() && window.parent) {
    window.parent.postMessage(msg, '*')
  }
  postToStation(msg)
  postToIpadSimLink(msg)

  // Always log in dev so standalone `pnpm dev` shows the event stream.
  if (import.meta.env.DEV) {
    console.log('[firehose]', msg.station, msg.event, msg.data ?? '')
  }
}

function postToIpadSimLink(msg: FirehoseMessage) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  fetch('/__hons/firehose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
  }).catch(() => {})
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
