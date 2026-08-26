import { describe, expect, it } from 'vitest'
import { MEASURED_WALL_BOUNDS, MEASURED_WALL_PANELS } from '../lib/wallRole'

describe('WallSim layout source', () => {
  it('uses the measured six-panel wall bounds', () => {
    expect(MEASURED_WALL_PANELS).toHaveLength(6)
    expect(MEASURED_WALL_BOUNDS.wallW).toBeGreaterThan(3000)
    expect(MEASURED_WALL_BOUNDS.wallH).toBeGreaterThan(5000)
  })

  it('keeps every panel inside the wall bounding box', () => {
    const { wallX, wallY, wallW, wallH } = MEASURED_WALL_BOUNDS
    for (const panel of MEASURED_WALL_PANELS) {
      expect(panel.x).toBeGreaterThanOrEqual(wallX)
      expect(panel.y).toBeGreaterThanOrEqual(wallY)
      expect(panel.x + panel.width).toBeLessThanOrEqual(wallX + wallW)
      expect(panel.y + panel.height).toBeLessThanOrEqual(wallY + wallH)
    }
  })
})
