# Production Mode Hotkey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore tototoben developer `App` as the default shell and open the existing DevicePicker with Cmd/Ctrl+Shift+P so an operator can lock this machine to Station I, II, III, or Photobash.

**Architecture:** Pure `productionHotkey` helpers own chord / Escape / typing rules. `App` keeps `pickerOpen` in React state only. A stored `hons-device-lock` still boots the locked surface; unlock returns to developer chrome on the leftover hash. No new network.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Vitest 4, jsdom `createRoot` runtime tests. No new dependencies.

## Global Constraints

- Developer shell is default. Empty hash still becomes `#/orb`.
- Entry chord: `Cmd+Shift+P` (macOS) / `Ctrl+Shift+P` (Windows / Linux). Match `event.code === 'KeyP'` with `shiftKey` and (`metaKey` or `ctrlKey`). Call `preventDefault` and `stopPropagation`. Ignore `event.repeat`.
- Ignore the chord, Escape-as-dismiss, and unlock `~` while focus is an `INPUT` or `TEXTAREA`.
- `pickerOpen` is React state on this window only. It is not written to `localStorage` or `sessionStorage`.
- Stored lock remains `hons-device-lock` with values `station-1` | `station-2` | `station-3` | `photobash`.
- Unlock (`~` or 2s bottom-left corner hold) clears the lock and `pickerOpen`, and does not change the hash.
- Same machine only. No new BroadcastChannel, MQTT, firehose event, or query-string boot flag.
- Do not add dependencies.
- Execute in worktree `/Users/martin/ars-electronica/.worktrees/merge-production-into-main` on branch `merge-production-into-main`.
- Do not stage unrelated dirty files (`wallCollageBank*`, forming-prelude overlay except `App.tsx` when Task 2 rewrites it).
- Do not push.

## File structure

- Create: `orb-platform/src/lib/productionHotkey.ts` — chord / dismiss / typing helpers.
- Create: `orb-platform/src/lib/productionHotkey.test.ts` — unit tests for those helpers.
- Create: `orb-platform/src/App.runtime.test.tsx` — boot gate, hotkey, Escape, lock, unlock, typing guard.
- Modify: `orb-platform/src/App.tsx` — tototoben developer shell plus picker overlay.
- Modify: `orb-platform/src/components/stationComposition.test.ts` — expect switcher + overlay together.
- Unchanged: `deviceLock.ts`, `DevicePicker`, `DeviceUnlockLayer`, Photobash vs Station III split.

---

### Task 1: Production hotkey helpers

**Files:**
- Create: `orb-platform/src/lib/productionHotkey.ts`
- Create: `orb-platform/src/lib/productionHotkey.test.ts`

**Interfaces:**
- Consumes: none.
- Produces: `isTypingTarget(target: EventTarget | null): boolean`, `isProductionHotkey(event: Pick<KeyboardEvent, 'code' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'repeat'>): boolean`, `isPickerDismissKey(event: Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'repeat'>): boolean`.

- [ ] **Step 1: Write the failing test**

Create `orb-platform/src/lib/productionHotkey.test.ts`:

