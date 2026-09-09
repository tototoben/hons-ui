import { notifyRevealReady } from '../lib/photobashTrigger'
import { useEffect, useMemo, useState } from 'react'
import { getStationHref } from '../lib/stationRoute'
import { buildWallSimLayout, type WallSimMode } from '../lib/wallSimLayout'
import type { WallRole } from '../lib/wallRole'
import './WallSim.css'

function panelSrc(role: WallRole, physical: boolean) {
  const url = new URL(window.location.href)
  const quality =
    new URLSearchParams(window.location.search).get('quality') ??
    document.documentElement.dataset.stationQuality
  url.search = `?wallRole=${role}&bare=1`
  if (quality === 'full' || quality === 'kiosk') url.searchParams.set('quality', quality)
  if (physical) url.searchParams.set('wallSimPhysical', '1')
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
        <div className="wall-sim-actions">
          <label className="wall-sim-toggle">
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value as WallSimMode)}>
              <option value="physical">Physical (realistic)</option>
              <option value="css">CSS (ideal)</option>
            </select>
          </label>
          <button type="button" onClick={() => notifyRevealReady()}>
            Generate photobash
          </button>
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
                  src={panelSrc(panel.role, mode === 'physical')}
                  allow="autoplay; microphone; camera"
                  style={undefined}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
