# Production Device Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent boot picker that locks each machine to Station I, II, III, or the Photobash wall reveal, with no leftover station pills.

**Architecture:** A small `deviceLock` module owns storage and picker/href rules. `App` boots the picker when unlocked and forces the locked route when set. Photobash is a new hash route that only mounts the collage loop; `#/mirror` is kiosk Station III only.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Vitest 4, existing `BroadcastChannel` wall sync. No new dependencies.

## Global Constraints

- Lock storage key is `hons-device-lock`.
- Lock values are only `station-1`, `station-2`, `station-3`, `photobash`.
- Picker labels are `Station I`, `Station II`, `Station III`, `Photobash`.
- Kiosk quality omits Photobash from the picker.
- Unlock hold is 2000ms on a 64px bottom-left target; keyboard unlock is tilde `~`.
- `#/mirror` is Station III kiosk only; `#/photobash` is collage-only.
- Station III must not mount wall collage; Photobash must not mount Debra/code/recording wall chrome.
- Do not add dependencies.
- Do not commit, stage, or push without explicit authorization.
- Do not stage unrelated dirty files (`AvatarStation*`, `VisitorScanViewer*`, `hons-avatar` assets).

---

### Task 1: Device lock module

**Files:**
- Create: `orb-platform/src/lib/deviceLock.ts`
- Create: `orb-platform/src/lib/deviceLock.test.ts`

