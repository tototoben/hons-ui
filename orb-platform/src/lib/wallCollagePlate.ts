import type { CollageCue } from './collageCue'
import type { CollageBank } from './wallCollageBank'
import {
  collageRects,
  collageRevealAt,
  drawWallCollage,
  pickTaggedStrangerAssignments,
  visitorRevealOrder,
} from './wallCollagePhotobash'
import { DEFAULT_VISITOR_ALIGN, MATCH_FACE_SIZE, type VisitorAlign } from './wallMatchPhotobash'

/** Same reveal duration as WallCollageBlanket / photowall. */
export const COLLAGE_REVEAL_MS = 45_000

export type WallCollagePlateState = {
  rects: ReturnType<typeof collageRects>
  strangerAssignments: number[]
  revealOrder: number[]
  revealedCells: Set<number>
  revealingCell: number | null
  revealingOpacity: number
}

export type BuildWallCollagePlateStateInput = {
  seed: number
  collageCue: CollageCue
  faces: CollageBank['faces']
  visitorImage: HTMLImageElement | null
  /** Elapsed reveal time; photowall passes frame time, print uses end state. */
  elapsedMs?: number
  /** Freeze at full visitor reveal — matches WallCollageBlanket staticCapture. */
  staticCapture?: boolean
}

/** Stranger picks + visitor reveal state shared by photowall and souvenir ticket. */
export function buildWallCollagePlateState({
  seed,
  collageCue,
  faces,
  visitorImage: _visitorImage,
  elapsedMs = 0,
  staticCapture = false,
}: BuildWallCollagePlateStateInput): WallCollagePlateState {
  const rects = collageRects(seed)
  const strangerAssignments = pickTaggedStrangerAssignments(
    seed,
    faces,
    collageCue,
    rects.length,
  )
  const revealOrder = visitorRevealOrder(seed + 1, rects.length)
  const elapsed = staticCapture ? COLLAGE_REVEAL_MS : elapsedMs
  const { revealedCount, nextOpacity } = collageRevealAt(
    elapsed,
    COLLAGE_REVEAL_MS,
    rects.length,
  )
  const revealedCells = new Set(revealOrder.slice(0, revealedCount))
  const revealingCell = revealedCount < revealOrder.length ? revealOrder[revealedCount] : null
  return {
    rects,
    strangerAssignments,
    revealOrder,
    revealedCells,
    revealingCell,
    revealingOpacity: nextOpacity,
  }
}

export type DrawWallCollagePlateInput = {
  ctx: CanvasRenderingContext2D
  width?: number
  height?: number
  state: WallCollagePlateState
  bank: CollageBank
  visitorImage: HTMLImageElement | null
  visitorAlign?: VisitorAlign
  fillBackground?: boolean
}

/** Draw the MATCH_FACE_SIZE collage plate (same pixels the photowall uses per panel). */
export function drawWallCollagePlate({
  ctx,
  width = MATCH_FACE_SIZE.width,
  height = MATCH_FACE_SIZE.height,
  state,
  bank,
  visitorImage,
  visitorAlign = DEFAULT_VISITOR_ALIGN,
  fillBackground = true,
}: DrawWallCollagePlateInput) {
  drawWallCollage(ctx, {
    fillBackground,
    width,
    height,
    rects: state.rects,
    bankImages: bank.images,
    bankAligns: bank.aligns,
    strangerAssignments: state.strangerAssignments,
    visitorImage,
    visitorAlign,
    revealedCells: state.revealedCells,
    revealingCell: state.revealingCell,
    revealingOpacity: state.revealingOpacity,
  })
}
