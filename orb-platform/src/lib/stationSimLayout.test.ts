import { describe, expect, it } from 'vitest'
import {
  CSS_PX_PER_MM,
  HP_27W_PORTRAIT_MM,
  HP_27W_STATION,
  buildStationSimFloor,
  buildStationSimStage,
  parseStationSimFrame,
} from './stationSimLayout'

describe('stationSimLayout', () => {
  it('treats the kiosk as HP 27w portrait 1080×1920', () => {
    expect(HP_27W_STATION.portraitCss).toEqual({ w: 1080, h: 1920 })
    expect(HP_27W_PORTRAIT_MM).toEqual({ w: 336, h: 598 })
  })

  it('detects the iframe chrome flag', () => {
    expect(parseStationSimFrame('?stationSimFrame=1')).toBe(true)
    expect(parseStationSimFrame('?wallRole=copy')).toBe(false)
  })

  it('makes life-size match CSS millimetres of the pixel pitch', () => {
    const stage = buildStationSimStage('life', 2000, 3000)
    const px = HP_27W_STATION.pixelPitchMm * CSS_PX_PER_MM
    expect(stage.scale).toBeCloseTo(px, 5)
    expect(stage.stageW).toBeCloseTo(1080 * px, 5)
    expect(stage.stageH).toBeCloseTo(1920 * px, 5)
    expect(stage.percentOfPhysical).toBeCloseTo(100, 5)
    expect(stage.ruler100MmPx).toBeCloseTo(100 * CSS_PX_PER_MM, 5)
  })

  it('halves physical size and fits inside the window in fit mode', () => {
    const half = buildStationSimStage('half', 1600, 900)
    expect(half.percentOfPhysical).toBeCloseTo(50, 5)
    const fit = buildStationSimStage('fit', 800, 600, 72)
    expect(fit.stageW).toBeLessThanOrEqual(760)
    expect(fit.stageH).toBeLessThanOrEqual(528)
  })

  it('places the photobash wall beside the station at a shared millimetre scale', () => {
    const floor = buildStationSimFloor('half', 'css', 4000, 3000)
    expect(floor.wall.panels).toHaveLength(6)
    expect(floor.floorW).toBeGreaterThan(floor.station.stageW)
    expect(floor.percentOfPhysical).toBeCloseTo(50, 5)
    const physical = buildStationSimFloor('half', 'physical', 4000, 3000)
    const cssCopy = floor.wall.panels.find((panel) => panel.role === 'copy')!
    const physCopy = physical.wall.panels.find((panel) => panel.role === 'copy')!
    const cssAvatar = floor.wall.panels.find((panel) => panel.role === 'avatar')!
    const physAvatar = physical.wall.panels.find((panel) => panel.role === 'avatar')!
    expect(physAvatar.width / physCopy.width).toBeGreaterThan(cssAvatar.width / cssCopy.width)
  })
})
