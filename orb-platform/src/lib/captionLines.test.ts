import { describe, expect, it } from 'vitest'
import { captionLines, INTRO_PROMPT_LINES } from './captionLines'

describe('captionLines', () => {
  it('keeps the speak-about prompt when nothing has been heard', () => {
    expect(captionLines('')).toEqual([...INTRO_PROMPT_LINES])
    expect(captionLines('   ')).toEqual([...INTRO_PROMPT_LINES])
  })

  it('wraps words and keeps only the last few lines', () => {
    const lines = captionLines(
      'I came here because I wanted to meet someone who actually listens',
      3,
      18,
    )
    expect(lines).toHaveLength(3)
    expect(lines.join(' ')).toContain('listens')
    expect(lines.every((line) => line.length <= 18 || line.includes(' '))).toBe(true)
  })
})
