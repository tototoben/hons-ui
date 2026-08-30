import { useEffect, useMemo, useState } from 'react'
import { panelFitScale, wallModeTransform } from '../lib/wallMode'
import { measuredPanelForRole, parseWallBare, type WallRole } from '../lib/wallRole'
import {
  composeWallMatchPhotobash,
  glitchShowMergedAt,
  MATCH_FACE_SIZE,
  MATCH_FACE_URL,
  MATCH_HOLD_MS,
  PHOTOBASH_GLITCH_MS,
  pickRevealShards,
} from '../lib/wallMatchPhotobash'
import './WallFaceBlanket.css'

/**
 * Full-wall match plate: clean face first, then choppy glitches into a
 * pre-merged photobash (same merge + timing on every panel via seed).
 *
 * Crop math always uses the nominal measured panel size (like the wall sim),
 * then uniformly fits that layer into the real Chrome viewport — so slight
 * IRL window-size differences do not desync seams between screens.
 */
export function WallFaceBlanket({
  role,
  photobashSeed = 1,
}: {
  role: WallRole
  photobashSeed?: number
}) {
  const panel = measuredPanelForRole(role)
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  const [mergedUrl, setMergedUrl] = useState<string | null>(null)
  const [showMerged, setShowMerged] = useState(false)
  const [glitchHot, setGlitchHot] = useState(false)
  const shards = useMemo(() => pickRevealShards(photobashSeed || 1), [photobashSeed])

  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    let cancelled = false
    composeWallMatchPhotobash({ shards })
      .then((url) => {
        if (!cancelled) setMergedUrl(url)
      })
      .catch(() => {
        if (!cancelled) setMergedUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [shards])

  useEffect(() => {
    let cancelled = false
    let raf = 0
    let lastShow = false
    const start = performance.now()
    const total = MATCH_HOLD_MS + PHOTOBASH_GLITCH_MS

    const tick = (now: number) => {
      if (cancelled) return
      const elapsed = now - start
      const show = Boolean(mergedUrl) && glitchShowMergedAt(elapsed, photobashSeed || 1)
      if (show !== lastShow) {
        lastShow = show
        setShowMerged(show)
        setGlitchHot(show)
      } else if (show) {
        setGlitchHot(elapsed % 160 < 90)
      } else {
        setGlitchHot(false)
      }
      if (elapsed < total) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [mergedUrl, photobashSeed])

  const layout = useMemo(() => {
    if (!panel) return null
    // Nominal panel crop (scale === 1) — identical mapping on every display.
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
    const fitScale = panelFitScale(
      panel.panelWidth,
      panel.panelHeight,
      viewport.width,
      viewport.height,
    )
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

  return (
    <div
      className={`wall-face-blanket${showMerged ? ' is-merged' : ''}${glitchHot ? ' is-glitch-hot' : ''}`}
      aria-label="Photobashed match face across the wall"
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
          <div className="wall-face-glitch">
            <img
              className="wall-face-image wall-face-match"
              src={MATCH_FACE_URL}
              alt=""
              draggable={false}
              style={faceStyle}
            />
            {mergedUrl ? (
              <img
                className={`wall-face-image wall-face-merge${showMerged ? ' is-visible' : ''}`}
                src={mergedUrl}
                alt=""
                draggable={false}
                style={faceStyle}
              />
            ) : null}
          </div>
        </div>
      </div>
      {parseWallBare() ? null : <div className="wall-face-caption">MATCH LOCKED</div>}
    </div>
  )
}
