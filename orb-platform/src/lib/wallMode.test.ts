import { describe, expect, it } from 'vitest'
import {
  buildWallModeUrl,
  parseWallMode,
  wallDesignPlacement,
  wallModeTransform,
} from './wallMode'

describe('parseWallMode', () => {
  it('returns null when wall mode is disabled', () => {
    expect(parseWallMode('?quality=kiosk')).toBeNull()
  })

  it('parses a valid wall panel rect', () => {
    expect(parseWallMode('?wall=1&wallW=6000&wallH=2000&panelX=1200&panelY=0&panelW=1080&panelH=1920')).toEqual({
      wallWidth: 6000,
      wallHeight: 2000,
      panelX: 1200,
      panelY: 0,
      panelWidth: 1080,
      panelHeight: 1920,
    })
  })

  it('rejects panels that extend outside the wall canvas', () => {
    expect(parseWallMode('?wall=1&wallW=1000&wallH=1000&panelX=900&panelY=0&panelW=200&panelH=200')).toBeNull()
  })
})

describe('wallModeTransform', () => {
  it('covers the panel region inside the viewport', () => {
    const panel = {
      wallWidth: 6000,
      wallHeight: 2000,
      panelX: 1200,
      panelY: 0,
      panelWidth: 1080,
      panelHeight: 1920,
    }
    const transform = wallModeTransform(panel, 1080, 1920)
    expect(transform.scale).toBe(1)
    expect(transform.translateX).toBe(-1200)
    expect(transform.translateY).toEqual(0)
  })

  it('scales up when the viewport is larger than the panel slice', () => {
    const panel = {
      wallWidth: 3000,
      wallHeight: 1000,
      panelX: 0,
      panelY: 0,
      panelWidth: 1000,
      panelHeight: 500,
    }
    const transform = wallModeTransform(panel, 2000, 1000)
    expect(transform.scale).toBe(2)
    expect(transform.translateX).toEqual(0)
    expect(transform.translateY).toEqual(0)
  })
})

describe('wallDesignPlacement', () => {
  it('cover-scales the portrait design onto the measured wall', () => {
    const placement = wallDesignPlacement(3585, 5258)
    expect(placement.scale).toBeCloseTo(Math.max(3585 / 1080, 5258 / 1920), 5)
    expect(placement.offsetX + 1080 * placement.scale).toBeGreaterThanOrEqual(3585)
    expect(placement.offsetY + 1920 * placement.scale).toBeGreaterThanOrEqual(5258)
  })
})

describe('buildWallModeUrl', () => {
  it('builds a station III wall URL with panel bounds', () => {
    const url = buildWallModeUrl(
      'https://house-of-negotiated-selves.vercel.app/',
      '#/mirror',
      {
        wallWidth: 6000,
        wallHeight: 2000,
        panelX: 0,
        panelY: 0,
        panelWidth: 1000,
        panelHeight: 1000,
      },
    )
    expect(url).toContain('wall=1')
    expect(url).toContain('panelX=0')
    expect(url).not.toContain('quality=kiosk')
    expect(url).toContain('#/mirror')
  })
})
