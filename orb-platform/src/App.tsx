import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { DevicePicker } from './components/DevicePicker'
import { DeviceUnlockLayer } from './components/DeviceUnlockLayer'
import { MirrorPreviewFrame } from './components/MirrorPreviewToggle'
import { WallModeViewport } from './components/WallModeViewport'
import { ThirdStationWall } from './components/ThirdStationWall'
import { applyDeviceQuality, getDeviceQuality } from './lib/deviceQuality'
import { resetVisitorProfile } from './lib/visitorProfile'
import { resetVisitorFaceCapture } from './lib/visitorFaceCapture'
import { resetInterview } from './lib/interviewStore'
import { resetVisitorIntro } from './lib/visitorIntro'
import { perfSetView } from './lib/perfMonitor'
import {
  STORAGE_KEY,
  clearDeviceLock,
  lockHref,
  lockToStation,
  readDeviceLock,
  writeDeviceLock,
  type DeviceLock,
} from './lib/deviceLock'
import { isPickerDismissKey, isProductionHotkey, isStationRestartHotkey, pickerLockFromKey } from './lib/productionHotkey'
import { resetCurrentStationMemory, stationFirehoseId } from './lib/stationSession'
import { parseStationSimFrame } from './lib/stationSimLayout'
import { isWallMode } from './lib/wallMode'
import { isWallRoleMode, parseWallRole } from './lib/wallRole'
import { showTuningPanel } from './lib/tune'
import { connectIpadSimLink, applyRemoteKey, applyRemoteSliderValue } from './lib/ipadSimLink'
import { connectRoomStream } from './lib/roomStream'
import { clearPhotowallQueueForRoomReset } from './lib/photowallQueue'
import { publishKeyboardFocus } from './lib/keyboardFocus'
import {
  getStationFromHash,
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
const SecondStation = lazy(() =>
  import('./components/SecondStation').then((m) => ({ default: m.SecondStation })),
)
const WallFaceAlignTool = lazy(() =>
  import('./components/WallFaceAlignTool').then((m) => ({ default: m.WallFaceAlignTool })),
)
const WallCalibrate = lazy(() =>
  import('./components/WallCalibrate').then((m) => ({ default: m.WallCalibrate })),
)
const WallSim = lazy(() => import('./components/WallSim').then((m) => ({ default: m.WallSim })))
const StationSim = lazy(() =>
  import('./components/StationSim').then((m) => ({ default: m.StationSim })),
)
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
  const [stationSession, setStationSession] = useState(0)
  const [routeHash, setRouteHash] = useState(() => window.location.hash)
  const [station, setStation] = useState<StationRoute>(() =>
    getStationFromHash(window.location.hash),
  )
  const [wallCropMode] = useState(() => isWallMode())
  const [wallRole] = useState(() => parseWallRole())
  const lockedStation = lock ? lockToStation(lock) : null
  const isWallSim = station === 'wall-sim'
  const isStationSim = station === 'station-sim'
  const isStationSimFrame = parseStationSimFrame()
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
    station === 'station-sim' ||
    isStationSimFrame ||
    station === 'wall-cal' ||
    station === 'debra-capture'

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

  const restartStation = useCallback(() => {
    const current = lock ? lockToStation(lock) : station
    if (!resetCurrentStationMemory(current)) return
    setStationSession((value) => value + 1)
  }, [lock, station])

  const handleRoomReset = useCallback(() => {
    resetInterview()
    resetVisitorProfile()
    resetVisitorFaceCapture()
    resetVisitorIntro()
    try { localStorage.removeItem('hons-photobash-reveal') } catch { /* kiosk browser may block */ }
    clearPhotowallQueueForRoomReset()
    setStationSession((value) => value + 1)
    console.log('[reset] room-reset received — local state cleared')
  }, [])

  // Embedded path: visualizer broadcasts room-reset via postMessage.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || data.source !== 'orb-firehose' || data.event !== 'room-reset') return
      handleRoomReset()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [handleRoomReset])

  // Top-level path: station bridge forwards room/reset + ui/state via SSE.
  useEffect(() => {
    return connectRoomStream((event) => {
      if (event.type === 'room-reset') {
        handleRoomReset()
        return
      }
      if (event.type === 'ui-state' && event.data.stage === 'reset') {
        handleRoomReset()
        return
      }
      if (event.type === 'remote-input') {
        const { slider, confirm, operator } = event.data
        if (operator === 'restart') {
          restartStation()
          return
        }
        if (operator === 'picker') {
          setPickerOpen(true)
          return
        }
        if (typeof slider === 'number' && Number.isFinite(slider)) {
          applyRemoteSliderValue(slider)
        }
        if (confirm) {
          applyRemoteKey({ special: 'confirm' })
        }
      }
      // Future room-level events can be dispatched here.
    }) ?? undefined
  }, [handleRoomReset, restartStation])

  useEffect(() => {
    applyDeviceQuality()
  }, [])

  useEffect(() => {
    // One long-lived HTTP stream per interactive station. Wall iframes must
    // leave connections available for lazy modules, face images and WASM.
    if (isWallPanel || isWallSim || isStationSim || station === 'photobash') return
    return connectIpadSimLink()
  }, [isWallPanel, isWallSim, isStationSim, station])

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
    if (!lock || isWallSim || isStationSim || isStationSimFrame || isWallPanel) return
    const href = lockHref(lock)
    if (window.location.hash !== href) {
      window.history.replaceState(null, '', href)
      setRouteHash(href)
      setStation(getStationFromHash(href))
    }
    const onHashChange = () => {
      if (getStationFromHash(window.location.hash) === 'wall-sim') return
      if (getStationFromHash(window.location.hash) === 'station-sim') return
      if (parseStationSimFrame()) return
      if (parseWallRole()) return
      if (window.location.hash !== href) {
        window.history.replaceState(null, '', href)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [isWallPanel, isStationSim, isStationSimFrame, isWallSim, lock])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return
      setLock(readDeviceLock())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (!showPicker) return
    const current = lock ? lockToStation(lock) : station
    const id = stationFirehoseId(current)
    if (!id) return
    publishKeyboardFocus(id, 'text')
  }, [lock, showPicker, station])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isStationRestartHotkey(event)) {
        event.preventDefault()
        event.stopPropagation()
        restartStation()
        return
      }
      if (showPicker) {
        const pick = pickerLockFromKey(event)
        if (pick) {
          event.preventDefault()
          event.stopPropagation()
          applyLock(pick)
          return
        }
      }
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
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [applyLock, pickerOpen, restartStation, showPicker])

  return (
    <main className="experience">
      {lock ? <DeviceUnlockLayer onUnlock={unlock} /> : null}
      {showTuningPanel() && !hideChrome ? (
        <Suspense fallback={null}>
          <LevaRoot />
          {station === 'orb' ? <DevPanel /> : null}
        </Suspense>
      ) : null}
      <Suspense fallback={null}>
        {showPicker ? (
          <DevicePicker quality={quality} onLock={applyLock} />
        ) : isWallSim ? (
          <WallSim />
        ) : isStationSim ? (
          <StationSim />
        ) : !isStationSimFrame && lock && isWallPanel ? (
          <PhotobashScreen />
        ) : !isStationSimFrame && lock && lockedStation === 'photobash' ? (
          <PhotobashScreen />
        ) : !isStationSimFrame && lock && lockedStation === 'station-1' ? (
          <MirrorPreviewFrame>
            <StationOne key={stationSession} />
          </MirrorPreviewFrame>
        ) : !isStationSimFrame && lock && lockedStation === 'station-2' ? (
          <MirrorPreviewFrame>
            <StationTwo key={stationSession} />
          </MirrorPreviewFrame>
        ) : !isStationSimFrame && lock ? (
          <ThirdStation key={stationSession} />
        ) : station === 'station-1' ? (
          <MirrorPreviewFrame>
            <StationOne key={stationSession} />
          </MirrorPreviewFrame>
        ) : station === 'station-2' ? (
          <MirrorPreviewFrame>
            <StationTwo key={stationSession} />
          </MirrorPreviewFrame>
        ) : station === 'station-3' ? (
          <ThirdStation key={stationSession} />
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
              <ThirdStation key={stationSession} />
            </WallModeViewport>
          ) : (
            <MirrorPreviewFrame>
              <ThirdStation key={stationSession} />
            </MirrorPreviewFrame>
          )
        ) : station === 'photobash' ? (
          <PhotobashScreen />
        ) : station === 'debra-capture' ? (
          <DebraCapture />
        ) : (
          <OrbStation />
        )}
      </Suspense>
    </main>
  )
}
