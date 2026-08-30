import { useEffect, useMemo, useRef, useState } from 'react'
import { collageRects } from '../lib/wallCollagePhotobash'
import { drawWallForming, formingElapsedMs } from '../lib/wallForming'
import { MATCH_FACE_SIZE } from '../lib/wallMatchPhotobash'
import { panelFitScale, wallModeTransform } from '../lib/wallMode'
import { measuredPanelForRole, type WallRole } from '../lib/wallRole'
import './WallFaceBlanket.css'
import './WallFormingBlanket.css'

export function WallFormingBlanket({
  role,
  photobashSeed = 1,
  loadingProgress,
}: {
  role: WallRole
  photobashSeed?: number
  loadingProgress: number
}) {
  const seed = photobashSeed || 1
  const panel = measuredPanelForRole(role)
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const progressRef = useRef(loadingProgress)
  progressRef.current = loadingProgress
  const rects = useMemo(() => collageRects(seed), [seed])

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let raf = 0
    const tick = () => {
      drawWallForming(ctx, {
        width: canvas.width,
        height: canvas.height,
        rects,
        seed,
        elapsedMs: formingElapsedMs(progressRef.current),
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [rects, seed])

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

  return (
    <div className="wall-face-blanket wall-forming-blanket" aria-label="Partner forming">
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
            className="wall-face-image wall-forming-canvas"
            style={faceStyle}
          />
        </div>
      </div>
    </div>
  )
}
