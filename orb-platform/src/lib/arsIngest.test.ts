import { describe, expect, it } from 'vitest'
import { sanitizeSpokenIntro } from './arsIngest'

describe('sanitizeSpokenIntro', () => {
  it('drops whisper noise shorter than the minimum', () => {
    expect(sanitizeSpokenIntro('thanks for watching')).toBe('')
    expect(sanitizeSpokenIntro('  hi  ')).toBe('')
  })

  it('keeps a real self-introduction', () => {
    const intro = 'I am Ada and I like long walks in the rain.'
    expect(sanitizeSpokenIntro(intro)).toBe(intro)
  })
})
