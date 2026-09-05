import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { DevicePicker } from './components/DevicePicker'
import { DeviceUnlockLayer } from './components/DeviceUnlockLayer'
import { MirrorPreviewFrame } from './components/MirrorPreviewToggle'
import { WallModeViewport } from './components/WallModeViewport'
import { applyDeviceQuality, getDeviceQuality } from './lib/deviceQuality'
import { perfSetView } from './lib/perfMonitor'
import { resetVisitorProfile } from './lib/visitorProfile'
import { resetVisitorFaceCapture } from './lib/visitorFaceCapture'
import {
  STORAGE_KEY,
  clearDeviceLock,
  lockHref,
  lockToStation,
  readDeviceLock,
  writeDeviceLock,
  type DeviceLock,
} from './lib/deviceLock'
import { isPickerDismissKey, isProductionHotkey } from './lib/productionHotkey'
import { isWallMode } from './lib/wallMode'
import { isWallRoleMode, parseWallRole } from './lib/wallRole'
import { showTuningPanel } from './lib/tune'
import {
  getStationFromHash,
  getStationHref,
  isEmptyStationHash,
  isKioskBlockedStation,
  type StationRoute,
} from './lib/stationRoute'
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
const WallCalibrate = lazy(() =>
  import('./components/WallCalibrate').then((m) => ({ default: m.WallCalibrate })),
)
const WallSim = lazy(() => import('./components/WallSim').then((m) => ({ default: m.WallSim })))
const OrbStation = lazy(() =>
  import('./components/OrbStation').then((m) => ({ default: m.OrbStation })),
)
const PhotobashScreen = lazy(() =>
  import('./components/PhotobashScreen').then((m) => ({ default: m.PhotobashScreen })),
)
const DebraCapture = lazy(() =>
  import('./components/DebraCapture').then((m) => ({ default: m.DebraCapture })),
)

export default function App() {
  const [lock, setLock] = useState<DeviceLock | null>(() => readDeviceLock())
  const [quality] = useState(() => getDeviceQuality())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [routeHash, setRouteHash] = useState(() => window.location.hash)
  const [station, setStation] = useState<StationRoute>(() =>
    getStationFromHash(window.location.hash),
  )
  const [wallCropMode] = useState(() => isWallMode())
  const [wallRole] = useState(() => parseWallRole())
  const lockedStation = lock ? lockToStation(lock) : null
  const isWallSim = station === 'wall-sim'
  const isWallPanel = wallRole !== null
  const showPicker =
    pickerOpen ||
    (!lock && isEmptyStationHash(routeHash)) ||
    (!lock && quality === 'kiosk' && isKioskBlockedStation(station))
  const hideChrome =
    Boolean(lock) ||
    showPicker ||
    wallCropMode ||
    isWallRoleMode() ||
    station === 'wall-sim' ||
    station === 'wall-cal' ||
    station === 'debra-capture'
  const showMainNav = !hideChrome

  const applyLock = useCallback((next: DeviceLock) => {
    writeDeviceLock(next)
    setLock(next)
    setPickerOpen(false)
    if (next === 'station-1') {
      resetVisitorProfile()
      resetVisitorFaceCapture()
    }
    const href = lockHref(next)
    window.history.replaceState(null, '', href)
    setRouteHash(href)
    setStation(getStationFromHash(href))
  }, [])

  const unlock = useCallback(() => {
    clearDeviceLock()
    setLock(null)
    setPickerOpen(false)
  }, [])

  useEffect(() => {
    applyDeviceQuality()
  }, [])

  useEffect(() => {
    perfSetView(station)
  }, [station])

  useEffect(() => {
    const onHashChange = () => {
      setRouteHash(window.location.hash)
      setStation(getStationFromHash(window.location.hash))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (!lock || isWallSim || isWallPanel) return
    const href = lockHref(lock)
    if (window.location.hash !== href) {
      window.history.replaceState(null, '', href)
      setRouteHash(href)
      setStation(getStationFromHash(href))
    }
    const onHashChange = () => {
      if (getStationFromHash(window.location.hash) === 'wall-sim') return
      if (parseWallRole()) return
      if (window.location.hash !== href) {
        window.history.replaceState(null, '', href)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [isWallPanel, isWallSim, lock])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return
      setLock(readDeviceLock())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (pickerOpen && isPickerDismissKey(event)) {
        event.preventDefault()
        event.stopPropagation()
        setPickerOpen(false)
        return
      }
      if (isProductionHotkey(event)) {
        event.preventDefault()
        event.stopPropagation()
        setPickerOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pickerOpen])

  return (
    <main className="experience">
      {lock ? <DeviceUnlockLayer onUnlock={unlock} /> : null}
      {showTuningPanel() && !hideChrome ? (
        <Suspense fallback={null}>
          <LevaRoot />
          {station === 'orb' ? <DevPanel /> : null}
        </Suspense>
      ) : null}
      {showMainNav ? (
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
        </nav>
      ) : null}
      <Suspense fallback={null}>
        {showPicker ? (
          <DevicePicker quality={quality} onLock={applyLock} />
        ) : isWallSim ? (
          <WallSim />
        ) : lock && isWallPanel ? (
          <PhotobashScreen />
        ) : lock && lockedStation === 'photobash' ? (
          <PhotobashScreen />
        ) : lock && lockedStation === 'station-1' ? (
          <MirrorPreviewFrame>
            <StationOne />
          </MirrorPreviewFrame>
        ) : lock && lockedStation === 'station-2' ? (
          <MirrorPreviewFrame>
            <StationTwo />
          </MirrorPreviewFrame>
        ) : lock ? (
          <ThirdStation />
        ) : station === 'station-1' ? (
          <MirrorPreviewFrame>
            <StationOne />
          </MirrorPreviewFrame>
        ) : station === 'station-2' ? (
          <MirrorPreviewFrame>
            <StationTwo />
          </MirrorPreviewFrame>
        ) : station === 'orb' ? (
          <OrbStation />
        ) : station === 'cards' ? (
          <SecondStation />
        ) : station === 'face-align' ? (
          <WallFaceAlignTool />
        ) : station === 'wall-cal' ? (
          <WallCalibrate role={wallRole ?? 'copy'} />
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
        ) : station === 'photobash' ? (
          <PhotobashScreen />
        ) : station === 'debra-capture' ? (
          <DebraCapture />
        ) : (
          <AvatarStation />
        )}
      </Suspense>
    </main>
  )
}
