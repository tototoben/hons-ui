import type { DeviceQuality } from './deviceQuality'

export const DEVICE_LOCKS = ['station-1', 'station-2', 'station-3', 'photobash'] as const

export type DeviceLock = (typeof DEVICE_LOCKS)[number]

export type LockedStation = 'station-1' | 'station-2' | 'mirror' | 'photobash'

export const STORAGE_KEY = 'hons-device-lock'
export const UNLOCK_HOLD_MS = 2000
export const UNLOCK_CORNER_PX = 64
export const UNLOCK_KEY = '~'

export const DEVICE_LOCK_LABELS: Record<DeviceLock, string> = {
  'station-1': 'Station I',
  'station-2': 'Station II',
  'station-3': 'Station III',
  photobash: 'Photobash',
}

const KIOSK_CHOICES: DeviceLock[] = ['station-1', 'station-2', 'station-3']
const FULL_CHOICES: DeviceLock[] = ['station-1', 'station-2', 'station-3', 'photobash']

export function readDeviceLock(
  storage: Pick<Storage, 'getItem'> | undefined = defaultStorage(),
): DeviceLock | null {
  try {
    const value = storage?.getItem(STORAGE_KEY)
    return isDeviceLock(value) ? value : null
  } catch {
    return null
  }
}

export function writeDeviceLock(
  lock: DeviceLock,
  storage: Pick<Storage, 'setItem'> | undefined = defaultStorage(),
) {
  try {
    storage?.setItem(STORAGE_KEY, lock)
  } catch {
    // Storage can be unavailable in privacy-restricted kiosk browsers.
  }
}

export function clearDeviceLock(
  storage: Pick<Storage, 'removeItem'> | undefined = defaultStorage(),
) {
  try {
    storage?.removeItem(STORAGE_KEY)
  } catch {
    // Storage can be unavailable in privacy-restricted kiosk browsers.
  }
}

export function pickerChoices(quality: DeviceQuality): DeviceLock[] {
  return quality === 'kiosk' ? KIOSK_CHOICES : FULL_CHOICES
}

export function lockHref(lock: DeviceLock) {
  if (lock === 'station-3') return '#/mirror'
  if (lock === 'photobash') return '#/photobash'
  return `#/${lock}`
}

export function lockToStation(lock: DeviceLock): LockedStation {
  if (lock === 'station-3') return 'mirror'
  return lock
}

function isDeviceLock(value: string | null | undefined): value is DeviceLock {
  return (DEVICE_LOCKS as readonly string[]).includes(value ?? '')
}

function defaultStorage() {
  return typeof window === 'undefined' ? undefined : window.localStorage
}
