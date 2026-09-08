import { describe, expect, it } from 'vitest'
import { physicalCollageLayout } from './wallCollageLayout'
import { collageRects, mouthRectIndex } from './wallCollagePhotobash'
import { WALL_ROLES } from './wallRole'

describe('physical collage placement', () => {
  it('keeps the entire animated mouth inside the landscape TV across seeded variations', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rects = collageRects(seed)
      const mouth = rects[mouthRectIndex(rects)]
      const { panel, faceX, faceY, faceW, faceH } = physicalCollageLayout('debra', mouth)
      expect(faceX + mouth.x * faceW).toBeGreaterThanOrEqual(panel.panelX + 29)
      expect(faceY + mouth.y * faceH).toBeGreaterThanOrEqual(panel.panelY + 29)
      expect(faceX + (mouth.x + mouth.w) * faceW).toBeLessThanOrEqual(panel.panelX + panel.panelWidth - 29)
      expect(faceY + (mouth.y + mouth.h) * faceH).toBeLessThanOrEqual(panel.panelY + panel.panelHeight - 29)
      for (const role of WALL_ROLES) {
        const other = physicalCollageLayout(role, mouth)
        expect([other.faceX, other.faceY, other.faceW, other.faceH]).toEqual([faceX, faceY, faceW, faceH])
      }
    }
  })
  it('covers every physical screen with the enlarged portrait', () => {
    const rects = collageRects(1)
    for (const role of WALL_ROLES) {
      const { panel, faceX, faceY, faceW, faceH } = physicalCollageLayout(role, rects[mouthRectIndex(rects)])
      expect(faceX).toBeLessThanOrEqual(panel.panelX)
      expect(faceY).toBeLessThanOrEqual(panel.panelY)
      expect(faceX + faceW).toBeGreaterThanOrEqual(panel.panelX + panel.panelWidth)
      expect(faceY + faceH).toBeGreaterThanOrEqual(panel.panelY + panel.panelHeight)
    }
  })
})
