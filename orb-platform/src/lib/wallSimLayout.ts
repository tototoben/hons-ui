import {
  MEASURED_WALL_BOUNDS,
  MEASURED_WALL_PANELS,
  type WallPanelDevice,
  type WallRole,
} from './wallRole'

export type WallSimMode = 'css' | 'physical'

/** Lenovo L24i-4A active area (mm), landscape. */
export const LENOVO_ACTIVE_MM = { w: 527, h: 296.5 }

/** TCL 43P615 approx active area (mm), landscape 16:9 on 43" diagonal. */
export const TCL_ACTIVE_MM = (() => {
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

function wallCssPanels(previewPxPerCssPx: number): WallSimStageLayout {
  const { wallW, wallH, wallX, wallY } = MEASURED_WALL_BOUNDS
  return {
    mode: 'css',
    scale: previewPxPerCssPx,
    stageW: wallW * previewPxPerCssPx,
    stageH: wallH * previewPxPerCssPx,
    panels: MEASURED_WALL_PANELS.map((panel) => ({
      role: panel.role,
      device: panel.device,
      label: panel.label,
      nativeW: panel.width,
      nativeH: panel.height,
      left: (panel.x - wallX) * previewPxPerCssPx,
      top: (panel.y - wallY) * previewPxPerCssPx,
      width: panel.width * previewPxPerCssPx,
      height: panel.height * previewPxPerCssPx,
      overscan: 1,
    })),
  }
}

/**
 * Active-area origins estimated from IMG_7904.HEIC, in millimetres.
 * Rectified to a front elevation: the photo's slight camera tilt/perspective
 * is not a rotation of the hardware. Screen sizes come from the models above.
 * These are simulator coordinates, independent of macOS desktop crop origins.
 */
const PHOTO_WALL_ORIGINS_MM: Record<WallRole, { x: number; y: number }> = {
  code: { x: 310, y: 0 },
  status: { x: 650, y: 0 },
  debra: { x: 0, y: 575 },
  avatar: { x: 1010, y: 150 },
  copy: { x: 550, y: 1210 },
  guide: { x: 910, y: 1230 },
}

function physicalWallMm() {
  const inset = WALL_SIM_BEZEL_GAP_MM / 2
  const mmRects = MEASURED_WALL_PANELS.map((panel) => {
    const mm = activeMm(panel.device, panel.width, panel.height)
    const origin = PHOTO_WALL_ORIGINS_MM[panel.role]
    return {
      role: panel.role,
      device: panel.device,
      label: panel.label,
      nativeW: panel.width,
      nativeH: panel.height,
      leftMm: origin.x - inset,
      topMm: origin.y - inset,
      widthMm: mm.w + inset * 2,
      heightMm: mm.h + inset * 2,
      contentW: mm.w,
      contentH: mm.h,
      insetXMm: inset,
      insetYMm: inset,
      overscan: panel.device === 'tcl-43p615' ? WALL_SIM_TV_OVERSCAN : 1,
    }
  })
  const minX = Math.min(...mmRects.map((r) => r.leftMm))
  const minY = Math.min(...mmRects.map((r) => r.topMm))
  const maxX = Math.max(...mmRects.map((r) => r.leftMm + r.widthMm))
  const maxY = Math.max(...mmRects.map((r) => r.topMm + r.heightMm))
  return {
    minX,
    minY,
    stageMmW: maxX - minX,
    stageMmH: maxY - minY,
    panels: mmRects,
  }
}

function wallPhysicalPanels(cssPxPerMm: number): WallSimStageLayout {
  const mm = physicalWallMm()
  return {
    mode: 'physical',
    scale: cssPxPerMm,
    stageW: mm.stageMmW * cssPxPerMm,
    stageH: mm.stageMmH * cssPxPerMm,
    panels: mm.panels.map((r) => ({
      role: r.role,
      device: r.device,
      label: r.label,
      nativeW: r.nativeW,
      nativeH: r.nativeH,
      left: (r.leftMm - mm.minX + r.insetXMm) * cssPxPerMm,
      top: (r.topMm - mm.minY + r.insetYMm) * cssPxPerMm,
      width: r.contentW * cssPxPerMm,
      height: r.contentH * cssPxPerMm,
      overscan: r.overscan,
    })),
  }
}

/** Photobash CSS seams at a millimetre scale (Lenovo portrait pitch). */
export function layoutWallCssAtMmScale(cssPxPerMm: number): WallSimStageLayout {
  const mmPerCssPx = LENOVO_ACTIVE_MM.h / 1080
  return wallCssPanels(mmPerCssPx * cssPxPerMm)
}

/** Lenovo vs TCL cabinets at a millimetre scale. */
export function layoutWallPhysicalAtMmScale(cssPxPerMm: number): WallSimStageLayout {
  return wallPhysicalPanels(cssPxPerMm)
}

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
    const { wallW, wallH } = MEASURED_WALL_BOUNDS
    const scale = Math.min(availW / wallW, availH / wallH)
    return wallCssPanels(scale)
  }

  const mm = physicalWallMm()
  const scale = Math.min(availW / mm.stageMmW, availH / mm.stageMmH)
  return wallPhysicalPanels(scale)
}
