import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  parseWallMode,
  wallDesignPlacement,
  wallModeTransform,
  type WallPanelRect,
} from '../lib/wallMode'
import './WallModeViewport.css'

function readPanel(search: string) {
  return parseWallMode(search)
}

export function WallModeViewport({ children }: { children: ReactNode }) {
  const [panel] = useState<WallPanelRect | null>(() => readPanel(window.location.search))
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))

  useEffect(() => {
    document.documentElement.dataset.wallMode = 'true'
    return () => {
      delete document.documentElement.dataset.wallMode
    }
  }, [])

  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const transform = useMemo(() => {
    if (!panel) return null
    return wallModeTransform(panel, viewport.width, viewport.height)
  }, [panel, viewport.height, viewport.width])

  const design = useMemo(() => {
    if (!panel) return null
    return wallDesignPlacement(panel.wallWidth, panel.wallHeight)
  }, [panel])

  if (!panel || !transform || !design) return children

  return (
    <div className="wall-mode-viewport" aria-hidden={false}>
      <div
        className="wall-mode-canvas"
        style={{
          width: transform.wallWidth,
          height: transform.wallHeight,
          transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`,
        }}
      >
        <div
          className="wall-mode-design"
          style={{
            width: design.designWidth,
            height: design.designHeight,
            transform: `translate(${design.offsetX}px, ${design.offsetY}px) scale(${design.scale})`,
          }}
        >
          <div className="wall-mode-station">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function useWallModeEnabled() {
  return useMemo(() => parseWallMode(window.location.search) !== null, [])
}
