import { describe, expect, it } from 'vitest'
import {
  MEASURED_WALL_BOUNDS,
  MEASURED_WALL_PANELS,
  measuredPanelForRole,
  parseWallBare,
  parseWallCalibrate,
  parseWallCollage,
  parseWallRole,
  WALL_ROLES,
} from './wallRole'

describe('parseWallRole', () => {
  it('returns null without a wallRole param', () => {
    expect(parseWallRole('?wall=1')).toBeNull()
  })

  it('parses each supported wall role', () => {
    for (const role of WALL_ROLES) {
      expect(parseWallRole(`?wallRole=${role}`)).toBe(role)
    }
  })

  it('rejects unknown roles', () => {
    expect(parseWallRole('?wallRole=nope')).toBeNull()
  })
})

describe('parseWallCalibrate', () => {
  it('is off by default', () => {
    expect(parseWallCalibrate('?wallRole=code')).toBe(false)
  })

  it('turns on with wallCal=1', () => {
    expect(parseWallCalibrate('?wallRole=code&wallCal=1')).toBe(true)
  })
})

describe('parseWallBare', () => {
  it('is off by default so gallery captions stay', () => {
    expect(parseWallBare('?wallRole=code&collage=1')).toBe(false)
  })

  it('turns on with bare=1', () => {
    expect(parseWallBare('?wallRole=code&bare=1')).toBe(true)
  })
})

describe('parseWallCollage', () => {
  it('is on by default so the collage photobash is live', () => {
    expect(parseWallCollage('?wallRole=code')).toBe(true)
  })

  it('stays on with collage=1', () => {
    expect(parseWallCollage('?wallRole=code&collage=1')).toBe(true)
  })

  it('falls back to WallFaceBlanket with collage=0', () => {
    expect(parseWallCollage('?wallRole=code&collage=0')).toBe(false)
  })
})

describe('MEASURED_WALL_PANELS', () => {
  it('assigns every role exactly once for the install', () => {
    expect(MEASURED_WALL_PANELS).toHaveLength(6)
    expect(MEASURED_WALL_PANELS.map((panel) => panel.role).sort()).toEqual([...WALL_ROLES].sort())
  })

  it('puts avatar on the tall portrait TCL', () => {
    const avatar = MEASURED_WALL_PANELS.find((panel) => panel.role === 'avatar')
    expect(avatar?.device).toBe('tcl-43p615')
    expect(avatar?.width).toBe(1080)
    expect(avatar?.height).toBe(1920)
  })

  it('puts guide on the landscape Lenovo', () => {
    const guide = MEASURED_WALL_PANELS.find((panel) => panel.role === 'guide')
    expect(guide?.device).toBe('lenovo-l24i-4a')
    expect(guide?.width).toBe(1920)
    expect(guide?.height).toBe(1080)
  })

  it('exposes panel rects relative to the wall origin', () => {
    const copy = measuredPanelForRole('copy')
    expect(MEASURED_WALL_BOUNDS.wallW).toBe(3585)
    expect(MEASURED_WALL_BOUNDS.wallH).toBe(5258)
    expect(copy?.panelX).toBe(392)
    expect(copy?.panelY).toBe(3338)
  })
})
