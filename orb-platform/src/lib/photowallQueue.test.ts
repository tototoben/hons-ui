// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activateNextPhotowallJob,
  completePhotowallJob,
  enqueuePhotowallReveal,
  photowallQueueStatus,
  readPhotowallQueue,
  resetPhotowallQueueForTests,
} from './photowallQueue'
import { notifyRevealReady, WALL_PHASE_CHANNEL } from './photobashTrigger'

class RecordingChannel {
  static messages: { name: string; message: unknown }[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  constructor(public name: string) {}
  postMessage(message: unknown) {
    RecordingChannel.messages.push({ name: this.name, message })
  }
  close() {}
}

describe('photowallQueue', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    resetPhotowallQueueForTests()
    storage.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    })
    RecordingChannel.messages = []
    vi.stubGlobal('BroadcastChannel', RecordingChannel)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetPhotowallQueueForTests()
  })

  it('dedupes pending jobs for the same visit', () => {
    const first = enqueuePhotowallReveal({
      visitId: 'v-1',
      photobashSeed: 11,
      collageCue: {},
      transcript: 'first',
      transcriptSource: 'synthetic',
    })
    const second = enqueuePhotowallReveal({
      visitId: 'v-1',
      photobashSeed: 22,
      collageCue: {},
      transcript: 'second',
      transcriptSource: 'synthetic',
    })
    expect(first.id).toBe(second.id)
    expect(readPhotowallQueue().jobs).toHaveLength(1)
  })

  it('processes jobs one at a time', () => {
    enqueuePhotowallReveal({
      visitId: 'v-1',
      photobashSeed: 1,
      collageCue: {},
      transcript: 'one',
      transcriptSource: 'synthetic',
    })
    enqueuePhotowallReveal({
      visitId: 'v-2',
      photobashSeed: 2,
      collageCue: {},
      transcript: 'two',
      transcriptSource: 'synthetic',
    })
    const first = activateNextPhotowallJob()
    expect(first?.status).toBe('processing')
    expect(photowallQueueStatus().busy).toBe(true)
    expect(photowallQueueStatus().waiting).toBe(1)
    completePhotowallJob(first!.id)
    const second = activateNextPhotowallJob()
    expect(second?.visitId).toBe('v-2')
  })
})

describe('notifyRevealReady queue integration', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    resetPhotowallQueueForTests()
    storage.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    })
    RecordingChannel.messages = []
    vi.stubGlobal('BroadcastChannel', RecordingChannel)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetPhotowallQueueForTests()
  })

  it('broadcasts immediately for the first job and queues the second', () => {
    notifyRevealReady({
      visitId: 'v-1',
      seed: 42,
      transcript: 'Ada speaks',
      transcriptSource: 'spoken',
    })
    notifyRevealReady({
      visitId: 'v-2',
      seed: 43,
      transcript: 'Ben speaks',
      transcriptSource: 'synthetic',
    })
    expect(RecordingChannel.messages).toContainEqual({
      name: WALL_PHASE_CHANNEL,
      message: expect.objectContaining({ type: 'reveal-ready', photobashSeed: 42 }),
    })
    expect(photowallQueueStatus().waiting).toBe(1)
  })
})
