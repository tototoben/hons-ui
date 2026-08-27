import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { DevicePicker } from './components/DevicePicker'
import { DeviceUnlockLayer } from './components/DeviceUnlockLayer'
import { MirrorPreviewFrame } from './components/MirrorPreviewToggle'
import { applyDeviceQuality, getDeviceQuality } from './lib/deviceQuality'
import {
  STORAGE_KEY,
  clearDeviceLock,
  lockHref,
  lockToStation,
  readDeviceLock,
  writeDeviceLock,
  type DeviceLock,
} from './lib/deviceLock'
import './index.css'

const StationOne = lazy(() =>
  import('./components/StationOne').then((m) => ({ default: m.StationOne })),
)
const StationTwo = lazy(() =>
  import('./components/StationTwo').then((m) => ({ default: m.StationTwo })),
)
const ThirdStation = lazy(() =>
  import('./components/ThirdStation').then((m) => ({ default: m.ThirdStation })),
)
const PhotobashScreen = lazy(() =>
  import('./components/PhotobashScreen').then((m) => ({ default: m.PhotobashScreen })),
)

export default function App() {
  const [lock, setLock] = useState<DeviceLock | null>(() => readDeviceLock())
  const [quality] = useState(() => getDeviceQuality())
  const station = lock ? lockToStation(lock) : null

  const applyLock = useCallback((next: DeviceLock) => {
    writeDeviceLock(next)
    setLock(next)
    window.history.replaceState(null, '', lockHref(next))
  }, [])

  const unlock = useCallback(() => {
    clearDeviceLock()
    setLock(null)
  }, [])

  useEffect(() => {
    applyDeviceQuality()
  }, [])

  useEffect(() => {
    if (!lock) return
    const href = lockHref(lock)
    if (window.location.hash !== href) {
      window.history.replaceState(null, '', href)
    }
    const onHashChange = () => {
      if (window.location.hash !== href) {
        window.history.replaceState(null, '', href)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [lock])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return
      setLock(readDeviceLock())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <main className="experience">
      {lock ? <DeviceUnlockLayer onUnlock={unlock} /> : null}
      <Suspense fallback={null}>
        {!lock ? (
          <DevicePicker quality={quality} onLock={applyLock} />
        ) : station === 'station-1' ? (
          <MirrorPreviewFrame>
            <StationOne />
          </MirrorPreviewFrame>
        ) : station === 'station-2' ? (
          <MirrorPreviewFrame>
            <StationTwo />
          </MirrorPreviewFrame>
        ) : station === 'photobash' ? (
          <PhotobashScreen />
        ) : (
          <ThirdStation />
        )}
      </Suspense>
    </main>
  )
}
