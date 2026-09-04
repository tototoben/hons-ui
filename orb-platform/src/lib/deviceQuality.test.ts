// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import {
  QUALITY_STORAGE_KEY,
  applyDeviceQuality,
  detectDeviceQuality,
  kioskOrbCounts,
  mirrorCameraConstraints,
} from './deviceQuality'

describe('device quality', () => {
  afterEach(() => {
    applyDeviceQuality('full')
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(QUALITY_STORAGE_KEY)
      delete document.documentElement.dataset.stationQuality
    }
  })

  it('keeps full quality on a typical desktop', () => {
    expect(
      detectDeviceQuality({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
        platform: 'Win32',
        hardwareConcurrency: 8,
        deviceMemory: 16,
        search: '',
      }),
    ).toBe('full')
  })

  it('detects Raspberry Pi kiosks from the user agent', () => {
    expect(
      detectDeviceQuality({
        userAgent: 'Mozilla/5.0 (X11; Linux aarch64) Raspberry Pi Chromium',
        platform: 'Linux aarch64',
        hardwareConcurrency: 4,
        deviceMemory: 4,
        search: '',
      }),
    ).toBe('kiosk')
  })

  it('treats 4GB ARM Linux as a kiosk even without Raspberry in the UA', () => {
    expect(
      detectDeviceQuality({
        userAgent: 'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 Chrome/120',
        platform: 'Linux aarch64',
        hardwareConcurrency: 4,
        deviceMemory: 4,
        search: '',
      }),
    ).toBe('kiosk')
  })

  it('treats WPE without a core count as kiosk', () => {
    expect(
      detectDeviceQuality({
        userAgent:
          'Mozilla/5.0 (Linux armv7l) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/2.48.0 Safari/605.1.15 WPE',
        platform: 'Linux armv7l',
        search: '',
      }),
    ).toBe('kiosk')
  })

  it('treats Chromium on Pi without the word Raspberry as kiosk', () => {
    expect(
      detectDeviceQuality({
        userAgent: 'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36',
        platform: 'Linux aarch64',
        hardwareConcurrency: 4,
        deviceMemory: 4,
        search: '',
      }),
    ).toBe('kiosk')
  })

  it('treats ARM Linux as kiosk when hardwareConcurrency is missing', () => {
    expect(
      detectDeviceQuality({
        userAgent: 'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/605.1.15 Cog',
        platform: 'Linux aarch64',
        search: '',
      }),
    ).toBe('kiosk')
  })

  it('forces kiosk when station-1 is locked even on a Mac UA', () => {
    expect(
      detectDeviceQuality({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/120',
        platform: 'MacIntel',
        hardwareConcurrency: 10,
        deviceMemory: 16,
        search: '',
        storage: {
          getItem: (key) => (key === 'hons-device-lock' ? 'station-1' : null),
        },
      }),
    ).toBe('kiosk')
  })

  it('lets ?quality=full override a station lock', () => {
    expect(
      detectDeviceQuality({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/120',
        platform: 'MacIntel',
        hardwareConcurrency: 10,
        deviceMemory: 16,
        search: '?quality=full',
        storage: {
          getItem: (key) => (key === 'hons-device-lock' ? 'station-1' : null),
        },
      }),
    ).toBe('full')
  })

  it('lets a query string force the kiosk profile on a fast machine', () => {
    expect(
      detectDeviceQuality({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/120',
        platform: 'MacIntel',
        hardwareConcurrency: 10,
        deviceMemory: 16,
        search: '?quality=low',
      }),
    ).toBe('kiosk')
  })

  it('uses stored kiosk quality on a desktop UA', () => {
    expect(
      detectDeviceQuality({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/120',
        platform: 'MacIntel',
        hardwareConcurrency: 10,
        deviceMemory: 16,
        search: '',
        storage: {
          getItem: (key) => (key === QUALITY_STORAGE_KEY ? 'kiosk' : null),
        },
      }),
    ).toBe('kiosk')
  })

  it('caps the mirror camera and guide-orb budget on kiosk', () => {
    expect(mirrorCameraConstraints('kiosk')).toMatchObject({
      width: { ideal: 640, max: 960 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: 15, max: 20 },
    })
    expect(kioskOrbCounts({ shell: 2900, volume: 2425, halo: 1310 }, 'kiosk')).toEqual({
      shell: 812,
      volume: 679,
      halo: 367,
    })
  })

  it('persists a detected kiosk profile so a later URL without ?quality=kiosk stays cheap', () => {
    applyDeviceQuality('kiosk')
    expect(window.localStorage.getItem(QUALITY_STORAGE_KEY)).toBe('kiosk')
    expect(document.documentElement.dataset.stationQuality).toBe('kiosk')
  })
})
