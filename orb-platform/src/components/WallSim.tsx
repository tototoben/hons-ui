import { useEffect, useMemo, useState } from 'react'
import { getStationHref } from '../lib/stationRoute'
import { buildWallSimLayout, type WallSimMode } from '../lib/wallSimLayout'
import type { WallRole } from '../lib/wallRole'
import './WallSim.css'

function panelSrc(role: WallRole, collage: boolean) {
  const url = new URL(window.location.href)
  url.search = collage ? `?wallRole=${role}&collage=1&bare=1` : `?wallRole=${role}&collage=0&bare=1`
  url.hash = '#/photobash'
  return url.toString()
}

/**
 * Home simulator for the Mac Studio wall.
 * Default "physical" mode breaks the perfect CSS seam so Lenovo vs TCL
 * size/overscan matches the gallery better than pixel-perfect mode.
 */
export function WallSim() {
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  const [mode, setMode] = useState<WallSimMode>('css')
  const [collage, setCollage] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const layout = useMemo(
    () => buildWallSimLayout(mode, viewport.width, viewport.height),
    [mode, viewport.height, viewport.width],
  )

  return (
    <div className="wall-sim">
      <header className="wall-sim-header">
        <div className="wall-sim-actions">
          <label className="wall-sim-toggle">
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value as WallSimMode)}>
              <option value="physical">Physical (realistic)</option>
              <option value="css">CSS (ideal)</option>
            </select>
          </label>
          <label className="wall-sim-toggle">
            <input
              type="checkbox"
              checked={collage}
              onChange={(e) => setCollage(e.target.checked)}
            />
            Collage photobash
          </label>
          <button type="button" onClick={() => setReloadKey((n) => n + 1)}>
            Reload panels
          </button>
          <a className="wall-sim-link" href={getStationHref('face-align')}>
            Face align
          </a>
          <a className="wall-sim-link" href={getStationHref('orb')}>
            Exit
          </a>
        </div>
      </header>

      <div className="wall-sim-stage-wrap">
        <div
          className={`wall-sim-stage wall-sim-stage-${mode}`}
          style={{ width: layout.stageW, height: layout.stageH }}
          aria-label="Scaled Mac Studio wall"
        >
          {layout.panels.map((panel) => (
            <div
              key={panel.role}
              className={`wall-sim-panel wall-sim-panel-${panel.device} wall-sim-panel-${panel.role}`}
              style={{
                left: panel.left,
                top: panel.top,
                width: panel.width,
                height: panel.height,
              }}
            >
              <div className="wall-sim-frame-clip">
                <iframe
                  key={`${panel.role}-${reloadKey}-${mode}-${collage}`}
                  className="wall-sim-frame"
                  title={`Wall panel ${panel.role}`}
                  src={panelSrc(panel.role, collage)}
                  allow="autoplay; microphone; camera"
                  style={
                    panel.overscan !== 1
                      ? { transform: `scale(${panel.overscan})` }
                      : undefined
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
