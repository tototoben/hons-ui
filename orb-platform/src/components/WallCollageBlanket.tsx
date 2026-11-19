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
  peekRevealVisitorFace,
  pickRevealVisit,
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
  anatomicalRevealOrder,
  pickTaggedStrangerAssignments,
} from '../lib/wallCollagePhotobash'
import {
  LIP_FRAME_MS,
  LIP_REST_FRAME,
  LIP_SPRITE_FRAME_COUNT,
  lipFrameRect,
  lipStateAt,
  LIP_SPRITE_SRC,
} from '../lib/wallLipClips'
import { dialogueRevealCount, type RevealDialogueState } from '../lib/revealDialogue'
import './WallFaceBlanket.css'
import './WallCollageBlanket.css'

const COLLAGE_REVEAL_MS = 45_000
// Talk-timed reveal: the newest visitor piece fades in over this long...
const TALK_REVEAL_FADE_MS = 2_400
// ...starting when the wall is audibly speaking (speech_level; the phases
// flip before TTS synthesis, so phase alone would fade into dead air) --
// or after this fallback, in case a short line's level frames are missed.
const TALK_FADE_FALLBACK_MS = 4_000
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
 * the local synthetic face bank; visitor pieces appear per visitorReveal:
 * talk-by-talk during the dialogue, on the 45s sweep for ticket captures,
 * or not at all (ambient). Pass collage=0 for the older glitch reveal.
 */
export function WallCollageBlanket({
  role,
  photobashSeed = 1,
  collageCue = {},
  dialogue,
  visitorReveal = 'sweep',
}: {
  role: WallRole
  photobashSeed?: number
  collageCue?: CollageCue
  /** When the reveal dialogue is running, its live state: the lip
   * flipbook then follows the actual speech (speech_level) instead of
   * the ambient seeded rhythm. */
  dialogue?: RevealDialogueState
  /** How the visitor's own pieces appear over the bank collage:
   * 'dialogue' = one piece per talk segment of the live dialogue;
   * 'sweep' = the original 45s wall-clock sweep (ticket capture);
   * 'off' = bank collage only. */
  visitorReveal?: 'sweep' | 'dialogue' | 'off'
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
  // Talk-reveal ratchet. In a ref so effect re-runs (bank/visitor images
  // arriving) never reset how much of the visitor is already on the wall;
  // a new session key starts the walk-in from nothing.
  const talkRevealRef = useRef({ sessionKey: '', count: 0, pendingSince: 0, fadeStart: 0 })
  useVisitCentralPoll()

  const rects = useMemo(() => collageRects(seed), [seed])
  const physicalLayout = physicalCollageLayout(role, rects[mouthRectIndex(rects)])
  const panel = physicalLayout.panel
  const strangerAssignments = useMemo(
    () => pickTaggedStrangerAssignments(seed, bankFaces, collageCue, rects.length),
    [seed, rects.length, bankFaces, cueKey],
  )
  const revealOrder = useMemo(() => anatomicalRevealOrder(rects.length), [rects.length])

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
      pickRevealVisit(peekActiveVisits())?.visit_id,
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
      // Strictly the reveal visit's own photo (or the same-browser dev
      // fallback). Never a stand-in from Station 3/2: that put the NEXT
      // visitor's face on the wall during a no-photo reveal (2026-09-12).
      const dataUrl = peekRevealVisitorFace() ?? getVisitorFaceCapture()
      if (!dataUrl) {
        // No visitor at the wall, or one without a photo: drop whatever
        // face was loaded before, so it cannot be drawn for this visitor.
        if (loadedDataUrlRef.current !== null) {
          loadedDataUrlRef.current = null
          setVisitorImage(null)
          setVisitorAlign(DEFAULT_VISITOR_ALIGN)
        }
        return
      }
      if (dataUrl === loadedDataUrlRef.current) return
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
                source: peekRevealVisitorFace() ? 'central' : 'local',
              },
              pickRevealVisit(peekActiveVisits())?.visit_id,
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

  // Redraw loop. How the visitor's pieces appear depends on visitorReveal:
  // 'dialogue' -- one piece per talk segment (the opening, each reply, the
  //   cold close), the newest fading in once the wall is audibly speaking;
  // 'sweep' -- the original 45s wall-clock sweep (headless ticket capture);
  // 'off' -- bank collage only, no visitor pieces (ambient wall).
  useEffect(() => {
    let raf = 0
    let cancelled = false
    const start = performance.now()

    const tick = (now: number) => {
      if (cancelled) return
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx) {
        let revealedCount = 0
        let nextOpacity = 0
        if (visitorReveal === 'sweep') {
          const swept = collageRevealAt(now - start, COLLAGE_REVEAL_MS, rects.length)
          revealedCount = swept.revealedCount
          nextOpacity = swept.nextOpacity
        } else if (visitorReveal === 'dialogue') {
          const state = dialogueRef.current
          const tracker = talkRevealRef.current
          const sessionKey = state
            ? `${state.session_id ?? ''}/${state.visit_id ?? ''}`
            : tracker.sessionKey
          if (sessionKey !== tracker.sessionKey) {
            tracker.sessionKey = sessionKey
            tracker.count = 0
            tracker.fadeStart = 0
            tracker.pendingSince = 0
          }
          const target = state
            ? Math.min(rects.length, dialogueRevealCount(state))
            : tracker.count
          if (state && target < tracker.count) {
            // The count went backwards under the SAME key: a restarted
            // session for this visit (server reuses visit_id as the
            // session_id). Walk in from nothing again.
            tracker.count = 0
            tracker.fadeStart = 0
            tracker.pendingSince = 0
          }
          const newestLanded =
            tracker.count === 0 ||
            (tracker.fadeStart !== 0 && now - tracker.fadeStart >= TALK_REVEAL_FADE_MS)
          // Hold the walk until the visitor's photo exists -- advancing on
          // the fallback timer with nothing to draw made already-counted
          // pieces pop in together when a slow photo finally landed.
          if (visitorImage !== null && target > tracker.count && newestLanded) {
            // Strictly one piece at a time: a window that joins the session
            // late walks the pieces in, it never jumps to the target.
            tracker.count += 1
            tracker.fadeStart = 0
            tracker.pendingSince = now
          }
          if (tracker.count > 0 && tracker.fadeStart === 0) {
            const loud = state !== undefined && state.speech_level > 0.06
            if (loud || now - tracker.pendingSince >= TALK_FADE_FALLBACK_MS) {
              tracker.fadeStart = now
            }
          }
          revealedCount = Math.max(0, tracker.count - 1)
          nextOpacity =
            tracker.fadeStart === 0
              ? 0
              : Math.min(1, (now - tracker.fadeStart) / TALK_REVEAL_FADE_MS)
        }
        const revealedCells = new Set(revealOrder.slice(0, revealedCount))
        const revealingCell =
          visitorReveal !== 'off' && revealedCount < revealOrder.length
            ? revealOrder[revealedCount]
            : null
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
  }, [bankAligns, bankImages, rects, revealOrder, strangerAssignments, visitorAlign, visitorImage, visitorReveal])

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
