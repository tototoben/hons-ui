import type { CollageCue } from './collageCue'
import { ensureCollageBank } from './wallCollageBank'
import {
  buildWallCollagePlateState,
  drawWallCollagePlate,
} from './wallCollagePlate'
import { DEFAULT_VISITOR_ALIGN, MATCH_FACE_SIZE, type VisitorAlign } from './wallMatchPhotobash'
import { MEASURED_WALL_PANELS } from './wallRole'
import { computeFaceAlign } from './faceBankAlign'
import { getVisitorFaceCapture } from './visitorFaceCapture'
import { peekVisitorFaceFromCentral, refreshVisitCache } from './visitCentral'
import {
  buildSouvenirTextSlots,
  computeSouvenirCollagePlacement,
} from './wallSouvenirLayout'
import { drawWallSouvenirTicketText, type WallSouvenirTicketInput } from './wallSouvenirTicket'

const PLATE_RATIO = MATCH_FACE_SIZE.width / MATCH_FACE_SIZE.height

export function wallCompositeBounds() {
  const minX = Math.min(...MEASURED_WALL_PANELS.map((panel) => panel.x))
  const minY = Math.min(...MEASURED_WALL_PANELS.map((panel) => panel.y))
  const maxX = Math.max(...MEASURED_WALL_PANELS.map((panel) => panel.x + panel.width))
  const maxY = Math.max(...MEASURED_WALL_PANELS.map((panel) => panel.y + panel.height))
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load ${src}`))
    image.src = src
  })
}

async function loadVisitorFace(): Promise<{ image: HTMLImageElement | null; align: VisitorAlign }> {
  await refreshVisitCache(true)
  const dataUrl = peekVisitorFaceFromCentral() ?? getVisitorFaceCapture()
  if (!dataUrl) return { image: null, align: DEFAULT_VISITOR_ALIGN }
  try {
    const image = await loadImage(dataUrl)
    const align = await computeFaceAlign(image, PLATE_RATIO)
    return { image, align }
  } catch {
    return { image: null, align: DEFAULT_VISITOR_ALIGN }
  }
}

function renderSouvenirPlate(
  seed: number,
  collageCue: CollageCue,
  bank: Awaited<ReturnType<typeof ensureCollageBank>>,
  visitorImage: HTMLImageElement | null,
  visitorAlign: VisitorAlign,
) {
  const state = buildWallCollagePlateState({
    seed,
    collageCue,
    faces: bank.faces,
    visitorImage,
    staticCapture: true,
  })

  const faceCanvas = document.createElement('canvas')
  faceCanvas.width = MATCH_FACE_SIZE.width
  faceCanvas.height = MATCH_FACE_SIZE.height
  const faceCtx = faceCanvas.getContext('2d')
  if (!faceCtx) throw new Error('2d context unavailable')
  drawWallCollagePlate({
    ctx: faceCtx,
    state,
    bank,
    visitorImage,
    visitorAlign,
    fillBackground: true,
  })

  return { faceCanvas, rects: state.rects }
}

/** Render the souvenir collage centered on white (full face plate, not install crops). */
export type WallSouvenirRenderOptions = {
  /** When false, skip gap captions (composition-only PNG). Default true. */
  drawTicketText?: boolean
}

export async function renderWallSouvenirComposite(
  seed: number,
  collageCue: CollageCue = {},
  ticket: WallSouvenirTicketInput = { photobashSeed: seed, collageCue },
  options: WallSouvenirRenderOptions = {},
): Promise<HTMLCanvasElement> {
  const bank = await ensureCollageBank(seed, collageCue)
  const { image: visitorImage, align: visitorAlign } = await loadVisitorFace()
  const bounds = wallCompositeBounds()
  const composite = document.createElement('canvas')
  composite.width = bounds.w
  composite.height = bounds.h
  const ctx = composite.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, bounds.w, bounds.h)

  const { faceCanvas, rects } = renderSouvenirPlate(
    seed,
    collageCue,
    bank,
    visitorImage,
    visitorAlign,
  )
  const placement = computeSouvenirCollagePlacement(bounds.w, bounds.h)
  ctx.drawImage(faceCanvas, placement.x, placement.y, placement.w, placement.h)

  if (options.drawTicketText !== false) {
    const textSlots = buildSouvenirTextSlots(placement, rects)
    drawWallSouvenirTicketText(
      ctx,
      {
        ...ticket,
        photobashSeed: seed,
        collageCue,
      },
      textSlots,
    )
  }

  return composite
}

export async function renderWallSouvenirPng(
  seed: number,
  collageCue: CollageCue = {},
  ticket?: WallSouvenirTicketInput,
  options?: WallSouvenirRenderOptions,
): Promise<Blob> {
  const composite = await renderWallSouvenirComposite(
    seed,
    collageCue,
    ticket ?? { photobashSeed: seed, collageCue },
    options,
  )
  return new Promise((resolve, reject) => {
    composite.toBlob((blob) => {
      if (!blob) {
        reject(new Error('canvas toBlob returned null'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}
