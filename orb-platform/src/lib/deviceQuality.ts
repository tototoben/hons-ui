import { STORAGE_KEY as DEVICE_LOCK_STORAGE_KEY } from './deviceLock'

export type DeviceQuality = 'full' | 'kiosk'

export const QUALITY_STORAGE_KEY = 'station-quality'

const KIOSK_LOCKS = new Set(['station-1', 'station-2', 'station-3'])

export type DeviceQualityEnv = {
  userAgent?: string
  platform?: string
  hardwareConcurrency?: number
  deviceMemory?: number
  search?: string
  storage?: Pick<Storage, 'getItem'> | undefined
}

let current: DeviceQuality | null = null

export function detectDeviceQuality(env: DeviceQualityEnv = defaultEnv()): DeviceQuality {
  const query = readQueryOverride(env)
  if (query) return query

  if (isKioskDeviceLock(env.storage)) return 'kiosk'

  const stored = readStoredQuality(env)
  if (stored) return stored

  const userAgent = env.userAgent ?? ''
  const platform = env.platform ?? ''
  const haystack = `${userAgent} ${platform}`

  if (/Raspberry|Pi-400|RaspberryPi|WPE|WebKitGTK|\bCog\b/i.test(haystack)) return 'kiosk'

  const armLinux =
    /Linux/i.test(haystack) && /(aarch64|arm64|armv7|armv8|\barm\b)/i.test(haystack)
  if (armLinux) return 'kiosk'

  const cores = env.hardwareConcurrency
  const memory = env.deviceMemory
  if (typeof memory === 'number' && memory <= 2 && (cores === undefined || cores <= 4)) {
    return 'kiosk'
  }

  return 'full'
}

export function getDeviceQuality() {
  if (current === null) current = detectDeviceQuality()
  return current
}

export function isKioskQuality() {
  return getDeviceQuality() === 'kiosk'
}

export function applyDeviceQuality(quality: DeviceQuality = getDeviceQuality()) {
  current = quality
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.stationQuality = quality
  }
  if (quality === 'kiosk') persistKioskQuality()
  return quality
}

export function mirrorCameraConstraints(quality: DeviceQuality = getDeviceQuality()) {
  if (quality === 'kiosk') {
    return {
      facingMode: 'user' as const,
      // Landscape on purpose. A portrait 480×640 ask makes laptop / USB
      // webcams center-crop their 16:9 sensor, which reads as a tight
      // face zoom. mapLandmarkToMirror already cover-crops the live
      // frame into the portrait UI from whatever the camera actually
      // delivers.
      width: { ideal: 640, max: 960 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: 15, max: 20 },
    }
  }
  // A portrait 1080x1920 (~2MP) ask with no frameRate floor made external
  // USB webcams stutter badly — they're landscape-native and either fake
  // portrait via a slow software rotate/crop/scale, or only hit that pixel
  // count at a low capped frame rate. mapLandmarkToMirror already does
  // cover-style cropping from the video's *actual* dimensions, so it
  // doesn't care whether the raw stream is portrait or landscape — a
  // smaller, landscape, universally-supported mode with an explicit
  // frameRate floor fixes the lag without touching display or tracking.
  return {
    facingMode: 'user' as const,
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, min: 15 },
  }
}

export function detectIntervalMs(quality: DeviceQuality = getDeviceQuality()) {
  return quality === 'kiosk' ? 120 : 66
}

export function canvasPixelRatio(quality: DeviceQuality = getDeviceQuality()) {
  const ratio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  return Math.min(ratio, quality === 'kiosk' ? 1 : 2)
}

export function webGlMaxDpr(quality: DeviceQuality = getDeviceQuality()) {
  return quality === 'kiosk' ? 1 : 1.5
}

export function kioskOrbCounts(
  counts: {
    shell: number
    volume: number
    halo: number
  },
  quality: DeviceQuality = getDeviceQuality(),
) {
  if (quality !== 'kiosk') return counts
  return {
    shell: Math.max(360, Math.round(counts.shell * 0.28)),
    volume: Math.max(240, Math.round(counts.volume * 0.28)),
    halo: Math.max(100, Math.round(counts.halo * 0.28)),
  }
}

function readQueryOverride(env: DeviceQualityEnv): DeviceQuality | null {
  try {
    const params = new URLSearchParams(env.search ?? '')
    const query = params.get('quality') ?? params.get('lowpower')
    if (query === 'low' || query === 'kiosk' || query === '1') return 'kiosk'
    if (query === 'full' || query === 'high') return 'full'
  } catch {
    // Privacy-restricted kiosk browsers can block search parsing.
  }
  return null
}

function readStoredQuality(env: DeviceQualityEnv): DeviceQuality | null {
  try {
    const stored = env.storage?.getItem(QUALITY_STORAGE_KEY)
    if (stored === 'low' || stored === 'kiosk') return 'kiosk'
    if (stored === 'full') return 'full'
  } catch {
    // Privacy-restricted kiosk browsers can block storage.
  }
  return null
}

function isKioskDeviceLock(storage: DeviceQualityEnv['storage']) {
  try {
    const lock = storage?.getItem(DEVICE_LOCK_STORAGE_KEY)
    return typeof lock === 'string' && KIOSK_LOCKS.has(lock)
  } catch {
    return false
  }
}

function persistKioskQuality() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(QUALITY_STORAGE_KEY, 'kiosk')
  } catch {
    // Privacy-restricted kiosk browsers can block storage.
  }
}

function defaultEnv(): DeviceQualityEnv {
  if (typeof navigator === 'undefined') return {}
  const nav = navigator as Navigator & { deviceMemory?: number }
  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    search: typeof location === 'undefined' ? '' : location.search,
    storage: typeof window === 'undefined' ? undefined : window.localStorage,
  }
}
