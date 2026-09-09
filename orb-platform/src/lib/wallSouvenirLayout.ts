import type { CollageRect } from './wallCollagePhotobash'
import { MATCH_FACE_SIZE } from './wallMatchPhotobash'
import type { WallTicketTextSlot } from './wallSouvenirTicket'

export type SouvenirCollagePlacement = {
  x: number
  y: number
  w: number
  h: number
  wallW: number
  wallH: number
}

/** Center the full face plate on the souvenir canvas (eyes + symmetry stay in frame). */
export function computeSouvenirCollagePlacement(
  wallW: number,
  wallH: number,
  plateW = MATCH_FACE_SIZE.width,
  plateH = MATCH_FACE_SIZE.height,
  margin = 0.1,
): SouvenirCollagePlacement {
  const scale = Math.min(
    (wallW * (1 - margin * 2)) / plateW,
    (wallH * (1 - margin * 2)) / plateH,
  )
  const w = plateW * scale
  const h = plateH * scale
  return {
    x: (wallW - w) / 2,
    y: (wallH - h) / 2,
    w,
    h,
    wallW,
    wallH,
  }
}

function scaledCollageRect(
  rect: CollageRect,
  placement: SouvenirCollagePlacement,
): { x: number; y: number; w: number; h: number } {
  return {
    x: placement.x + rect.x * placement.w,
    y: placement.y + rect.y * placement.h,
    w: rect.w * placement.w,
    h: rect.h * placement.h,
  }
}

export function collagePieceRectsInComposite(
  rects: CollageRect[],
  placement: SouvenirCollagePlacement,
) {
  return rects.map((rect) => scaledCollageRect(rect, placement))
}

export function rectOverlapsCollagePiece(
  slot: Pick<WallTicketTextSlot, 'x' | 'y' | 'w' | 'h'>,
  rects: CollageRect[],
  placement: SouvenirCollagePlacement,
  clearance = 18,
): boolean {
  const pieces = collagePieceRectsInComposite(rects, placement)
  return pieces.some((piece) => {
    const px = piece.x - clearance
    const py = piece.y - clearance
    const pw = piece.w + clearance * 2
    const ph = piece.h + clearance * 2
    return (
      slot.x < px + pw &&
      slot.x + slot.w > px &&
      slot.y < py + ph &&
      slot.y + slot.h > py
    )
  })
}

function sideFontSize(marginW: number, wallW: number) {
  return Math.round(Math.min(marginW * 0.46, wallW * 0.075))
}

function bandFontSize(bandH: number, wallW: number) {
  return Math.round(Math.min(bandH * 0.34, wallW * 0.085))
}

/** White margins around the centered collage plus inter-piece gutters. */
export function buildSouvenirTextSlots(
  placement: SouvenirCollagePlacement,
  rects: CollageRect[],
): WallTicketTextSlot[] {
  const { x, y, w, h, wallW, wallH } = placement
  const pad = 14
  const slots: WallTicketTextSlot[] = []

  const leftW = x - pad * 2
  if (leftW >= 48) {
    slots.push({
      role: 'title',
      x: pad,
      y: pad,
      w: leftW,
      h: wallH - pad * 2,
      align: 'left',
      rotate: -90,
      size: sideFontSize(leftW, wallW),
      weight: 700,
      mode: 'stack',
    })
  }

  const rightX = x + w + pad
  const rightW = wallW - rightX - pad
  if (rightW >= 48) {
    slots.push({
      role: 'meta',
      x: rightX,
      y: pad,
      w: rightW,
      h: wallH - pad * 2,
      align: 'left',
      rotate: 90,
      size: sideFontSize(rightW, wallW),
      weight: 600,
      mode: 'stack',
    })
  }

  const topH = y - pad * 2
  const detailH = Math.round(Math.min(topH, topH * 0.55))
  if (detailH >= 56) {
    slots.push({
      role: 'detail',
      x: x + pad,
      y: pad + topH - detailH,
      w: w - pad * 2,
      h: detailH,
      align: 'center',
      rotate: 0,
      size: bandFontSize(detailH, wallW),
      weight: 600,
      mode: 'stack',
    })
  }

  if (rects.length >= 2) {
    const rightEye = scaledCollageRect(rects[0], placement)
    const leftEye = scaledCollageRect(rects[1], placement)
    const gapX = rightEye.x + rightEye.w + pad
    const gapW = leftEye.x - gapX - pad
    const gapY = Math.min(rightEye.y, leftEye.y) + pad
    const gapH = Math.max(rightEye.h, leftEye.h) - pad * 2
    if (gapW >= 28 && gapH >= 48) {
      slots.push({
        role: 'spine',
        x: gapX,
        y: gapY,
        w: gapW,
        h: gapH,
        align: 'left',
        rotate: -90,
        size: Math.round(Math.min(gapW * 0.85, gapH * 0.22, wallW * 0.05)),
        weight: 700,
        mode: 'stack',
      })
    }
  }

  const bottomY = y + h + pad
  const bottomH = wallH - bottomY - pad
  if (bottomH >= 72) {
    slots.push({
      role: 'footer',
      x: x + pad,
      y: bottomY,
      w: w - pad * 2,
      h: bottomH,
      align: 'center',
      rotate: 0,
      size: Math.round(Math.min(bandFontSize(bottomH, wallW), (w - pad * 2) * 0.12)),
      weight: 700,
      mode: 'stack',
    })
  }

  const minPieceY = Math.min(...rects.map((rect) => rect.y))
  if (minPieceY > 0.06) {
    const foreheadH = minPieceY * h - pad * 2
    if (foreheadH >= 40) {
      slots.push({
        role: 'forehead',
        x: x + w * 0.12,
        y: y + pad,
        w: w * 0.76,
        h: foreheadH,
        align: 'center',
        rotate: 0,
        size: Math.round(Math.min(foreheadH * 0.55, wallW * 0.04)),
        weight: 600,
        mode: 'scatter',
      })
    }
  }

  return slots.filter((slot) => !rectOverlapsCollagePiece(slot, rects, placement))
}
