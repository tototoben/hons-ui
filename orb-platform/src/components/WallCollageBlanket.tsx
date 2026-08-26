import { useEffect, useMemo, useRef, useState } from 'react'
import { panelFitScale, wallModeTransform } from '../lib/wallMode'
import { measuredPanelForRole, type WallRole } from '../lib/wallRole'
import { DEFAULT_VISITOR_ALIGN, MATCH_FACE_SIZE, type VisitorAlign } from '../lib/wallMatchPhotobash'
import { loadFaceBankImages } from '../lib/faceBank'
import { computeFaceAlign } from '../lib/faceBankAlign'
import { getVisitorFaceCapture } from '../lib/visitorFaceCapture'
import {
  collageRects,
  collageRevealAt,
  drawWallCollage,
  mouthRectIndex,
  pickStrangerAssignments,
  visitorRevealOrder,
} from '../lib/wallCollagePhotobash'
import { lipFrameRect, lipStateAt, LIP_SPRITE_SRC } from '../lib/wallLipClips'
import './WallFaceBlanket.css'
import './WallCollageBlanket.css'

const COLLAGE_REVEAL_MS = 45_000
const PLATE_RATIO = MATCH_FACE_SIZE.width / MATCH_FACE_SIZE.height

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load ${src}`))
    image.src = src
  })
}

/**
 * Experimental successor to WallFaceBlanket: instead of one fixed match
 * face, assembles a collage from the local synthetic face bank, then
 * slowly swaps pieces for the visitor's own captured face (visitorFaceCapture)
 * as the loading phase progresses. Opt-in via ?collage=1 — see
 * parseWallCollage in wallRole.ts — so the tuned, currently-live
 * WallFaceBlanket reveal is untouched.
 */
export function WallCollageBlanket({
  role,
  photobashSeed = 1,
}: {
  role: WallRole
  photobashSeed?: number
}) {
  const seed = photobashSeed || 1
  const panel = measuredPanelForRole(role)
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lipCanvasRef = useRef<HTMLCanvasElement>(null)
  const [bankImages, setBankImages] = useState<HTMLImageElement[]>([])
  const [bankAligns, setBankAligns] = useState<VisitorAlign[]>([])
  const [visitorImage, setVisitorImage] = useState<HTMLImageElement | null>(null)
  const [visitorAlign, setVisitorAlign] = useState<VisitorAlign>(DEFAULT_VISITOR_ALIGN)
  const [lipSprite, setLipSprite] = useState<HTMLImageElement | null>(null)

  const rects = useMemo(() => collageRects(seed), [seed])
  const strangerAssignments = useMemo(
    () => pickStrangerAssignments(seed, rects.length, Math.max(1, bankImages.length)),
    [seed, rects.length, bankImages.length],
  )
  const revealOrder = useMemo(() => visitorRevealOrder(seed + 1, rects.length), [seed, rects.length])

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadFaceBankImages().then(async (images) => {
      if (cancelled) return
      setBankImages(images)
      // One-time per image; each bank photo is framed differently, so this
      // is what makes a given shard (e.g. "left eye") reliably show the
      // right anatomy no matter which photo fills it.
      const aligns = await Promise.all(images.map((image) => computeFaceAlign(image, PLATE_RATIO)))
      if (!cancelled) setBankAligns(aligns)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const dataUrl = getVisitorFaceCapture()
    if (!dataUrl) return
    loadImage(dataUrl)
      .then(async (image) => {
        if (cancelled) return
        setVisitorImage(image)
        const align = await computeFaceAlign(image, PLATE_RATIO)
        if (!cancelled) setVisitorAlign(align)
      })
      .catch(() => {
        if (!cancelled) setVisitorImage(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadImage(LIP_SPRITE_SRC)
      .then((image) => {
        if (!cancelled) setLipSprite(image)
      })
      .catch(() => {
        if (!cancelled) setLipSprite(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Redraw loop: sweeps revealed cells from stranger pieces to the
  // visitor's own, in the seeded reveal order, over COLLAGE_REVEAL_MS.
  useEffect(() => {
    let raf = 0
    let cancelled = false
    const start = performance.now()

    const tick = (now: number) => {
      if (cancelled) return
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx) {
        const elapsed = now - start
        const { revealedCount, nextOpacity } = collageRevealAt(
          elapsed,
          COLLAGE_REVEAL_MS,
          rects.length,
        )
        const revealedCells = new Set(revealOrder.slice(0, revealedCount))
        const revealingCell = revealedCount < revealOrder.length ? revealOrder[revealedCount] : null
        drawWallCollage(ctx, {
          width: canvas.width,
          height: canvas.height,
          rects,
          bankImages,
          bankAligns,
          strangerAssignments,
          visitorImage,
          visitorAlign,
          revealedCells,
          revealingCell,
          revealingOpacity: nextOpacity,
        })
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [bankAligns, bankImages, rects, revealOrder, strangerAssignments, visitorAlign, visitorImage])

  // Sprite flipbook: steps through cropped mouth-shape frames during
  // talking bursts, hides the layer during pauses so the still collage
  // piece underneath shows through — the "talking, mixed with stills" idea.
  useEffect(() => {
    if (!lipSprite) return
    let raf = 0
    let cancelled = false
    const start = performance.now()

    const tick = (now: number) => {
      if (cancelled) return
      const canvas = lipCanvasRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx) {
        const { resting, frame } = lipStateAt(now - start, seed)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (!resting) {
          const rect = lipFrameRect(frame)
          const sw = lipSprite.naturalWidth * rect.w
          const sh = lipSprite.naturalHeight * rect.h
          ctx.drawImage(
            lipSprite,
            rect.u * lipSprite.naturalWidth,
            rect.v * lipSprite.naturalHeight,
            sw,
            sh,
            0,
            0,
            canvas.width,
            canvas.height,
          )
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [lipSprite, seed])

  const layout = useMemo(() => {
    if (!panel) return null
    const crop = wallModeTransform(
      {
        wallWidth: panel.wallWidth,
        wallHeight: panel.wallHeight,
        panelX: panel.panelX,
        panelY: panel.panelY,
        panelWidth: panel.panelWidth,
        panelHeight: panel.panelHeight,
      },
      panel.panelWidth,
      panel.panelHeight,
    )
    const fitScale = panelFitScale(panel.panelWidth, panel.panelHeight, viewport.width, viewport.height)
    const coverScale = Math.max(
      panel.wallWidth / MATCH_FACE_SIZE.width,
      panel.wallHeight / MATCH_FACE_SIZE.height,
    )
    const faceW = MATCH_FACE_SIZE.width * coverScale
    const faceH = MATCH_FACE_SIZE.height * coverScale
    return {
      crop,
      fitScale,
      panelWidth: panel.panelWidth,
      panelHeight: panel.panelHeight,
      faceW,
      faceH,
      faceX: (panel.wallWidth - faceW) / 2,
      faceY: (panel.wallHeight - faceH) / 2,
    }
  }, [panel, viewport.height, viewport.width])

  if (!panel || !layout) return null

  const faceStyle = {
    width: layout.faceW,
    height: layout.faceH,
    left: layout.faceX,
    top: layout.faceY,
  }

  // Same rect the main canvas already draws the mouth piece into (last in
  // the array — see collageRects/mouthRectIndex) — the sprite overlay sits
  // exactly on top of it, so there's never a second, competing static mouth
  // visible around the edges.
  const mouthZone = rects[mouthRectIndex(rects)]
  const mouthWidth = Math.round(mouthZone.w * layout.faceW)
  const mouthHeight = Math.round(mouthZone.h * layout.faceH)
  const mouthStyle = {
    width: mouthWidth,
    height: mouthHeight,
    left: layout.faceX + mouthZone.x * layout.faceW,
    top: layout.faceY + mouthZone.y * layout.faceH,
  }

  return (
    <div
      className="wall-face-blanket wall-collage-blanket"
      aria-label="Photobashed collage face across the wall"
    >
      <div
        className="wall-face-fit"
        style={{
          width: layout.panelWidth,
          height: layout.panelHeight,
          transform: `scale(${layout.fitScale})`,
        }}
      >
        <div
          className="wall-face-canvas"
          style={{
            width: layout.crop.wallWidth,
            height: layout.crop.wallHeight,
            transform: `translate(${layout.crop.translateX}px, ${layout.crop.translateY}px)`,
          }}
        >
          <canvas
            ref={canvasRef}
            width={MATCH_FACE_SIZE.width}
            height={MATCH_FACE_SIZE.height}
            className="wall-face-image wall-collage-canvas"
            style={faceStyle}
          />
          {lipSprite ? (
            <canvas
              ref={lipCanvasRef}
              width={mouthWidth}
              height={mouthHeight}
              className="wall-collage-lip-sprite"
              style={mouthStyle}
            />
          ) : null}
        </div>
      </div>
      <div className="wall-face-caption">MATCH LOCKED</div>
    </div>
  )
}
