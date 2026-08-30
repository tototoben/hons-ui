// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import formingStyles from './WallFormingBlanket.css?raw'

describe('WallFormingBlanket caption', () => {
  afterEach(() => {
    document.head.replaceChildren()
    document.body.replaceChildren()
  })

  it('does not paint forming copy on the wall plate', () => {
    expect(formingStyles).not.toContain('wall-forming-caption')
    expect(formingStyles).not.toContain('PARTNER FORMING')
  })

  it('suppresses the shared face mount fade for a hard cut', () => {
    expect(formingStyles).toMatch(
      /\.wall-forming-blanket\s*\{[^}]*animation:\s*none;?[^}]*\}/,
    )
  })
})
