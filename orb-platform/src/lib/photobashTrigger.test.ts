// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetLightingChannel } from './lightingCues'
import {
  notifyRevealReady,
  readLastRevealReady,
  REVEAL_STORAGE_KEY,
  WALL_PHASE_CHANNEL,
} from './photobashTrigger'

class RecordingChannel {
  static messages: { name: string; message: unknown }[] = []
  onmessage: ((event: MessageEvent) => void) | null = null

  constructor(public name: string) {}

  postMessage(message: unknown) {
    RecordingChannel.messages.push({ name: this.name, message })
  }

  close() {}
}

describe('notifyRevealReady', () => {
  afterEach(() => {
    RecordingChannel.messages = []
    resetLightingChannel()
    vi.unstubAllGlobals()
    window.localStorage.removeItem(REVEAL_STORAGE_KEY)
  })

  it('stores, broadcasts, and returns a seed for the wall', () => {
    vi.stubGlobal('BroadcastChannel', RecordingChannel)
    const seed = notifyRevealReady(42)
    expect(seed).toBe(42)
    expect(RecordingChannel.messages).toContainEqual({
      name: WALL_PHASE_CHANNEL,
      message: expect.objectContaining({ type: 'reveal-ready', photobashSeed: 42 }),
    })
    expect(readLastRevealReady()?.photobashSeed).toBe(42)
  })
})
