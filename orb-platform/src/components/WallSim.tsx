import { useEffect, useMemo, useState } from 'react'
import { MEASURED_WALL_BOUNDS } from '../lib/wallRole'
import { getStationHref } from '../lib/stationRoute'
import { buildWallSimLayout, type WallSimMode } from '../lib/wallSimLayout'
import type { WallRole } from '../lib/wallRole'
import './WallSim.css'

function panelSrc(role: WallRole) {
  const url = new URL(window.location.href)
  url.search = `?wallRole=${role}`
  url.hash = '#/mirror'
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
  const [showLabels, setShowLabels] = useState(true)
  const [mode, setMode] = useState<WallSimMode>('physical')
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
        <div>
          <p className="wall-sim-kicker">Install simulator</p>
          <h1>6-display wall</h1>
          <p className="wall-sim-copy">
            {mode === 'physical' ? (
              <>
                <strong>Physical mode</strong> — Lenovo L24i vs TCL 43″ real sizes, bezel gaps, and TV
                overscan. The face will <em>not</em> line up cleanly (like the gallery). Switch to CSS
                mode to see the ideal software seam.
              </>
            ) : (
              <>
                <strong>CSS mode</strong> — measured {MEASURED_WALL_BOUNDS.wallW}×
                {MEASURED_WALL_BOUNDS.wallH} pixel grid. Seams look perfect; this is what the code
                assumes, not what mixed PPI/overscan does in the room.
              </>
            )}
          </p>
        </div>
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
                  key={`${panel.role}-${reloadKey}-${mode}`}
                  className="wall-sim-frame"
                  title={`Wall panel ${panel.role}`}
                  src={panelSrc(panel.role)}
                  allow="autoplay; microphone; camera"
                  style={
                    panel.overscan !== 1
                      ? { transform: `scale(${panel.overscan})` }
                      : undefined
                  }
                />
              </div>
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
        {mode} · scale {layout.scale.toFixed(3)} · 4× L24i-4A + 2× TCL 43P615
      </p>
    </div>
  )
}
