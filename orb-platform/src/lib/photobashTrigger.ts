import { publish } from './firehose'
import { mintPhotobashSeed } from './photobashLoop'

export const WALL_PHASE_CHANNEL = 'hons-station3-wall-phase'
export const REVEAL_STORAGE_KEY = 'hons-photobash-reveal'

export type RevealReadyMessage = {
  type: 'reveal-ready'
  photobashSeed: number
  ts: number
}

export function isRevealReadyMessage(value: unknown): value is RevealReadyMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const raw = value as Record<string, unknown>
  return (
    raw.type === 'reveal-ready' &&
    typeof raw.photobashSeed === 'number' &&
    Number.isFinite(raw.photobashSeed) &&
    typeof raw.ts === 'number'
  )
}

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage
}

export function readLastRevealReady(
  storage: Pick<Storage, 'getItem'> | undefined = defaultStorage(),
): RevealReadyMessage | null {
  try {
    const raw = storage?.getItem(REVEAL_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return isRevealReadyMessage(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function notifyRevealReady(
  seed: number = mintPhotobashSeed(),
  storage: Pick<Storage, 'setItem'> | undefined = defaultStorage(),
): number {
  const message: RevealReadyMessage = {
    type: 'reveal-ready',
    photobashSeed: seed,
    ts: Date.now(),
  }
  try {
    storage?.setItem(REVEAL_STORAGE_KEY, JSON.stringify(message))
  } catch {
    // Storage can be unavailable in privacy-restricted kiosk browsers.
  }
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(WALL_PHASE_CHANNEL)
    channel.postMessage(message)
    channel.close()
  }
  publish('station-3', 'reveal_ready', { photobashSeed: seed })
  return seed
}
