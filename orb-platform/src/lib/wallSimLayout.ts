import {
  MEASURED_WALL_BOUNDS,
  MEASURED_WALL_PANELS,
  type WallPanelDevice,
  type WallRole,
} from './wallRole'

export type WallSimMode = 'css' | 'physical'

/** Lenovo L24i-4A active area (mm), landscape. */
const LENOVO_ACTIVE_MM = { w: 527, h: 296.5 }

/** TCL 43P615 approx active area (mm), landscape 16:9 on 43" diagonal. */
const TCL_ACTIVE_MM = (() => {
  const diag = 43 * 25.4
  const hyp = Math.hypot(16, 9)
  return { w: (diag * 16) / hyp, h: (diag * 9) / hyp }
})()

export type WallSimPanelLayout = {
  role: WallRole
  device: WallPanelDevice
  label: string
  nativeW: number
  nativeH: number
  left: number
  top: number
  width: number
  height: number
  /** CSS zoom on the iframe to fake TV overscan (1 = none). */
  overscan: number
}

export type WallSimStageLayout = {
  mode: WallSimMode
  stageW: number
  stageH: number
  scale: number
  panels: WallSimPanelLayout[]
}

function activeMm(device: WallPanelDevice, cssW: number, cssH: number) {
  const landscape = cssW >= cssH
  if (device === 'tcl-43p615') {
    return landscape
      ? { w: TCL_ACTIVE_MM.w, h: TCL_ACTIVE_MM.h }
      : { w: TCL_ACTIVE_MM.h, h: TCL_ACTIVE_MM.w }
  }
  return landscape
    ? { w: LENOVO_ACTIVE_MM.w, h: LENOVO_ACTIVE_MM.h }
    : { w: LENOVO_ACTIVE_MM.h, h: LENOVO_ACTIVE_MM.w }
}

/** Typical combined bezel gap between adjacent cabinets (mm). */
export const WALL_SIM_BEZEL_GAP_MM = 18

/** Default TCL overscan exaggeration in the physical sim (~8% zoom). */
export const WALL_SIM_TV_OVERSCAN = 1.08

/**
 * Build a scaled wall stage for the home simulator.
 * - `css`: pixel-perfect (what software thinks) — seams look ideal
 * - `physical`: Lenovo vs TCL real sizes + bezel gaps + TV overscan — seams break
 */
export function buildWallSimLayout(
  mode: WallSimMode,
  viewportWidth: number,
  viewportHeight: number,
): WallSimStageLayout {
  const padX = 32
  const padY = 130
  const availW = Math.max(320, viewportWidth - padX * 2)
  const availH = Math.max(240, viewportHeight - padY)

  if (mode === 'css') {
    const { wallW, wallH, wallX, wallY } = MEASURED_WALL_BOUNDS
    const scale = Math.min(availW / wallW, availH / wallH)
    return {
      mode,
      scale,
      stageW: wallW * scale,
      stageH: wallH * scale,
      panels: MEASURED_WALL_PANELS.map((panel) => ({
        role: panel.role,
        device: panel.device,
        label: panel.label,
        nativeW: panel.width,
        nativeH: panel.height,
        left: (panel.x - wallX) * scale,
        top: (panel.y - wallY) * scale,
        width: panel.width * scale,
        height: panel.height * scale,
        overscan: 1,
      })),
    }
  }

  // Physical: place each panel by real mm size, centered on measured CSS centers,
  // with bezel gaps implied by using outer cabinet footprint.
  const placed = MEASURED_WALL_PANELS.map((panel) => {
    const mm = activeMm(panel.device, panel.width, panel.height)
    const gap = WALL_SIM_BEZEL_GAP_MM
    const cabW = mm.w + gap
    const cabH = mm.h + gap
    const cx = panel.x + panel.width / 2
    const cy = panel.y + panel.height / 2
    // Map measured CSS centers into an mm stage using Lenovo portrait px as reference
    // so relative arrangement stays familiar while sizes diverge.
    const cssPxPerMm = 1080 / LENOVO_ACTIVE_MM.h // portrait width px / mm
    return {
      role: panel.role,
      device: panel.device,
      label: panel.label,
      nativeW: panel.width,
      nativeH: panel.height,
      cxCss: cx,
      cyCss: cy,
      cabW,
      cabH,
      contentW: mm.w,
      contentH: mm.h,
      cssPxPerMm,
      overscan: panel.device === 'tcl-43p615' ? WALL_SIM_TV_OVERSCAN : 1,
    }
  })

  const ref = placed[0].cssPxPerMm
  const mmRects = placed.map((p) => {
    const cxMm = (p.cxCss - MEASURED_WALL_BOUNDS.wallX) / ref
    const cyMm = (p.cyCss - MEASURED_WALL_BOUNDS.wallY) / ref
    return {
      ...p,
      leftMm: cxMm - p.cabW / 2,
      topMm: cyMm - p.cabH / 2,
      widthMm: p.cabW,
      heightMm: p.cabH,
      insetXMm: (p.cabW - p.contentW) / 2,
      insetYMm: (p.cabH - p.contentH) / 2,
    }
  })

  const minX = Math.min(...mmRects.map((r) => r.leftMm))
  const minY = Math.min(...mmRects.map((r) => r.topMm))
  const maxX = Math.max(...mmRects.map((r) => r.leftMm + r.widthMm))
  const maxY = Math.max(...mmRects.map((r) => r.topMm + r.heightMm))
  const stageMmW = maxX - minX
  const stageMmH = maxY - minY
  const scale = Math.min(availW / stageMmW, availH / stageMmH)

  return {
    mode,
    scale,
    stageW: stageMmW * scale,
    stageH: stageMmH * scale,
    panels: mmRects.map((r) => ({
      role: r.role,
      device: r.device,
      label: r.label,
      nativeW: r.nativeW,
      nativeH: r.nativeH,
      left: (r.leftMm - minX + r.insetXMm) * scale,
      top: (r.topMm - minY + r.insetYMm) * scale,
      width: r.contentW * scale,
      height: r.contentH * scale,
      overscan: r.overscan,
    })),
  }
}
