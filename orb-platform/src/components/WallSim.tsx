import { useEffect, useMemo, useState } from 'react'
import { MEASURED_WALL_BOUNDS, MEASURED_WALL_PANELS, type WallRole } from '../lib/wallRole'
import { getStationHref } from '../lib/stationRoute'
import './WallSim.css'

function panelSrc(role: WallRole) {
  const url = new URL(window.location.href)
  url.search = `?wallRole=${role}`
  url.hash = '#/mirror'
  return url.toString()
}

/**
 * Home simulator: scaled replica of the measured 6-display Mac Studio wall.
 * Each panel is a live iframe of `?wallRole=…#/mirror` so BroadcastChannel sync works.
 */
export function WallSim() {
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  const [showLabels, setShowLabels] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const layout = useMemo(() => {
    const { wallW, wallH, wallX, wallY } = MEASURED_WALL_BOUNDS
    const padX = 32
    const padY = 120
    const availW = Math.max(320, viewport.width - padX * 2)
    const availH = Math.max(240, viewport.height - padY)
    const scale = Math.min(availW / wallW, availH / wallH)
    return {
      wallW,
      wallH,
      scale,
      stageW: wallW * scale,
      stageH: wallH * scale,
      panels: MEASURED_WALL_PANELS.map((panel) => ({
        role: panel.role,
        label: panel.label,
        nativeW: panel.width,
        nativeH: panel.height,
        left: (panel.x - wallX) * scale,
        top: (panel.y - wallY) * scale,
        width: panel.width * scale,
        height: panel.height * scale,
      })),
    }
  }, [viewport.height, viewport.width])

  return (
    <div className="wall-sim">
      <header className="wall-sim-header">
        <div>
          <p className="wall-sim-kicker">Install simulator</p>
          <h1>6-display wall</h1>
          <p className="wall-sim-copy">
            Exact measured layout ({MEASURED_WALL_BOUNDS.wallW}×{MEASURED_WALL_BOUNDS.wallH}), scaled to
            your screen. Each tile is a live wall-role window — Debra conducts; all panels share phase
            sync.
          </p>
        </div>
        <div className="wall-sim-actions">
          <label className="wall-sim-toggle">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            Labels
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
          className="wall-sim-stage"
          style={{ width: layout.stageW, height: layout.stageH }}
          aria-label="Scaled Mac Studio wall"
        >
          {layout.panels.map((panel) => (
            <div
              key={panel.role}
              className={`wall-sim-panel wall-sim-panel-${panel.role}`}
              style={{
                left: panel.left,
                top: panel.top,
                width: panel.width,
                height: panel.height,
              }}
            >
              <iframe
                key={`${panel.role}-${reloadKey}`}
                className="wall-sim-frame"
                title={`Wall panel ${panel.role}`}
                src={panelSrc(panel.role)}
                allow="autoplay; microphone; camera"
              />
              {showLabels ? (
                <div className="wall-sim-label">
                  <strong>{panel.role}</strong>
                  <span>
                    {panel.nativeW}×{panel.nativeH}
                  </span>
                  <span className="wall-sim-label-meta">{panel.label}</span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <p className="wall-sim-scale">
        Scale {layout.scale.toFixed(3)} · origin ({MEASURED_WALL_BOUNDS.wallX},{' '}
        {MEASURED_WALL_BOUNDS.wallY})
      </p>
    </div>
  )
}
