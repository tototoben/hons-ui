// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./components/OrbStation', () => ({ OrbStation: () => <div data-testid="orb-station" /> }))
vi.mock('./components/StationOne', () => ({ StationOne: () => <div data-testid="station-one" /> }))
vi.mock('./components/StationTwo', () => ({ StationTwo: () => <div data-testid="station-two" /> }))
vi.mock('./components/ThirdStation', () => ({ ThirdStation: () => <div data-testid="third-station" /> }))
vi.mock('./components/PhotobashScreen', () => ({ PhotobashScreen: () => <div data-testid="photobash" /> }))
vi.mock('./components/SecondStation', () => ({ SecondStation: () => null }))
vi.mock('./components/WallFaceAlignTool', () => ({ WallFaceAlignTool: () => null }))
vi.mock('./components/WallCalibrate', () => ({ WallCalibrate: () => null }))
vi.mock('./components/WallSim', () => ({ WallSim: () => <div data-testid="wall-sim" /> }))
vi.mock('./components/StationSim', () => ({ StationSim: () => <div data-testid="station-sim" /> }))
vi.mock('./components/ThirdStationWall', () => ({ ThirdStationWall: () => null }))
vi.mock('./lib/ipadSimLink', () => ({ connectIpadSimLink: vi.fn(() => () => {}) }))
vi.mock('./dev/DevPanel', () => ({ DevPanel: () => null }))
vi.mock('./dev/LevaRoot', () => ({ LevaRoot: () => null }))

import App from './App'
import { connectIpadSimLink } from './lib/ipadSimLink'
import { STORAGE_KEY } from './lib/deviceLock'
import { QUALITY_STORAGE_KEY, applyDeviceQuality } from './lib/deviceQuality'
import {
  STATION_ONE_STORAGE_KEY,
  STATION_TWO_STORAGE_KEY,
  saveStationOneState,
  saveStationTwoState,
} from './lib/interviewStore'
import { createStationOneState, createStationTwoState } from './lib/mirrorJourney'
import * as firehose from './lib/firehose'

function chordEvent(overrides: KeyboardEventInit = {}) {
  return new KeyboardEvent('keydown', {
    key: 'p',
    code: 'KeyP',
    shiftKey: true,
    altKey: true,
    metaKey: false,
    ctrlKey: false,
    bubbles: true,
    cancelable: true,
    ...overrides,
  })
}

function restartChord() {
  return chordEvent({ key: 'r', code: 'KeyR' })
}

