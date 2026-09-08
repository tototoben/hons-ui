import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./firehose', () => ({
  publish: vi.fn(),
}))

import { publish } from './firehose'
import { keyboardFocusForQuestion, publishKeyboardFocus } from './keyboardFocus'

describe('keyboardFocusForQuestion', () => {
  it('uses a numpad for numeric intake', () => {
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
      }),
    )
  })
})

