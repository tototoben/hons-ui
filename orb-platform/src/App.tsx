import { lazy, Suspense, useEffect, useState } from 'react'
import { MirrorPreviewFrame } from './components/MirrorPreviewToggle'
import { WallModeViewport } from './components/WallModeViewport'
import { applyDeviceQuality } from './lib/deviceQuality'
import { isWallMode } from './lib/wallMode'
import { isWallRoleMode, parseWallRole } from './lib/wallRole'
import { getStationFromHash, getStationHref, type StationRoute } from './lib/stationRoute'
import './index.css'

const DevPanel = lazy(() => import('./dev/DevPanel').then((m) => ({ default: m.DevPanel })))
const LevaRoot = lazy(() => import('./dev/LevaRoot').then((m) => ({ default: m.LevaRoot })))
const StationOne = lazy(() =>
  import('./components/StationOne').then((m) => ({ default: m.StationOne })),
)
const StationTwo = lazy(() =>
  import('./components/StationTwo').then((m) => ({ default: m.StationTwo })),
)
const ThirdStation = lazy(() =>
  import('./components/ThirdStation').then((m) => ({ default: m.ThirdStation })),
)
const ThirdStationWall = lazy(() =>
  import('./components/ThirdStationWall').then((m) => ({ default: m.ThirdStationWall })),
)
const SecondStation = lazy(() =>
  import('./components/SecondStation').then((m) => ({ default: m.SecondStation })),
)
const AvatarStation = lazy(() =>
  import('./components/AvatarStation').then((m) => ({ default: m.AvatarStation })),
)
const WallFaceAlignTool = lazy(() =>
  import('./components/WallFaceAlignTool').then((m) => ({ default: m.WallFaceAlignTool })),
)
const WallSim = lazy(() => import('./components/WallSim').then((m) => ({ default: m.WallSim })))
const OrbStation = lazy(() =>
  import('./components/OrbStation').then((m) => ({ default: m.OrbStation })),
)

export default function App() {
  const [station, setStation] = useState<StationRoute>(() =>
    getStationFromHash(window.location.hash),
  )
  const [wallCropMode] = useState(() => isWallMode())
  const [wallRole] = useState(() => parseWallRole())
  const hideChrome = wallCropMode || isWallRoleMode() || station === 'wall-sim'

  useEffect(() => {
    applyDeviceQuality()
  }, [])

  useEffect(() => {
    const onHashChange = () => setStation(getStationFromHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, '', getStationHref('orb'))
    }
  }, [])

  return (
    <main className="experience">
      {import.meta.env.DEV && !hideChrome ? (
        <Suspense fallback={null}>
          <LevaRoot />
          {station === 'orb' ? <DevPanel /> : null}
        </Suspense>
      ) : null}
      {hideChrome ? null : (
        <nav className={`station-switcher station-switcher-${station}`} aria-label="Station switcher">
          <a
            aria-current={station === 'station-1' ? 'page' : undefined}
            href={getStationHref('station-1')}
          >
            Station I
          </a>
          <a
            aria-current={station === 'station-2' ? 'page' : undefined}
            href={getStationHref('station-2')}
          >
            Station II
          </a>
          <a
            aria-current={station === 'mirror' ? 'page' : undefined}
            href={getStationHref('mirror')}
          >
            Station III
          </a>
          <a aria-current={station === 'orb' ? 'page' : undefined} href={getStationHref('orb')}>
            Orb
          </a>
          <a
            aria-current={station === 'cards' ? 'page' : undefined}
            href={getStationHref('cards')}
          >
            Cards
          </a>
          <a
            aria-current={station === 'avatars' ? 'page' : undefined}
            href={getStationHref('avatars')}
          >
            Avatars
          </a>
          <a
            aria-current={station === 'face-align' ? 'page' : undefined}
            href={getStationHref('face-align')}
          >
            Align
          </a>
          <a
            aria-current={station === 'wall-sim' ? 'page' : undefined}
            href={getStationHref('wall-sim')}
          >
            Wall sim
          </a>
        </nav>
      )}
      <Suspense fallback={null}>
        {station === 'station-1' ? (
          <MirrorPreviewFrame showToggle={import.meta.env.DEV}>
            <StationOne />
          </MirrorPreviewFrame>
        ) : station === 'station-2' ? (
          <MirrorPreviewFrame showToggle={import.meta.env.DEV}>
            <StationTwo />
          </MirrorPreviewFrame>
        ) : station === 'orb' ? (
          <OrbStation />
        ) : station === 'cards' ? (
          <SecondStation />
        ) : station === 'face-align' ? (
          <WallFaceAlignTool />
        ) : station === 'wall-sim' ? (
          <WallSim />
        ) : station === 'mirror' ? (
          wallRole ? (
            <ThirdStationWall role={wallRole} />
          ) : wallCropMode ? (
            <WallModeViewport>
              <ThirdStation />
            </WallModeViewport>
          ) : (
            <ThirdStation />
          )
        ) : (
          <AvatarStation />
        )}
      </Suspense>
    </main>
  )
}