describe('App production overlay', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    vi.mocked(connectIpadSimLink).mockClear()
    applyDeviceQuality('full')
    window.localStorage.removeItem(STORAGE_KEY)
    window.localStorage.removeItem(QUALITY_STORAGE_KEY)
    window.location.hash = '#/orb'
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    window.localStorage.removeItem(STORAGE_KEY)
    window.localStorage.removeItem(QUALITY_STORAGE_KEY)
    window.localStorage.removeItem(STATION_ONE_STORAGE_KEY)
    window.localStorage.removeItem(STATION_TWO_STORAGE_KEY)
    applyDeviceQuality('full')
    window.history.replaceState(null, '', '/')
    window.location.hash = ''
    document.querySelectorAll('input').forEach((node) => node.remove())
  })

  async function renderApp() {
    await act(async () => {
      root.render(<App />)
      await Promise.resolve()
    })
  }

  it.each(['#/wall-sim', '#/station-sim', '#/photobash'])(
    'does not consume remote-key streaming connections on %s', async (hash) => {
      window.location.hash = hash
      await renderApp()
      expect(connectIpadSimLink).not.toHaveBeenCalled()
    },
  )

  it('keeps the unlocked experience free of station-switcher chrome', async () => {
    await renderApp()
    expect(container.querySelector('.station-switcher')).toBeNull()
    expect(container.querySelector('[aria-label="Production lock"]')).toBeNull()
  })

  it('opens the production picker on an empty hash instead of the orb', async () => {
    window.location.hash = ''
    await renderApp()
    expect(container.querySelector('[aria-label="Production lock"]')).not.toBeNull()
    expect(container.querySelector('.station-switcher')).toBeNull()
    expect(container.querySelector('[data-testid="orb-station"]')).toBeNull()
  })

  it('letterboxes unlocked Station III without station-switcher chrome', async () => {
    window.location.hash = '#/mirror'
    await renderApp()
    expect(container.querySelector('[data-testid="third-station"]')).not.toBeNull()
    expect(container.querySelector('.experience-mirror-preview-portrait')).not.toBeNull()
    expect(container.querySelector('.station-switcher')).toBeNull()
  })

  it('opens the picker on kiosk quality instead of mounting the orb', async () => {
    applyDeviceQuality('kiosk')
    await renderApp()
    expect(container.querySelector('[aria-label="Production lock"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="orb-station"]')).toBeNull()
    expect(container.querySelector('.station-switcher')).toBeNull()
  })

  it('opens the picker on Alt+Shift+P and hides the switcher', async () => {
    await renderApp()
    const event = chordEvent()
    const prevent = vi.spyOn(event, 'preventDefault')
    await act(async () => {
      window.dispatchEvent(event)
      await Promise.resolve()
    })
    expect(prevent).toHaveBeenCalled()
    expect(container.querySelector('[aria-label="Production lock"]')).not.toBeNull()
    expect(container.querySelector('.station-switcher')).toBeNull()
  })

  it('dismisses the picker on Escape without writing a lock or restoring station chrome', async () => {
    await renderApp()
    await act(async () => {
      window.dispatchEvent(chordEvent())
      await Promise.resolve()
    })
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))
      await Promise.resolve()
    })
    expect(container.querySelector('.station-switcher')).toBeNull()
    expect(container.querySelector('[aria-label="Production lock"]')).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('locks Station I from the picker and hides the switcher', async () => {
    await renderApp()
    await act(async () => {
      window.dispatchEvent(chordEvent())
      await Promise.resolve()
    })
    const stationI = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Station I')
    await act(async () => {
      stationI!.click()
      await Promise.resolve()
    })
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('station-1')
    expect(window.location.hash).toBe('#/station-1')
    expect(container.querySelector('.station-switcher')).toBeNull()
    expect(container.querySelector('[aria-label="Production lock"]')).toBeNull()
    expect(container.querySelector('[data-testid="station-one"]')).not.toBeNull()
    expect(container.querySelector('[data-unlock-corner]')).not.toBeNull()
  })

  it('clears a finished Station I visit when locking Station I from the picker', async () => {
    saveStationOneState(createStationOneState({ phase: 'proceed', questionIndex: 10 }))
    await renderApp()
    await act(async () => {
      window.dispatchEvent(chordEvent())
      await Promise.resolve()
    })
    const stationI = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Station I')
    await act(async () => {
      stationI!.click()
      await Promise.resolve()
    })
    expect(window.localStorage.getItem(STATION_ONE_STORAGE_KEY)).toBeNull()
  })

  it('boots a stored lock without picker or switcher', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'station-1')
    await renderApp()
    expect(container.querySelector('.station-switcher')).toBeNull()
    expect(container.querySelector('[aria-label="Production lock"]')).toBeNull()
    expect(container.querySelector('[data-testid="station-one"]')).not.toBeNull()
    expect(container.querySelector('[data-unlock-corner]')).not.toBeNull()
  })

  it('restores the unlocked Station I view on tilde and keeps #/station-1', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'station-1')
    window.location.hash = '#/station-1'
    await renderApp()
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '~', bubbles: true }))
      await Promise.resolve()
    })
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(window.location.hash).toBe('#/station-1')
    expect(container.querySelector('.station-switcher')).toBeNull()
    expect(container.querySelector('[data-testid="station-one"]')).not.toBeNull()
  })

  it('re-opens the picker while locked and a second chord keeps the lock', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'station-1')
    window.location.hash = '#/station-1'
    await renderApp()
    await act(async () => {
      window.dispatchEvent(chordEvent())
      await Promise.resolve()
    })
    expect(container.querySelector('[aria-label="Production lock"]')).not.toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('station-1')
    await act(async () => {
      window.dispatchEvent(chordEvent())
      await Promise.resolve()
    })
    expect(container.querySelector('[aria-label="Production lock"]')).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('station-1')
    expect(container.querySelector('[data-testid="station-one"]')).not.toBeNull()
  })

  it('shows unlock corner on wall-sim with a stored lock and tilde clears it', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'station-1')
    window.location.hash = '#/wall-sim'
    await renderApp()
    expect(container.querySelector('[data-testid="wall-sim"]')).not.toBeNull()
    expect(container.querySelector('[data-unlock-corner]')).not.toBeNull()
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '~', bubbles: true }))
      await Promise.resolve()
    })
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(container.querySelector('[data-unlock-corner]')).toBeNull()
    expect(container.querySelector('[data-testid="wall-sim"]')).not.toBeNull()
  })

  it('mounts the station monitor simulator and hides the switcher', async () => {
    window.location.hash = '#/station-sim'
    await renderApp()
    expect(container.querySelector('[data-testid="station-sim"]')).not.toBeNull()
    expect(container.querySelector('.station-switcher')).toBeNull()
  })

  it('does not rewrite a station-sim iframe hash when Station I is locked', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'station-1')
    window.history.replaceState(null, '', '/?stationSimFrame=1#/station-2')
    await renderApp()
    expect(container.querySelector('[data-testid="station-two"]')).not.toBeNull()
    expect(window.location.hash).toBe('#/station-2')
  })

  it('opens the picker on Cmd+Shift+P', async () => {
    await renderApp()
    await act(async () => {
      window.dispatchEvent(chordEvent({ altKey: false, metaKey: true }))
      await Promise.resolve()
    })
    expect(container.querySelector('[aria-label="Production lock"]')).not.toBeNull()
  })

  it('does not open the picker on Ctrl+Shift+P', async () => {
    await renderApp()
    await act(async () => {
      window.dispatchEvent(chordEvent({ altKey: false, ctrlKey: true }))
      await Promise.resolve()
    })
    expect(container.querySelector('[aria-label="Production lock"]')).toBeNull()
    expect(container.querySelector('.station-switcher')).toBeNull()
  })

  it('opens the picker while an input is focused', async () => {
    await renderApp()
    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    await act(async () => {
      window.dispatchEvent(chordEvent())
      await Promise.resolve()
    })
    expect(container.querySelector('[aria-label="Production lock"]')).not.toBeNull()
    expect(container.querySelector('.station-switcher')).toBeNull()
  })

  it('restarts a locked Station II from the first question and wipes its answers', async () => {
    const publish = vi.spyOn(firehose, 'publish')
    saveStationTwoState(
      createStationTwoState({
        phase: 'question',
        questionIndex: 4,
        answers: { attractiveness: 'yes' },
      }),
    )
    window.localStorage.setItem(STORAGE_KEY, 'station-2')
    window.location.hash = '#/station-2'
    await renderApp()
    expect(window.localStorage.getItem(STATION_TWO_STORAGE_KEY)).toContain('attractiveness')
    publish.mockClear()
    await act(async () => {
      window.dispatchEvent(restartChord())
      await Promise.resolve()
    })
    expect(window.localStorage.getItem(STATION_TWO_STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('station-2')
    expect(container.querySelector('[data-testid="station-two"]')).not.toBeNull()
    expect(publish).toHaveBeenCalledWith(
      'station-2',
      'keyboard_focus',
      expect.objectContaining({ mode: 'hidden' }),
    )
    publish.mockRestore()
  })

  it('shows the iPad letter keyboard when the production picker opens over a locked station', async () => {
    const publish = vi.spyOn(firehose, 'publish')
    window.localStorage.setItem(STORAGE_KEY, 'station-2')
    window.location.hash = '#/station-2'
    await renderApp()
    publish.mockClear()
    await act(async () => {
      window.dispatchEvent(chordEvent())
      await Promise.resolve()
    })
    expect(container.querySelector('[aria-label="Production lock"]')).not.toBeNull()
    expect(publish).toHaveBeenCalledWith(
      'station-2',
      'keyboard_focus',
      expect.objectContaining({ mode: 'text' }),
    )
    const focus = vi.mocked(publish).mock.calls.find(
      (call) => call[1] === 'keyboard_focus',
    )?.[2] as { prompt?: string }
    expect(focus?.prompt).toBeUndefined()
    publish.mockRestore()
  })

  it('locks Station II from the picker on the 2 key', async () => {
    await renderApp()
    await act(async () => {
      window.dispatchEvent(chordEvent())
      await Promise.resolve()
    })
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', code: 'Digit2', bubbles: true, cancelable: true }))
      await Promise.resolve()
    })
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('station-2')
    expect(window.location.hash).toBe('#/station-2')
    expect(container.querySelector('[aria-label="Production lock"]')).toBeNull()
    expect(container.querySelector('[data-testid="station-two"]')).not.toBeNull()
  })

  it('locks Station I from an already-locked kiosk when 1 is pressed in the picker', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'station-2')
    window.location.hash = '#/station-2'
    await renderApp()
    await act(async () => {
      window.dispatchEvent(chordEvent())
      await Promise.resolve()
    })
    expect(container.querySelector('[aria-label="Production lock"]')).not.toBeNull()
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', code: 'Digit1', bubbles: true, cancelable: true }))
      await Promise.resolve()
    })
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('station-1')
    expect(window.location.hash).toBe('#/station-1')
    expect(container.querySelector('[aria-label="Production lock"]')).toBeNull()
    expect(container.querySelector('[data-testid="station-one"]')).not.toBeNull()
  })
})
