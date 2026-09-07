import { describe, expect, it } from 'vitest'
import { keyboardFocusForQuestion } from './keyboardFocus'

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