```ts
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isPickerDismissKey, isProductionHotkey, isTypingTarget } from './productionHotkey'

function chord(overrides: Partial<KeyboardEvent> = {}): Pick<
  KeyboardEvent,
  'code' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'repeat' | 'key'
> {
  return {
    code: 'KeyP',
    key: 'p',
    shiftKey: true,
    metaKey: true,
    ctrlKey: false,
    repeat: false,
    ...overrides,
  }
}

describe('productionHotkey', () => {
  beforeEach(() => {
    document.body.tabIndex = -1
    document.body.focus()
  })

  afterEach(() => {
    document.querySelectorAll('input, textarea').forEach((node) => node.remove())
  })

  it('treats input and textarea as typing targets', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true)
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true)
    expect(isTypingTarget(document.createElement('div'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })

  it('matches Cmd+Shift+P and Ctrl+Shift+P only', () => {
    expect(isProductionHotkey(chord())).toBe(true)
    expect(isProductionHotkey(chord({ metaKey: false, ctrlKey: true }))).toBe(true)
    expect(isProductionHotkey(chord({ metaKey: false, ctrlKey: false }))).toBe(false)
    expect(isProductionHotkey(chord({ shiftKey: false }))).toBe(false)
    expect(isProductionHotkey(chord({ code: 'KeyP', shiftKey: false, metaKey: true }))).toBe(false)
    expect(isProductionHotkey(chord({ metaKey: true, shiftKey: false }))).toBe(false)
    expect(isProductionHotkey(chord({ code: 'KeyO' }))).toBe(false)
  })

  it('ignores key repeat', () => {
    expect(isProductionHotkey(chord({ repeat: true }))).toBe(false)
    expect(isPickerDismissKey(chord({ key: 'Escape', repeat: true }))).toBe(false)
  })

  it('ignores the chord and Escape while an input or textarea is focused', () => {
    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    expect(isProductionHotkey(chord())).toBe(false)
    expect(isPickerDismissKey({ ...chord(), key: 'Escape' })).toBe(false)
    input.remove()

    const textarea = document.createElement('textarea')
    document.body.append(textarea)
    textarea.focus()
    expect(isProductionHotkey(chord({ metaKey: false, ctrlKey: true }))).toBe(false)
    textarea.remove()
  })

  it('treats Escape and the production chord as dismiss keys when not typing', () => {
    expect(isPickerDismissKey({ ...chord(), key: 'Escape', code: 'Escape', shiftKey: false, metaKey: false })).toBe(
      true,
    )
    expect(isPickerDismissKey(chord())).toBe(true)
    expect(isPickerDismissKey({ ...chord(), key: 'Enter', code: 'Enter', shiftKey: false, metaKey: false })).toBe(
      false,
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from `orb-platform`:

```bash
npm test -- src/lib/productionHotkey.test.ts
```

Expected: FAIL because `./productionHotkey` is missing.

- [ ] **Step 3: Write minimal implementation**

Create `orb-platform/src/lib/productionHotkey.ts`:

```ts
export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
  )
}

function isTyping(): boolean {
  return typeof document !== 'undefined' && isTypingTarget(document.activeElement)
}

export function isProductionHotkey(
  event: Pick<KeyboardEvent, 'code' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'repeat'>,
): boolean {
  if (event.repeat) return false
  if (isTyping()) return false
  if (event.code !== 'KeyP' || !event.shiftKey) return false
  return event.metaKey || event.ctrlKey
}

