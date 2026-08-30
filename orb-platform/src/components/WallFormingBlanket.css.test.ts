// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import formingStyles from './WallFormingBlanket.css?raw'

describe('WallFormingBlanket caption', () => {
  afterEach(() => {
    document.head.replaceChildren()
    document.body.replaceChildren()
  })

  it('uses fleshy uppercase tracking, not the cream MATCH LOCKED chip', () => {
    const style = document.createElement('style')
    style.textContent = formingStyles
    document.head.append(style)

    const chip = document.createElement('div')
    chip.className = 'wall-forming-caption'
    document.body.append(chip)

    const computed = getComputedStyle(chip)
    expect(computed.letterSpacing).toBe('0.18em')
    expect(computed.textTransform).toBe('uppercase')
    expect(computed.color).toBe('rgb(242, 200, 180)')
    expect(formingStyles).toContain('#f2c8b4')
    expect(formingStyles).not.toContain('255, 244, 232')
  })
})
