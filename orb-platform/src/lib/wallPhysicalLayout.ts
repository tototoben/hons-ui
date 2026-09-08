import { MEASURED_WALL_PANELS, type WallRole } from './wallRole'

/** Active-area origins estimated from the installation photo IMG_7904.HEIC.
 * Millimetres, front elevation. Desktop window origins remain independent.
 * Hardware: four Lenovo L24i-4A monitors and two TCL 43P615 TVs.
 */
const ORIGINS_MM: Record<WallRole, { x: number; y: number }> = {
  code: { x: 310, y: 0 },
  status: { x: 650, y: 0 },
  debra: { x: 0, y: 575 },
  avatar: { x: 1010, y: 150 },
  copy: { x: 550, y: 1210 },
  guide: { x: 910, y: 1230 },
}

export function physicalWallLayout() {
  const inset = 9
  const tvDiagonalMm = 43 * 25.4
  const panels = MEASURED_WALL_PANELS.map((panel) => {
    const landscape = panel.device === 'tcl-43p615'
      ? { w: tvDiagonalMm * 16 / Math.hypot(16, 9), h: tvDiagonalMm * 9 / Math.hypot(16, 9) }
      : { w: 527, h: 296.5 }
    const portrait = panel.height > panel.width
    return {
      role: panel.role,
      left: ORIGINS_MM[panel.role].x + inset,
      top: ORIGINS_MM[panel.role].y + inset,
      width: portrait ? landscape.h : landscape.w,
      height: portrait ? landscape.w : landscape.h,
    }
  })
  return {
    panels,
    stageW: Math.max(...panels.map((p) => p.left + p.width)) + inset,
    stageH: Math.max(...panels.map((p) => p.top + p.height)) + inset,
  }
}