**Interfaces:**
- Produces `DeviceLock`, `DEVICE_LOCKS`, `STORAGE_KEY` (`hons-device-lock`), `UNLOCK_HOLD_MS` (`2000`), `UNLOCK_CORNER_PX` (`64`), `UNLOCK_KEY` (`~`), `readDeviceLock`, `writeDeviceLock`, `clearDeviceLock`, `pickerChoices`, `lockHref`, `lockToStation`, `DEVICE_LOCK_LABELS`.

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
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
    expect(readDeviceLock({ getItem: () => { throw new Error('blocked') } })).toBeNull()
  })

  it('persists a valid lock and can clear it', () => {
    const store = new Map<string, string>()
    writeDeviceLock('station-1', {
      setItem: (key, value) => store.set(key, value),
    })
    expect(store.get('hons-device-lock')).toBe('station-1')
    expect(readDeviceLock({ getItem: (key) => store.get(key) ?? null })).toBe('station-1')
    clearDeviceLock({ removeItem: (key) => store.delete(key) })
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/deviceLock.test.ts` from `orb-platform`  
Expected: FAIL because `./deviceLock` is missing.

- [ ] **Step 3: Write minimal implementation**

Implement `deviceLock.ts` with injectable storage (same try/catch pattern as `stationVibe.ts`). `writeDeviceLock` / `clearDeviceLock` swallow storage throws. `lockToStation('station-1')` and `'station-2'` return themselves.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/deviceLock.test.ts`  
Expected: PASS.

---

### Task 2: Photobash route

**Files:**
- Modify: `orb-platform/src/lib/stationRoute.ts`
- Modify: `orb-platform/src/lib/stationRoute.test.ts`

**Interfaces:**
- Extends `StationRoute` with `'photobash'`.
- `getStationFromHash('#/photobash')` returns `'photobash'`.
- `getStationHref('photobash')` returns `'#/photobash'`.
- `#/mirror` still returns `'mirror'`.

- [ ] **Step 1: Write the failing assertions** in `stationRoute.test.ts`:

```ts
  it('resolves the photobash reveal hash', () => {
    expect(getStationFromHash('#/photobash')).toBe('photobash')
  })

  it('builds a photobash hash link', () => {
    expect(getStationHref('photobash')).toBe('#/photobash')
  })
```

Keep the existing `#/mirror` assertions.

- [ ] **Step 2: Run** `npm test -- src/lib/stationRoute.test.ts`  
Expected: FAIL on `'photobash'`.

- [ ] **Step 3: Add `'photobash'` to `StationRoute` and hash parse/build.**

- [ ] **Step 4: Re-run** `npm test -- src/lib/stationRoute.test.ts`  
Expected: PASS.

---

### Task 3: Photobash loop helper and trigger stub

**Files:**
- Create: `orb-platform/src/lib/photobashLoop.ts`
- Create: `orb-platform/src/lib/photobashLoop.test.ts`
- Create: `orb-platform/src/lib/photobashTrigger.ts`
- Create: `orb-platform/src/lib/photobashTrigger.test.ts`
- Modify: `orb-platform/src/lib/wallPhaseSync.ts` (add `usePhotobashLoop`)

**Interfaces:**
- Produces `PHOTOBASH_CYCLE_MS` equal to `WALL_TIMING.loadingSeconds * 1000`, `PHOTOBASH_FILL_MS` (`4000`), `mintPhotobashSeed()`, `photobashProgress(elapsedMs, fillMs?)`.
- Produces `notifyRevealReady(): void` no-op.
- Produces `usePhotobashLoop(isConductor: boolean)` returning `{ photobashSeed: number, loadingProgress: number }`. Conductor publishes `{ type: 'phase', phase: 'loading', photobashSeed, loadingProgress }` on existing channel `hons-station3-wall-phase` and loops a new seed every `PHOTOBASH_CYCLE_MS`. Listeners only apply messages when `!isConductor`.

- [ ] **Step 1: Write failing tests**

`photobashLoop.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { WALL_TIMING } from './wallPhaseSync'
import { PHOTOBASH_CYCLE_MS, PHOTOBASH_FILL_MS, mintPhotobashSeed, photobashProgress } from './photobashLoop'

describe('photobashLoop', () => {
  it('uses the wall loading duration as the cycle', () => {
    expect(PHOTOBASH_CYCLE_MS).toBe(WALL_TIMING.loadingSeconds * 1000)
    expect(PHOTOBASH_FILL_MS).toBe(4000)
  })

  it('mints a non-negative integer seed from the random source', () => {
    expect(mintPhotobashSeed(() => 0.42)).toBe((0.42 * 1_000_000_000) | 0)
  })

  it('fills progress over four seconds then holds at 1', () => {
    expect(photobashProgress(0)).toBe(0)
    expect(photobashProgress(2000)).toBe(0.5)
    expect(photobashProgress(4000)).toBe(1)
    expect(photobashProgress(20000)).toBe(1)
  })
})
```

`photobashTrigger.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { notifyRevealReady } from './photobashTrigger'

describe('notifyRevealReady', () => {
  it('is a callable no-op for the later kiosk-to-wall handoff', () => {
    expect(notifyRevealReady()).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run** `npm test -- src/lib/photobashLoop.test.ts src/lib/photobashTrigger.test.ts`  
Expected: FAIL missing modules.

- [ ] **Step 3: Implement helpers, no-op trigger, and `usePhotobashLoop` in `wallPhaseSync.ts`.** Reuse the existing `BroadcastChannel` name. Do not run intro/prompt/recording timers in this hook.

- [ ] **Step 4: Re-run the focused tests.**  
Expected: PASS.

---

### Task 4: Picker, unlock layer, Photobash screen

**Files:**
- Create: `orb-platform/src/components/DevicePicker.tsx`
- Create: `orb-platform/src/components/DevicePicker.css`
- Create: `orb-platform/src/components/DevicePicker.runtime.test.tsx`
- Create: `orb-platform/src/components/DeviceUnlockLayer.tsx`
- Create: `orb-platform/src/components/DeviceUnlockLayer.runtime.test.tsx`
- Create: `orb-platform/src/components/PhotobashScreen.tsx`

**Interfaces:**
- `DevicePicker` props: `{ quality: DeviceQuality; onLock: (lock: DeviceLock) => void }`.
- `DeviceUnlockLayer` calls `onUnlock` after hold or tilde.
- `PhotobashScreen` reads `parseWallRole()`, mounts collage (or face blanket if `collage=0`), never renders `WallRoleContent` / Debra / code HUD. Conductor is `role === 'debra' || role === null`. Default crop role when null is `'copy'`.

- [ ] **Step 1: Write failing runtime tests**

Picker: render with `quality="full"`, expect four buttons with those labels; `quality="kiosk"` has three and no Photobash; clicking Station I calls `onLock('station-1')`.

Unlock: render, dispatch `pointerdown` on `[data-unlock-corner]`, advance 1999ms, expect no unlock; advance 1ms more, expect unlock. Dispatch `keydown` with key `~`, expect unlock. Dispatch tilde while an input is focused, expect no unlock.

- [ ] **Step 2: Run the runtime tests.**  
Expected: FAIL missing components.

- [ ] **Step 3: Implement picker (full-viewport column of buttons), invisible unlock corner (`position:fixed; left:0; bottom:0; width/height: UNLOCK_CORNER_PX; opacity:0; z-index:400`), and PhotobashScreen using `usePhotobashLoop` + `WallCollageBlanket` / `WallFaceBlanket`.**

- [ ] **Step 4: Re-run the runtime tests.**  
Expected: PASS.

---

### Task 5: App boot, hide chrome, split routes

**Files:**
- Modify: `orb-platform/src/App.tsx`
- Modify: `orb-platform/src/components/stationComposition.test.ts`
- Modify: `orb-platform/src/index.css` (optional picker-related globals only if needed)

**Interfaces:**
- Unlocked → `DevicePicker`. Locked → locked station only + `DeviceUnlockLayer`.
- No `.station-switcher`. No Leva while picker or locked.
- Empty hash is not rewritten to `#/orb`. Locked hash is rewritten to `lockHref(lock)`.
- `station === 'mirror'` always `<ThirdStation />` (no `ThirdStationWall`, no `WallModeViewport` wall crop of ThirdStation).
- `station === 'photobash'` → `<PhotobashScreen />`.
- Listen to `storage` for `hons-device-lock`.

- [ ] **Step 1: Write failing composition tests** in `stationComposition.test.ts`:

```ts
  it('boots a device picker and photobash route instead of the station-switcher', () => {
    expect(appSource).toContain('DevicePicker')
    expect(appSource).toContain('DeviceUnlockLayer')
    expect(appSource).toContain('PhotobashScreen')
    expect(appSource).toContain("station === 'photobash'")
    expect(appSource).not.toContain('station-switcher')
    expect(appSource).not.toContain('ThirdStationWall')
  })

  it('keeps Station III as the kiosk ThirdStation only', () => {
    expect(appSource).toContain('<ThirdStation />')
    expect(appSource).not.toContain('WallCollageBlanket')
  })
```

- [ ] **Step 2: Run** `npm test -- src/components/stationComposition.test.ts`  
Expected: FAIL (switcher still present, no PhotobashScreen).

- [ ] **Step 3: Rewrite `App.tsx` boot.** Lazy-load `PhotobashScreen`. `onLock` writes lock, `history.replaceState` to `lockHref`, sets React state. `onUnlock` clears lock. `useEffect` on lock rewrites hash. `storage` handler calls `readDeviceLock()`.

- [ ] **Step 4: Re-run composition tests and `npm test`.**  
Expected: PASS for touched files. Fix `stationComposition` assertions that still require the old switcher routes in App if they break.

---

### Task 6: Station II standalone + launch URLs

**Files:**
- Modify: `orb-platform/src/components/StationTwo.tsx`
- Modify: `orb-platform/src/components/StationTwo.runtime.test.tsx`
- Modify: `scripts/blanket-station3-wall-measured.applescript`
- Modify: `scripts/blanket-station3-wall.applescript`
- Modify: `orb-platform/src/components/WallSim.tsx`
- Modify: `orb-platform/src/lib/wallMode.test.ts` (if hash assertion must follow Photobash)

**Interfaces:**
- When `readDeviceLock()` is non-null, Station II complete phase has no `<a href="#/mirror">`. Unlocked (tests default) still show the link.
- Wall launch and WallSim iframe hashes use `#/photobash`.

- [ ] **Step 1: Add a StationTwo runtime test** that `writeDeviceLock('station-2')` then completes the journey and expects `container.querySelector('a')` to be null. Keep the existing unlocked test that expects `#/mirror`.

- [ ] **Step 2: Run** `npm test -- src/components/StationTwo.runtime.test.tsx`  
Expected: FAIL (link still present when locked).

- [ ] **Step 3: Hide the link when `readDeviceLock()` is set. Change AppleScript and WallSim `url.hash` from `#/mirror` to `#/photobash`. Update `buildWallModeUrl` test hash to `#/photobash` only if that helper is used for photobash URLs; otherwise leave the helper generic and change the test comment/hash to photobash to document the install URL.**

- [ ] **Step 4: Re-run StationTwo, wallMode, and full `npm test` plus `npm run build`.**  
Expected: PASS.

---

## Spec coverage

| Spec requirement | Task |
| --- | --- |
| Persist lock / invalid / storage throw | 1 |
| Picker choices and labels | 1, 4 |
| Unlock constants | 1, 4 |
| `#/photobash` route | 2 |
| Photobash loop + later trigger stub | 3 |
| Picker UI + unlock gestures | 4 |
| Collage-only Photobash screen | 4 |
| App boot, hide pills, hash force, storage event | 5 |
| Station III never wall collage | 5 |
| Station II continue link hidden when locked | 6 |
| Launch scripts `#/photobash` | 6 |
