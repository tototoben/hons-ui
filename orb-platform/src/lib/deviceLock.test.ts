// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import {
  DEVICE_LOCK_LABELS,
  UNLOCK_CORNER_PX,
  UNLOCK_HOLD_MS,
  UNLOCK_KEY,
  clearDeviceLock,
  lockHref,
  lockToStation,
  pickerChoices,
  readDeviceLock,
  writeDeviceLock,
} from './deviceLock'

describe('deviceLock', () => {
  afterEach(() => {
    clearDeviceLock()
  })

  it('treats missing or invalid storage as unlocked', () => {
    expect(readDeviceLock({ getItem: () => null })).toBeNull()
    expect(readDeviceLock({ getItem: () => 'orb' })).toBeNull()
    expect(
      readDeviceLock({
        getItem: () => {
          throw new Error('blocked')
        },
      }),
    ).toBeNull()
  })

  it('persists a valid lock and can clear it', () => {
    const store = new Map<string, string>()
    writeDeviceLock('station-1', {
      setItem: (key, value) => {
        store.set(key, value)
      },
    })
    expect(store.get('hons-device-lock')).toBe('station-1')
    expect(readDeviceLock({ getItem: (key) => store.get(key) ?? null })).toBe('station-1')
    clearDeviceLock({
      removeItem: (key) => {
        store.delete(key)
      },
    })
    expect(store.has('hons-device-lock')).toBe(false)
  })

  it('omits Photobash on kiosk pickers and includes it on full quality', () => {
    expect(pickerChoices('kiosk')).toEqual(['station-1', 'station-2', 'station-3'])
    expect(pickerChoices('full')).toEqual(['station-1', 'station-2', 'station-3', 'photobash'])
  })

  it('maps locks to production hrefs and station routes', () => {
    expect(lockHref('station-1')).toBe('#/station-1')
    expect(lockHref('station-2')).toBe('#/station-2')
    expect(lockHref('station-3')).toBe('#/mirror')
    expect(lockHref('photobash')).toBe('#/photobash')
    expect(lockToStation('station-3')).toBe('mirror')
    expect(lockToStation('photobash')).toBe('photobash')
    expect(DEVICE_LOCK_LABELS.photobash).toBe('Photobash')
    expect(UNLOCK_HOLD_MS).toBe(2000)
    expect(UNLOCK_CORNER_PX).toBe(64)
    expect(UNLOCK_KEY).toBe('~')
  })
})
