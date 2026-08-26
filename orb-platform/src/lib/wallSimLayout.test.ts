import { describe, expect, it } from 'vitest'
import { buildWallSimLayout, WALL_SIM_TV_OVERSCAN } from './wallSimLayout'

describe('buildWallSimLayout', () => {
  it('keeps css mode panels in measured pixel proportions', () => {
    const layout = buildWallSimLayout('css', 1600, 1000)
    expect(layout.panels).toHaveLength(6)
    const code = layout.panels.find((p) => p.role === 'code')
    const debra = layout.panels.find((p) => p.role === 'debra')
    expect(code).toBeTruthy()
    expect(debra).toBeTruthy()
    expect(code!.overscan).toBe(1)
    expect(debra!.overscan).toBe(1)
    // Same CSS px aspect as measured panels
    expect(code!.width / code!.height).toBeCloseTo(1080 / 1920, 3)
  })

  it('makes TCL panels physically larger than Lenovos and applies TV overscan', () => {
    const layout = buildWallSimLayout('physical', 1600, 1000)
    const lenovo = layout.panels.find((p) => p.device === 'lenovo-l24i-4a')!
    const tcl = layout.panels.find((p) => p.device === 'tcl-43p615')!
    expect(tcl.width * tcl.height).toBeGreaterThan(lenovo.width * lenovo.height)
    expect(tcl.overscan).toBe(WALL_SIM_TV_OVERSCAN)
    expect(lenovo.overscan).toBe(1)
  })
})
