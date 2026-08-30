import { describe, expect, it } from 'vitest'
import collageStyles from './WallCollageBlanket.css?raw'

describe('WallCollageBlanket styles', () => {
  it('suppresses the shared face mount fade for a hard cut', () => {
    expect(collageStyles).toMatch(
      /\.wall-collage-blanket\s*\{[^}]*animation:\s*none;?[^}]*\}/,
    )
  })
})
