import { physicalCollageLayout } from '../lib/wallCollageLayout'
import { useEffect, useMemo, useRef, useState } from 'react'
import { panelFitScale, wallModeTransform } from '../lib/wallMode'
import type { WallRole } from '../lib/wallRole'
import { DEFAULT_VISITOR_ALIGN, MATCH_FACE_SIZE, type VisitorAlign } from '../lib/wallMatchPhotobash'
import { ensureCollageBank, peekCollageBank } from '../lib/wallCollageBank'
import { computeFaceAlign } from '../lib/faceBankAlign'
import { getVisitorFaceCapture } from '../lib/visitorFaceCapture'
import {
  peekActiveVisits,
  peekVisitorFaceFromCentral,
  pickVisitForReveal,
  refreshVisitCache,
} from '../lib/visitCentral'
import { useVisitCentralPoll } from '../hooks/useVisitCentral'
import { postWallDiagnostic } from '../lib/wallDiagnostics'
import { collageCueKey, type CollageCue } from '../lib/collageCue'
import {
  collageRects,
  collageRevealAt,
  drawWallCollage,
  mouthRectIndex,
  pickTaggedStrangerAssignments,
  visitorRevealOrder,
} from '../lib/wallCollagePhotobash'
import {
  LIP_FRAME_MS,
  LIP_REST_FRAME,
  LIP_SPRITE_FRAME_COUNT,
  lipFrameRect,
  lipStateAt,
  LIP_SPRITE_SRC,
} from '../lib/wallLipClips'
import type { RevealDialogueState } from '../lib/revealDialogue'
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
 * Live wall photobash (replaces WallFaceBlanket). Assembles a collage from
 * the local synthetic face bank, then slowly swaps pieces for the visitor's
 * own captured face (visitorFaceCapture) as the loading phase progresses.
 * Pass collage=0 to restore the older WallFaceBlanket glitch reveal.
 */