export function isPickerDismissKey(
  event: Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'repeat'>,
): boolean {
  if (event.repeat) return false
  if (isTyping()) return false
  if (event.key === 'Escape') return true
  return isProductionHotkey(event)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/productionHotkey.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add orb-platform/src/lib/productionHotkey.ts orb-platform/src/lib/productionHotkey.test.ts
git commit -m "feat: match Cmd/Ctrl+Shift+P production picker chord"
```

---

### Task 2: Developer App plus picker overlay

**Files:**
- Create: `orb-platform/src/App.runtime.test.tsx`
- Modify: `orb-platform/src/App.tsx` (replace the production-only boot picker with tototoben routing + overlay)

**Interfaces:**
- Consumes: `isProductionHotkey`, `isPickerDismissKey` from Task 1; existing `readDeviceLock`, `writeDeviceLock`, `clearDeviceLock`, `lockHref`, `lockToStation`, `STORAGE_KEY`, `DevicePicker`, `DeviceUnlockLayer`.
- Produces: `pickerOpen` React state; window `keydown` order (dismiss if `pickerOpen && isPickerDismissKey`, else open if `isProductionHotkey`); render order: picker if `pickerOpen`, else wall-sim, else locked wallRole → PhotobashScreen, else locked surface, else developer routes including `#/photobash`.

- [ ] **Step 1: Write the failing test**

Create `orb-platform/src/App.runtime.test.tsx`. Mock heavy stations so jsdom never loads R3F:

```ts
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
vi.mock('./components/AvatarStation', () => ({ AvatarStation: () => null }))
vi.mock('./components/WallFaceAlignTool', () => ({ WallFaceAlignTool: () => null }))
vi.mock('./components/WallCalibrate', () => ({ WallCalibrate: () => null }))
vi.mock('./components/WallSim', () => ({ WallSim: () => <div data-testid="wall-sim" /> }))
vi.mock('./components/ThirdStationWall', () => ({ ThirdStationWall: () => null }))
vi.mock('./dev/DevPanel', () => ({ DevPanel: () => null }))
vi.mock('./dev/LevaRoot', () => ({ LevaRoot: () => null }))

import App from './App'
import { STORAGE_KEY } from './lib/deviceLock'

function chordEvent(overrides: KeyboardEventInit = {}) {
  return new KeyboardEvent('keydown', {
    key: 'p',
    code: 'KeyP',
    shiftKey: true,
    metaKey: true,
    ctrlKey: false,
    bubbles: true,
    cancelable: true,
    ...overrides,
  })
}

describe('App production overlay', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    window.localStorage.removeItem(STORAGE_KEY)
    window.location.hash = '#/orb'
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    window.localStorage.removeItem(STORAGE_KEY)
    window.location.hash = ''
    document.querySelectorAll('input').forEach((node) => node.remove())
  })

  async function renderApp() {
    await act(async () => {
      root.render(<App />)
      await Promise.resolve()
    })
  }

  it('shows the station switcher on #/orb, not the device picker', async () => {
    await renderApp()
    expect(container.querySelector('.station-switcher')).not.toBeNull()
    expect(container.querySelector('[aria-label="Production lock"]')).toBeNull()
  })

  it('opens the picker on Cmd+Shift+P and hides the switcher', async () => {
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

  it('dismisses the picker on Escape without writing a lock', async () => {
    await renderApp()
    await act(async () => {
      window.dispatchEvent(chordEvent())
      await Promise.resolve()
    })
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))
      await Promise.resolve()
    })
    expect(container.querySelector('.station-switcher')).not.toBeNull()
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

  it('boots a stored lock without picker or switcher', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'station-1')
    await renderApp()
    expect(container.querySelector('.station-switcher')).toBeNull()
    expect(container.querySelector('[aria-label="Production lock"]')).toBeNull()
    expect(container.querySelector('[data-testid="station-one"]')).not.toBeNull()
    expect(container.querySelector('[data-unlock-corner]')).not.toBeNull()
  })

  it('restores the switcher on tilde and keeps #/station-1', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'station-1')
    window.location.hash = '#/station-1'
    await renderApp()
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '~', bubbles: true }))
      await Promise.resolve()
    })
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(window.location.hash).toBe('#/station-1')
    expect(container.querySelector('.station-switcher')).not.toBeNull()
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

  it('does not open the picker when an input is focused', async () => {
    await renderApp()
    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    await act(async () => {
      window.dispatchEvent(chordEvent())
      await Promise.resolve()
    })
    expect(container.querySelector('[aria-label="Production lock"]')).toBeNull()
    expect(container.querySelector('.station-switcher')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from `orb-platform`:

```bash
npm test -- src/App.runtime.test.tsx
```

Expected: FAIL. Current `App.tsx` boots `DevicePicker` with no `.station-switcher`.

- [ ] **Step 3: Write minimal implementation**

Replace `orb-platform/src/App.tsx` with this file (tototoben developer shell + production overlay). Do not drop `#/photobash` or the wallRole-while-locked Photobash bypass.

```tsx
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { DevicePicker } from './components/DevicePicker'
import { DeviceUnlockLayer } from './components/DeviceUnlockLayer'
import { MirrorPreviewFrame } from './components/MirrorPreviewToggle'
import { WallModeViewport } from './components/WallModeViewport'
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
import { isPickerDismissKey, isProductionHotkey } from './lib/productionHotkey'
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

export default function App() {
  const [lock, setLock] = useState<DeviceLock | null>(() => readDeviceLock())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [station, setStation] = useState<StationRoute>(() =>
    getStationFromHash(window.location.hash),
  )
  const [quality] = useState(() => getDeviceQuality())
  const [wallCropMode] = useState(() => isWallMode())
  const [wallRole] = useState(() => parseWallRole())
  const lockedStation = lock ? lockToStation(lock) : null
  const isWallSim = station === 'wall-sim'
  const isWallPanel = wallRole !== null
  const hideChrome =
    Boolean(lock) ||
    pickerOpen ||
    wallCropMode ||
    isWallRoleMode() ||
    station === 'wall-sim' ||
    station === 'wall-cal'
  const showMainNav = !hideChrome

  const applyLock = useCallback((next: DeviceLock) => {
    writeDeviceLock(next)
    setLock(next)
    setPickerOpen(false)
    const href = lockHref(next)
    window.history.replaceState(null, '', href)
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
    const onHashChange = () => setStation(getStationFromHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (lock) return
    if (!window.location.hash) {
      window.history.replaceState(null, '', getStationHref('orb'))
      setStation('orb')
    }
  }, [lock])

  useEffect(() => {
    if (!lock || isWallSim || isWallPanel) return
    const href = lockHref(lock)
    if (window.location.hash !== href) {
      window.history.replaceState(null, '', href)
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
      {lock && !isWallSim && !isWallPanel ? <DeviceUnlockLayer onUnlock={unlock} /> : null}
      {import.meta.env.DEV && !hideChrome ? (
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
          <a href={getStationHref('wall-sim')}>Wall sim</a>
        </nav>
      ) : null}
      <Suspense fallback={null}>
        {pickerOpen ? (
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
        ) : (
          <AvatarStation />
        )}
      </Suspense>
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/App.runtime.test.tsx src/lib/productionHotkey.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add orb-platform/src/App.tsx orb-platform/src/App.runtime.test.tsx
git commit -m "feat: open production picker from developer main via hotkey"
```

---

### Task 3: Composition assertions

**Files:**
- Modify: `orb-platform/src/components/stationComposition.test.ts`

**Interfaces:**
- Consumes: Task 2 `App.tsx` source containing `station-switcher`, `ThirdStationWall`, `DevicePicker`, `DeviceUnlockLayer`, `PhotobashScreen`, `isProductionHotkey`.
- Produces: updated composition test; Photobash source checks unchanged.

- [ ] **Step 1: Write the failing assertion change**

Replace the first `it('boots a device picker and photobash route instead of the station-switcher')` block with:

```ts
  it('keeps developer station-switcher and overlays the production picker', () => {
    expect(appSource).toContain('station-switcher')
    expect(appSource).toContain('ThirdStationWall')
    expect(appSource).toContain('DevicePicker')
    expect(appSource).toContain('DeviceUnlockLayer')
    expect(appSource).toContain('PhotobashScreen')
    expect(appSource).toContain('isProductionHotkey')
    expect(appSource).toContain("station === 'photobash'")
  })
```

Keep `it('keeps Station III as the kiosk ThirdStation only')` as:

```ts
  it('keeps Station III as the kiosk ThirdStation only', () => {
    expect(appSource).toContain('<ThirdStation />')
    expect(appSource).not.toContain('WallCollageBlanket')
  })
```

Leave the Photobash collage-only test and the rest of the file unchanged.

- [ ] **Step 2: Run test to verify it fails if App was not updated**

If Task 2 is done, this step should already PASS. If App still lacks `station-switcher`, Expected: FAIL on `toContain('station-switcher')`.

Run: `npm test -- src/components/stationComposition.test.ts`

- [ ] **Step 3: No extra implementation**

Task 2 is the implementation. If the composition test fails, fix `App.tsx` until the strings above exist. Do not put `WallCollageBlanket` in `App.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/stationComposition.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add orb-platform/src/components/stationComposition.test.ts
git commit -m "test: expect developer chrome with production picker overlay"
```

---

### Task 4: Full suite and typecheck

**Files:** none new.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: green `npm test` (except the pre-existing `useMirrorCamera` permission-timeout fail on tototoben main) and clean `tsc --noEmit`.

- [ ] **Step 1: Run the unit/runtime suite**

From `orb-platform`:

```bash
npm test
```

Expected: all files PASS except possibly `src/hooks/useMirrorCamera.runtime.test.tsx` (`expected 'starting' to be 'unavailable'`), which failed on tototoben `origin/main` before this work. Do not “fix” that camera test as part of this plan.

- [ ] **Step 2: Run TypeScript**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Browser check**

From `orb-platform`: `npm run dev` (http://localhost:5176). Confirm:

1. Station switcher visible on `/orb/`.
2. Cmd+Shift+P opens DevicePicker; switcher gone.
3. Escape returns switcher; no lock in Application → Local Storage → `hons-device-lock`.
4. Chord again → Station I → locked Station I; refresh stays locked; `~` restores switcher on `#/station-1`.

- [ ] **Step 4: Commit only if Step 1–2 required a fix**

If a type or test fix was needed, commit that fix alone. If already green, no commit.
