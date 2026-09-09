import { notifyRevealReady } from '../lib/photobashTrigger'
import { useEffect, useMemo, useState } from 'react'
import { getStationHref } from '../lib/stationRoute'
import {
  HP_27W_PORTRAIT_MM,
  HP_27W_STATION,
  STATION_SIM_STATIONS,
  buildStationSimFloor,
  type StationSimScale,
  type StationSimTarget,
} from '../lib/stationSimLayout'
import type { WallRole } from '../lib/wallRole'
import type { WallSimMode } from '../lib/wallSimLayout'
import './StationSim.css'

function stationSrc(target: StationSimTarget) {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('stationSimFrame', '1')
  url.searchParams.set('simStation', target)
  url.hash = STATION_SIM_STATIONS.find((entry) => entry.id === target)?.hash ?? '#/station-1'
  return url.toString()
}

function wallSrc(role: WallRole, physical: boolean) {
  const url = new URL(window.location.href)
  url.search = `?wallRole=${role}&bare=1`
  if (physical) url.searchParams.set('wallSimPhysical', '1')
  url.hash = '#/photobash'
  return url.toString()
}

/**
 * Temporary type-check preview: HP 27w station + the six-display photobash
 * wall at one millimetre scale. CSS wall mode keeps photobash seams; physical
 * mode shows Lenovo vs TCL size mismatch.
 */
export function StationSim() {
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  const [target, setTarget] = useState<StationSimTarget>('station-1')
  const [mode, setMode] = useState<StationSimScale>('half')
  const [wallSeam, setWallSeam] = useState<WallSimMode>('physical')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const floor = useMemo(
    () => buildStationSimFloor(mode, wallSeam, viewport.width, viewport.height),
    [mode, viewport.height, viewport.width, wallSeam],
  )

  return (
    <div className="station-sim">
      <header className="station-sim-header">
        <p className="station-sim-meta">
          {HP_27W_STATION.model} {HP_27W_PORTRAIT_MM.w}×{HP_27W_PORTRAIT_MM.h} mm + photobash wall ·{' '}
          {Math.round(floor.percentOfPhysical)}% physical · wall {wallSeam === 'css' ? 'CSS seams' : 'physical cabinets'}
        </p>
        <div className="station-sim-actions">
          {STATION_SIM_STATIONS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={target === entry.id}
              onClick={() => setTarget(entry.id)}
            >
              {entry.label}
            </button>
          ))}
          <label className="station-sim-toggle">
            Scale
            <select value={mode} onChange={(event) => setMode(event.target.value as StationSimScale)}>
              <option value="life">Life-size (CSS mm)</option>
              <option value="half">Half physical</option>
              <option value="fit">Fit window</option>
            </select>
          </label>
          <label className="station-sim-toggle">
            Wall
            <select value={wallSeam} onChange={(event) => setWallSeam(event.target.value as WallSimMode)}>
              <option value="css">CSS seams</option>
              <option value="physical">Physical cabinets</option>
            </select>
          </label>
          <button type="button" onClick={() => notifyRevealReady()}>
            Generate photobash
          </button>
          <button type="button" onClick={() => setReloadKey((n) => n + 1)}>
            Reload
          </button>
          <a className="station-sim-link" href={getStationHref('orb')}>
            Exit
          </a>
        </div>
      </header>

      <div className="station-sim-stage-wrap">
        <div className="station-sim-floor" style={{ width: floor.floorW, height: floor.floorH }}>
          <div
            className="station-sim-ruler"
            style={{ height: floor.ruler100MmPx }}
            aria-hidden="true"
          >
            100 mm
          </div>
          <section className="station-sim-station-col" aria-label="Station kiosk">
            <p className="station-sim-label">Station kiosk · HP 27w</p>
            <div
              className="station-sim-cabinet"
              style={{ width: floor.station.stageW, height: floor.station.stageH }}
            >
              <iframe
                key={`station-${target}-${reloadKey}`}
                className="station-sim-frame"
                title={`${target} HP 27w preview`}
                src={stationSrc(target)}
                allow="autoplay; microphone; camera"
                style={{
                  width: floor.station.nativeW,
                  height: floor.station.nativeH,
                  transform: `scale(${floor.station.scale})`,
                }}
              />
            </div>
          </section>
          <section className="station-sim-wall-col" aria-label="Photobash wall">
            <p className="station-sim-label">Photobash wall · {floor.wall.panels.length} displays</p>
            <div
              className={`station-sim-wall station-sim-wall-${wallSeam}`}
              style={{ width: floor.wall.stageW, height: floor.wall.stageH }}
            >
              {floor.wall.panels.map((panel) => (
                <div
                  key={panel.role}
                  className={`station-sim-cabinet station-sim-wall-panel wall-sim-panel-${panel.device}`}
                  style={{
                    left: panel.left,
                    top: panel.top,
                    width: panel.width,
                    height: panel.height,
                  }}
                >
                  <iframe
                  key={`${panel.role}-${reloadKey}-${wallSeam}`}
                    className="station-sim-frame"
                    title={`Wall panel ${panel.role}`}
                    src={wallSrc(panel.role, wallSeam === 'physical')}
                    allow="autoplay; microphone; camera"
                    style={{
                      width: panel.nativeW,
                      height: panel.nativeH,
                      transform: `scale(${panel.width / panel.nativeW})`,
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