export function WallCollageBlanket({
  role,
  photobashSeed = 1,
  collageCue = {},
  dialogue,
}: {
  role: WallRole
  photobashSeed?: number
  collageCue?: CollageCue
  /** When the reveal dialogue is running, its live state: the lip
   * flipbook then follows the actual speech (speech_level) instead of
   * the ambient seeded rhythm. */
  dialogue?: RevealDialogueState
}) {
  const seed = photobashSeed || 1
  const cueKey = collageCueKey(collageCue)
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lipCanvasRef = useRef<HTMLCanvasElement>(null)
  const peeked = peekCollageBank(seed, collageCue)
  const [bankImages, setBankImages] = useState<HTMLImageElement[]>(() => peeked?.images ?? [])
  const [bankAligns, setBankAligns] = useState<VisitorAlign[]>(() => peeked?.aligns ?? [])
  const [bankFaces, setBankFaces] = useState(() => peeked?.faces ?? [])
  const [visitorImage, setVisitorImage] = useState<HTMLImageElement | null>(null)
  const [visitorAlign, setVisitorAlign] = useState<VisitorAlign>(DEFAULT_VISITOR_ALIGN)
  const [lipSprite, setLipSprite] = useState<HTMLImageElement | null>(null)
  // Ref bridge: speech_level streams at ~10Hz; the rAF tick reads the
  // latest value here so the effect below never has to re-run for it.
  const dialogueRef = useRef<RevealDialogueState | undefined>(dialogue)
  dialogueRef.current = dialogue
  const speechDriven = dialogue !== undefined
  useVisitCentralPoll()

  const rects = useMemo(() => collageRects(seed), [seed])
  const physicalLayout = physicalCollageLayout(role, rects[mouthRectIndex(rects)])
  const panel = physicalLayout.panel
  const strangerAssignments = useMemo(
    () => pickTaggedStrangerAssignments(seed, bankFaces, collageCue, rects.length),
    [seed, rects.length, bankFaces, cueKey],
  )
  const revealOrder = useMemo(() => visitorRevealOrder(seed + 1, rects.length), [seed, rects.length])

  // "How were the photos picked" (this session): each rect's face-bank
  // assignment, once per assembled collage. All 6 wall windows render the
  // same seed/cue independently -- log from one role only, or central.log
  // would get 6 identical lines per collage. Fires once bankFaces actually
  // has data (not the empty peekCollageBank() placeholder before the async
  // load resolves).
  useEffect(() => {
    if (role !== 'debra' || bankFaces.length === 0) return
    postWallDiagnostic(
      'collage_assembled',
      {
        seed,
        cue_presentations: collageCue.presentations ?? [],
        cue_age_band: collageCue.ageBand ?? '',
        cue_smile: collageCue.smile ?? '',
        rect_count: rects.length,
        fragments: strangerAssignments.map((index) => bankFaces[index]?.file ?? null),
      },
      pickVisitForReveal(peekActiveVisits())?.visit_id,
    )
  }, [role, bankFaces, seed, cueKey, collageCue, rects.length, strangerAssignments])

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    let cancelled = false
    void ensureCollageBank(seed, collageCue).then((bank) => {
      if (cancelled) return
      setBankImages(bank.images)
      setBankAligns(bank.aligns)
      setBankFaces(bank.faces)
    })
    return () => {
      cancelled = true
    }
  }, [seed, cueKey])

  const loadedDataUrlRef = useRef<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const loadFace = async () => {
      await refreshVisitCache(true)
      const dataUrl = peekVisitorFaceFromCentral() ?? getVisitorFaceCapture()
      if (!dataUrl || dataUrl === loadedDataUrlRef.current) return
      loadedDataUrlRef.current = dataUrl
      loadImage(dataUrl)
        .then(async (image) => {
          if (cancelled) return
          console.info(
            '[WallCollage] Loaded visitor face capture image:',
            image.naturalWidth,
            'x',
            image.naturalHeight,
          )
          if (role === 'debra') {
            postWallDiagnostic(
              'collage_assembled',
              {
                event: 'visitor_photo_loaded',
                width: image.naturalWidth,
                height: image.naturalHeight,
                bytes: dataUrl.length,
                source: peekVisitorFaceFromCentral() ? 'central' : 'local',
              },
              pickVisitForReveal(peekActiveVisits())?.visit_id,
            )
          }
          setVisitorImage(image)
          const align = await computeFaceAlign(image, PLATE_RATIO)
          if (!cancelled) setVisitorAlign(align)
        })
        .catch((err) => {
          console.warn('[WallCollage] Failed to load visitor face image:', err)
          if (!cancelled) setVisitorImage(null)
        })
    }
    void loadFace()
    const timer = window.setInterval(() => {
      void loadFace()
    }, 2000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
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
          fillBackground: true,
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
    // Speech-driven flipbook: advance to a fresh non-rest frame every
    // LIP_FRAME_MS while the dialogue is audibly speaking; rest (layer
    // hidden, still collage mouth shows) whenever it is not.
    let speechFrame = 1
    let lastAdvance = 0
    const speechLipState = (now: number) => {
      const state = dialogueRef.current
      const loud = state !== undefined && state.speech_level > 0.06
      if (!loud) return { resting: true, frame: LIP_REST_FRAME }
      if (now - lastAdvance >= LIP_FRAME_MS) {
        lastAdvance = now
        let next = 1 + Math.floor(Math.random() * (LIP_SPRITE_FRAME_COUNT - 1))
        if (next === speechFrame || next === LIP_REST_FRAME) {
          next = (next % (LIP_SPRITE_FRAME_COUNT - 1)) + 1
        }
        speechFrame = next
      }
      return { resting: false, frame: speechFrame }
    }

    const tick = (now: number) => {
      if (cancelled) return
      const canvas = lipCanvasRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx) {
        // With a live dialogue: mouth opens with the wall's own speech.
        // Without one: the ambient seeded talk/pause rhythm as before.
        const { resting, frame } = speechDriven
          ? speechLipState(now)
          : lipStateAt(now - start, seed)
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
  }, [lipSprite, seed, speechDriven])

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
    const { faceW, faceH } = physicalLayout
    return {
      crop,
      fitScale,
      panelWidth: panel.panelWidth,
      panelHeight: panel.panelHeight,
      faceW,
      faceH,
      faceX: physicalLayout.faceX,
      faceY: physicalLayout.faceY,
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
          {lipSprite && bankAligns.length > 0 ? (
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
    </div>
  )
}
