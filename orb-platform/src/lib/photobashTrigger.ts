import { publish } from './firehose'
import { collageCueFromLocalAnswers, collageCueFromVisitCentral, parseCollageCue, type CollageCue } from './collageCue'
import { mintPhotobashSeed } from './photobashLoop'

export const WALL_PHASE_CHANNEL = 'hons-station3-wall-phase'
export const REVEAL_STORAGE_KEY = 'hons-photobash-reveal'

export type RevealReadyMessage = {
  type: 'reveal-ready'
  photobashSeed: number
  ts: number
  collageCue: CollageCue
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

function withCollageCue(message: RevealReadyMessage, raw: unknown): RevealReadyMessage {
  const cueSource =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).collageCue
      : undefined
  return { ...message, collageCue: parseCollageCue(cueSource) }
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
    if (!isRevealReadyMessage(parsed)) return null
    return withCollageCue(parsed, parsed)
  } catch {
    return null
  }
}

export function notifyRevealReady(
  seed: number = mintPhotobashSeed(),
  storage: Pick<Storage, 'setItem'> | undefined = defaultStorage(),
  cue: CollageCue = collageCueFromLocalAnswers(),
  readyAnswer?: 'yes' | 'skip',
): number {
  const message: RevealReadyMessage = {
    type: 'reveal-ready',
    photobashSeed: seed,
    ts: Date.now(),
    collageCue: cue,
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
  // readyAnswer ("yes" | "skip") rides along in the ui/event data so it
  // lands in central's persisted visit.aggregated_data via the station-3
  // "reveal_ready" done-event -- same mechanism stations 1/2 use to save
  // their intake answers, just carried on this event instead of a
  // dedicated one, since reveal_ready is station 3's done-event.
  publish('station-3', 'reveal_ready', {
    photobashSeed: seed,
    collageCue: cue,
    ...(readyAnswer ? { readyAnswer } : {}),
  })
  return seed
}

/** Refresh central visit data, then fire reveal_ready once with the shared cue. */
export async function notifyRevealReadyFromVisit(
  seed: number = mintPhotobashSeed(),
  storage: Pick<Storage, 'setItem'> | undefined = defaultStorage(),
  readyAnswer?: 'yes' | 'skip',
): Promise<number> {
  const cue = await collageCueFromVisitCentral()
  return notifyRevealReady(seed, storage, cue, readyAnswer)
}
