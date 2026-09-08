import { physicalWallLayout } from './wallPhysicalLayout'
import { MATCH_FACE_SIZE } from './wallMatchPhotobash'
import type { CollageRect } from './wallCollagePhotobash'
import type { WallRole } from './wallRole'

/** One physical coordinate system for the six-monitor installation and its crops. */
export function physicalCollageLayout(role: WallRole, mouth: CollageRect) {
  const wall = physicalWallLayout()
  const panel = wall.panels.find((entry) => entry.role === role)!
  const leftEye = wall.panels.find((entry) => entry.role === 'code')!
  const mouthScreen = wall.panels.find((entry) => entry.role === 'debra')!
  // Fill the full physical wall, including the low pair, with a larger portrait.
  const faceW = wall.stageW * 1.5
  const faceH = faceW * MATCH_FACE_SIZE.height / MATCH_FACE_SIZE.width
  const margin = 30
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
  const faceX = clamp((wall.stageW - faceW) / 2,
    mouthScreen.left + margin - mouth.x * faceW,
    mouthScreen.left + mouthScreen.width - margin - (mouth.x + mouth.w) * faceW)
  const faceY = clamp(leftEye.top + leftEye.height * 0.72 - 0.385 * faceH,
    mouthScreen.top + margin - mouth.y * faceH,
    mouthScreen.top + mouthScreen.height - margin - (mouth.y + mouth.h) * faceH)
  return {
    panel: {
      panelX: panel.left, panelY: panel.top,
      panelWidth: panel.width, panelHeight: panel.height,
      wallWidth: wall.stageW, wallHeight: wall.stageH,
    },
    faceW, faceH, faceX, faceY,
  }
}
