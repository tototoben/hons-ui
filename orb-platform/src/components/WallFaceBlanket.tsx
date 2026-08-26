import { useEffect, useMemo, useState } from 'react'
import { wallModeTransform } from '../lib/wallMode'
import { measuredPanelForRole, type WallRole } from '../lib/wallRole'
import {
  composeWallMatchPhotobash,
  MATCH_FACE_SIZE,
  MATCH_FACE_URL,
} from '../lib/wallMatchPhotobash'
import './WallFaceBlanket.css'

/**
 * One shared photobashed face cover-scaled onto the full wall canvas.
 * Each display shows only its panel slice — together they read as one image.
 */
export function WallFaceBlanket({ role }: { role: WallRole }) {
  const panel = measuredPanelForRole(role)
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  const [faceUrl, setFaceUrl] = useState(MATCH_FACE_URL)

  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    let cancelled = false
    composeWallMatchPhotobash()
      .then((url) => {
        if (!cancelled) setFaceUrl(url)
      })
      .catch(() => {
        if (!cancelled) setFaceUrl(MATCH_FACE_URL)
      })
    return () => {
      cancelled = true
    }
  }, [])

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
      faceW,
      faceH,
      faceX: (panel.wallWidth - faceW) / 2,
      faceY: (panel.wallHeight - faceH) / 2,
    }
  }, [panel, viewport.height, viewport.width])

  if (!panel || !layout) return null

  return (
    <div className="wall-face-blanket" aria-label="Photobashed match face across the wall">
      <div
        className="wall-face-canvas"
        style={{
          width: layout.crop.wallWidth,
          height: layout.crop.wallHeight,
          transform: `translate(${layout.crop.translateX}px, ${layout.crop.translateY}px) scale(${layout.crop.scale})`,
        }}
      >
        <img
          className="wall-face-image"
          src={faceUrl}
          alt=""
          draggable={false}
          style={{
            width: layout.faceW,
            height: layout.faceH,
            left: layout.faceX,
            top: layout.faceY,
          }}
        />
      </div>
      <div className="wall-face-caption">MATCH LOCKED</div>
    </div>
  )
}
