import { describe, expect, it } from 'vitest'
import { notifyRevealReady } from './photobashTrigger'

describe('notifyRevealReady', () => {
  it('is a callable no-op for the later kiosk-to-wall handoff', () => {
    expect(notifyRevealReady()).toBeUndefined()
  })
})
