import type { CollageCue } from './collageCue'
import { parseCollageCue } from './collageCue'

export const PHOTOWALL_QUEUE_STORAGE_KEY = 'hons-photowall-queue'
export const PHOTOWALL_QUEUE_CHANNEL = 'hons-photowall-queue'

export type PhotowallJobStatus = 'pending' | 'processing' | 'completed' | 'error'

export type PhotowallJob = {
  id: string
  visitId: string | null
  photobashSeed: number
  collageCue: CollageCue
  transcript: string
  transcriptSource: 'spoken' | 'synthetic'
  enqueuedAt: number
  status: PhotowallJobStatus
  startedAt?: number
  completedAt?: number
  error?: string
}

export type PhotowallQueueSnapshot = {
  jobs: PhotowallJob[]
  activeJobId: string | null
  updatedAt: number
}

type QueueMessage =
  | { type: 'queue-updated'; snapshot: PhotowallQueueSnapshot }
  | { type: 'activate'; jobId: string }

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage
}

let memorySnapshot: PhotowallQueueSnapshot = {
  jobs: [],
  activeJobId: null,
  updatedAt: 0,
}

function emptySnapshot(): PhotowallQueueSnapshot {
  return { jobs: [], activeJobId: null, updatedAt: Date.now() }
}

function isJob(value: unknown): value is PhotowallJob {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const raw = value as Record<string, unknown>
  return (
    typeof raw.id === 'string' &&
    (raw.visitId === null || typeof raw.visitId === 'string') &&
    typeof raw.photobashSeed === 'number' &&
    typeof raw.transcript === 'string' &&
    (raw.transcriptSource === 'spoken' || raw.transcriptSource === 'synthetic') &&
    typeof raw.enqueuedAt === 'number' &&
    (raw.status === 'pending' ||
      raw.status === 'processing' ||
      raw.status === 'completed' ||
      raw.status === 'error')
  )
}

function parseSnapshot(raw: unknown): PhotowallQueueSnapshot {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptySnapshot()
  const body = raw as Record<string, unknown>
  const jobs = Array.isArray(body.jobs) ? body.jobs.filter(isJob) : []
  const activeJobId = typeof body.activeJobId === 'string' ? body.activeJobId : null
  return {
    jobs: jobs.map((job) => ({
      ...job,
      collageCue: parseCollageCue(job.collageCue),
    })),
    activeJobId,
    updatedAt: typeof body.updatedAt === 'number' ? body.updatedAt : Date.now(),
  }
}

function persistSnapshot(
  snapshot: PhotowallQueueSnapshot,
  storage: Pick<Storage, 'setItem'> | undefined = defaultStorage(),
) {
  memorySnapshot = snapshot
  try {
    storage?.setItem(PHOTOWALL_QUEUE_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Privacy-restricted kiosk storage — memory snapshot still works in-tab.
  }
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(PHOTOWALL_QUEUE_CHANNEL)
    channel.postMessage({ type: 'queue-updated', snapshot } satisfies QueueMessage)
    channel.close()
  }
}

export function readPhotowallQueue(
  storage: Pick<Storage, 'getItem'> | undefined = defaultStorage(),
): PhotowallQueueSnapshot {
  try {
    const raw = storage?.getItem(PHOTOWALL_QUEUE_STORAGE_KEY)
    if (!raw) return memorySnapshot
    const parsed = parseSnapshot(JSON.parse(raw) as unknown)
    memorySnapshot = parsed
    return parsed
  } catch {
    return memorySnapshot
  }
}

export function resetPhotowallQueueForTests() {
  memorySnapshot = emptySnapshot()
}

export function photowallQueueStatus(snapshot: PhotowallQueueSnapshot = readPhotowallQueue()) {
  const pending = snapshot.jobs.filter((job) => job.status === 'pending').length
  const processing = snapshot.jobs.filter((job) => job.status === 'processing').length
  const completed = snapshot.jobs.filter((job) => job.status === 'completed').length
  const errored = snapshot.jobs.filter((job) => job.status === 'error').length
  const active = snapshot.jobs.find((job) => job.id === snapshot.activeJobId) ?? null
  return {
    pending,
    processing,
    completed,
    errored,
    active,
    busy: processing > 0,
    waiting: pending,
  }
}

