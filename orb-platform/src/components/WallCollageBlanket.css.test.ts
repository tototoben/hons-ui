import { describe, expect, it } from 'vitest'
import collageStyles from './WallCollageBlanket.css?raw'
import collageSource from './WallCollageBlanket.tsx?raw'

describe('WallCollageBlanket styles', () => {
  it('suppresses the shared face mount fade for a hard cut', () => {
    expect(collageStyles).toMatch(
      /\.wall-collage-blanket\s*\{[^}]*animation:\s*none;?[^}]*\}/,
    )
  })

  it('keeps legacy face and glitch CSS out of the production collage surface', () => {
    expect(collageSource).not.toContain("./WallFaceBlanket.css")
    expect(collageStyles).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
