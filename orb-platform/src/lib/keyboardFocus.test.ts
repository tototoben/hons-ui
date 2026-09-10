// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./firehose', () => ({
  publish: vi.fn(),
}))

import { publish } from './firehose'
import {
  keyboardFocusForQuestion,
  publishKeyboardFocus,
  startKeyboardFocusHeartbeat,
} from './keyboardFocus'

describe('keyboardFocusForQuestion', () => {
  it('uses the numeric keyboard for numeric intake (age)', () => {
    expect(keyboardFocusForQuestion({ type: 'text', numeric: true })).toBe('numeric')
  })

  it('uses the letter keyboard for free text', () => {
    expect(keyboardFocusForQuestion({ type: 'text' })).toBe('text')
  })

  it('uses yes/no for binary questions', () => {
    expect(keyboardFocusForQuestion({ type: 'yesno' })).toBe('yesno')
  })

  it('uses a slider for scale questions', () => {
    expect(keyboardFocusForQuestion({ type: 'scale' })).toBe('scale')
  })

  it('hides the keyboard when there is no typing prompt', () => {
    expect(keyboardFocusForQuestion(undefined)).toBe('hidden')
  })
})

describe('publishKeyboardFocus', () => {
  beforeEach(() => {
    vi.mocked(publish).mockClear()
  })

  it('sends the current prompt so the iPad can change status per question', () => {
    publishKeyboardFocus('station-2', 'yesno', {
      prompt: 'Is attractiveness important to you?',
    })
    expect(publish).toHaveBeenCalledWith(
      'station-2',
      'keyboard_focus',
      expect.objectContaining({
        mode: 'yesno',
        left: 'YES',
        right: 'NO',
        prompt: 'Is attractiveness important to you?',
        seq: expect.any(Number),
      }),
    )
  })

  it('bumps seq so the iPad applies a repeat of the same layout', () => {
    publishKeyboardFocus('station-2', 'hidden')
    publishKeyboardFocus('station-2', 'hidden')
    const first = vi.mocked(publish).mock.calls[0][2] as { seq: number }
    const second = vi.mocked(publish).mock.calls[1][2] as { seq: number }
    expect(second.seq).toBeGreaterThan(first.seq)
  })
})

describe('startKeyboardFocusHeartbeat', () => {
  beforeEach(() => {
    vi.mocked(publish).mockClear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('republishes keyboard_focus on an interval until stopped', () => {
    const stop = startKeyboardFocusHeartbeat('station-1', 'text', { prompt: 'Name?' }, 1000)
    expect(publish).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    expect(publish).toHaveBeenCalledTimes(2)
    stop()
    vi.advanceTimersByTime(5000)
    expect(publish).toHaveBeenCalledTimes(2)
  })
})