export type EnqueueRevealInput = {
  visitId?: string | null
  photobashSeed: number
  collageCue: CollageCue
  transcript: string
  transcriptSource: 'spoken' | 'synthetic'
}

export function enqueuePhotowallReveal(
  input: EnqueueRevealInput,
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = defaultStorage(),
): PhotowallJob {
  const snapshot = readPhotowallQueue(storage)
  const visitId = input.visitId ?? null
  const duplicate = snapshot.jobs.find(
    (job) =>
      visitId &&
      job.visitId === visitId &&
      (job.status === 'pending' || job.status === 'processing'),
  )
  if (duplicate) return duplicate

  const job: PhotowallJob = {
    id: `pw-${input.photobashSeed}-${Date.now()}`,
    visitId,
    photobashSeed: input.photobashSeed,
    collageCue: parseCollageCue(input.collageCue),
    transcript: input.transcript.trim(),
    transcriptSource: input.transcriptSource,
    enqueuedAt: Date.now(),
    status: 'pending',
  }
  const next: PhotowallQueueSnapshot = {
    jobs: [...snapshot.jobs, job],
    activeJobId: snapshot.activeJobId,
    updatedAt: Date.now(),
  }
  persistSnapshot(next, storage)
  return job
}

export function activateNextPhotowallJob(
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = defaultStorage(),
): PhotowallJob | null {
  const snapshot = readPhotowallQueue(storage)
  if (snapshot.activeJobId) {
    const active = snapshot.jobs.find((job) => job.id === snapshot.activeJobId)
    if (active?.status === 'processing') return null
  }
  const next = snapshot.jobs.find((job) => job.status === 'pending')
  if (!next) return null
  const jobs = snapshot.jobs.map((job) =>
    job.id === next.id
      ? { ...job, status: 'processing' as const, startedAt: Date.now(), error: undefined }
      : job,
  )
  persistSnapshot({ jobs, activeJobId: next.id, updatedAt: Date.now() }, storage)
  return jobs.find((job) => job.id === next.id) ?? null
}

export function completePhotowallJob(
  jobId: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = defaultStorage(),
) {
  const snapshot = readPhotowallQueue(storage)
  const jobs = snapshot.jobs.map((job) =>
    job.id === jobId
      ? { ...job, status: 'completed' as const, completedAt: Date.now(), error: undefined }
      : job,
  )
  persistSnapshot(
    {
      jobs,
      activeJobId: snapshot.activeJobId === jobId ? null : snapshot.activeJobId,
      updatedAt: Date.now(),
    },
    storage,
  )
}

export function failPhotowallJob(
  jobId: string,
  error: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = defaultStorage(),
) {
  const snapshot = readPhotowallQueue(storage)
  const jobs = snapshot.jobs.map((job) =>
    job.id === jobId
      ? { ...job, status: 'error' as const, completedAt: Date.now(), error }
      : job,
  )
  persistSnapshot(
    {
      jobs,
      activeJobId: snapshot.activeJobId === jobId ? null : snapshot.activeJobId,
      updatedAt: Date.now(),
    },
    storage,
  )
}

export function subscribePhotowallQueue(
  listener: (snapshot: PhotowallQueueSnapshot) => void,
): () => void {
  listener(readPhotowallQueue())
  if (typeof BroadcastChannel === 'undefined') return () => undefined
  const channel = new BroadcastChannel(PHOTOWALL_QUEUE_CHANNEL)
  channel.onmessage = (event: MessageEvent<QueueMessage>) => {
    if (event.data?.type === 'queue-updated') {
      memorySnapshot = event.data.snapshot
      listener(event.data.snapshot)
    }
  }
  return () => channel.close()
}

export function clearPhotowallQueueForRoomReset(
  storage: Pick<Storage, 'removeItem'> | undefined = defaultStorage() as Storage | undefined,
) {
  memorySnapshot = emptySnapshot()
  try {
    storage?.removeItem(PHOTOWALL_QUEUE_STORAGE_KEY)
  } catch {
    // ignore
  }
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(PHOTOWALL_QUEUE_CHANNEL)
    channel.postMessage({ type: 'queue-updated', snapshot: memorySnapshot })
    channel.close()
  }
}
