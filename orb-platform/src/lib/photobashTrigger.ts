import { publish } from './firehose'
import { collageCueFromLocalAnswers, collageCueFromVisitCentral, parseCollageCue, type CollageCue } from './collageCue'
import { mintPhotobashSeed } from './photobashLoop'
import {
  activateNextPhotowallJob,
  completePhotowallJob,
  enqueuePhotowallReveal,
  readPhotowallQueue,
  type PhotowallJob,
} from './photowallQueue'
import { pickVisitAtStation, pickVisitForReveal, refreshVisitCache } from './visitCentral'

export const WALL_PHASE_CHANNEL = 'hons-station3-wall-phase'
export const REVEAL_STORAGE_KEY = 'hons-photobash-reveal'

export type RevealReadyMessage = {
  type: 'reveal-ready'
  photobashSeed: number
  ts: number
  collageCue: CollageCue
  visitId?: string | null
  transcript?: string
  transcriptSource?: 'spoken' | 'synthetic'
  jobId?: string
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

function broadcastRevealReady(message: RevealReadyMessage, storage?: Pick<Storage, 'setItem'>) {
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
}

function publishRevealReadyEvent(
  job: PhotowallJob,
  readyAnswer?: 'yes' | 'skip',
) {
  publish('station-3', 'reveal_ready', {
    photobashSeed: job.photobashSeed,
    collageCue: job.collageCue,
    transcript: job.transcript,
    transcriptSource: job.transcriptSource,
    visitId: job.visitId,
    queueJobId: job.id,
    ...(readyAnswer ? { readyAnswer } : {}),
  })
}

export function dispatchPhotowallJob(
  job: PhotowallJob,
  readyAnswer?: 'yes' | 'skip',
  storage: Pick<Storage, 'setItem'> | undefined = defaultStorage(),
): number {
  const message: RevealReadyMessage = {
    type: 'reveal-ready',
    photobashSeed: job.photobashSeed,
    ts: Date.now(),
    collageCue: job.collageCue,
    visitId: job.visitId,
    transcript: job.transcript,
    transcriptSource: job.transcriptSource,
    jobId: job.id,
  }
  broadcastRevealReady(message, storage)
  publishRevealReadyEvent(job, readyAnswer)
  return job.photobashSeed
}

export function tryActivatePhotowallQueue(
  readyAnswer?: 'yes' | 'skip',
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = defaultStorage(),
): number | null {
  const job = activateNextPhotowallJob(storage)
  if (!job) return null
  return dispatchPhotowallJob(job, readyAnswer, storage)
}

export function completeActivePhotowallJob(
  jobId: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = defaultStorage(),
) {
  completePhotowallJob(jobId, storage)
  tryActivatePhotowallQueue(undefined, storage)
}

export type NotifyRevealReadyInput = {
  seed?: number
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  cue?: CollageCue
  readyAnswer?: 'yes' | 'skip'
  visitId?: string | null
  transcript?: string
  transcriptSource?: 'spoken' | 'synthetic'
}

export function notifyRevealReady(
  seedOrInput: number | NotifyRevealReadyInput = {},
): number {
  const input = typeof seedOrInput === 'number' ? { seed: seedOrInput } : seedOrInput
  const storage = input.storage ?? defaultStorage()
  const seed = input.seed ?? mintPhotobashSeed()
  const cue = input.cue ?? collageCueFromLocalAnswers()
  enqueuePhotowallReveal(
    {
      visitId: input.visitId ?? null,
      photobashSeed: seed,
      collageCue: cue,
      transcript: input.transcript ?? '',
      transcriptSource: input.transcriptSource ?? 'synthetic',
    },
    storage,
  )
  const activated = tryActivatePhotowallQueue(input.readyAnswer, storage)
  if (activated !== null) return activated
  const snapshot = readPhotowallQueue(storage)
  const pending = snapshot.jobs.find((job) => job.status === 'pending')
  return pending?.photobashSeed ?? seed
}

/** Refresh central visit data, then enqueue reveal for the photowall queue. */
export async function notifyRevealReadyFromVisit(options: {
  seed?: number
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  readyAnswer?: 'yes' | 'skip'
  transcript?: string
  transcriptSource?: 'spoken' | 'synthetic'
  visitId?: string | null
} = {}): Promise<number> {
  await refreshVisitCache(true)
  const cue = await collageCueFromVisitCentral()
  const visit =
    pickVisitAtStation(3) ?? pickVisitForReveal()
  return notifyRevealReady({
    seed: options.seed,
    storage: options.storage,
    cue,
    readyAnswer: options.readyAnswer,
    visitId: options.visitId ?? visit?.visit_id ?? null,
    transcript: options.transcript,
    transcriptSource: options.transcriptSource ?? 'synthetic',
  })
}
