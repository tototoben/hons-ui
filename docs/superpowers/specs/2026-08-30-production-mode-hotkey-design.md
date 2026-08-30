# Production Mode Hotkey — Design Specification

**Date:** 2026-08-30  
**Status:** Approved for implementation  
**Branch:** `merge-production-into-main` (tototoben `origin/main` @ `32f614b` + local `ars-production-build` as it sat, including uncommitted forming-prelude / collage-bank files)  
**Amends:** [2026-08-27 production device lock](./2026-08-27-production-device-lock-design.md) boot and unlock destination only

## Objective

Keep developer `main` as the default shell (station switcher, Orb / Cards / Avatars / Align / Wall sim / cal, Leva). Give the operator a same-machine hotkey that opens the existing production DevicePicker on **this** browser window. They pick Station I, II, III, or Photobash for this machine. Unlock returns to developer chrome, not to the picker.

This is not a LAN or visualizer trigger. Physical kiosks each have their own `localStorage`; the operator walks to each machine, hits the chord, and picks.

## Locked decisions

- Developer shell is default. Empty hash still becomes `#/orb`.
- Entry chord: `Cmd+Shift+P` (macOS) / `Ctrl+Shift+P` (Windows / Linux). Match `event.code === 'KeyP'` with `shiftKey` and (`metaKey` or `ctrlKey`). Call `preventDefault` and `stopPropagation`. Ignore `event.repeat`.
- Ignore the chord, Escape-as-dismiss, and unlock `~` while focus is an `INPUT` or `TEXTAREA` (same rule as the existing unlock layer).
- `pickerOpen` is React state on this window only. It is not written to `localStorage` or `sessionStorage`. Refresh with no stored lock returns to developer.
- Stored lock remains `hons-device-lock` with values `station-1` | `station-2` | `station-3` | `photobash`. Refresh while locked boots the locked surface and skips both picker and developer chrome.
- Unlock (`~` or 2s bottom-left corner hold) clears the lock and `pickerOpen`, and returns to the developer shell. Hash is left on the lock href so the operator lands on that route with chrome visible.
- Escape, or a second distinct (non-repeat) hotkey keydown, dismisses the picker without writing storage. If a lock was already set (re-pick), dismiss keeps that lock.
- Hotkey while locked opens the picker on top of the current lock so the operator can re-pick without `~` first. Choosing a new lock overwrites storage and hash. Dismissing without choosing leaves the old lock.
- Same machine only. No new BroadcastChannel, MQTT, firehose event, or query-string boot flag.
- Sibling Chrome windows on the same profile still follow a written lock via the existing `storage` event (one profile → one exhibit surface).
- Picker labels, kiosk-omits-Photobash, Station III vs Photobash split, unlock hold (2000ms) / corner (64px) / key (`~`), and hidden chrome while locked stay as in the 27 Aug spec.
- DevicePicker’s full-quality “Wall sim” link stays. It does not write a lock. It is an operator escape to `#/wall-sim`.

## Boot gate

`App` chooses one shell:

1. **Locked** — `readDeviceLock()` returns a valid lock. Mount that surface only. Hide station switcher, Leva, and DevPanel. Show `DeviceUnlockLayer`. Enforce `lockHref` on the hash, except `#/wall-sim` and `?wallRole=` windows (see Wall windows).
2. **Picker** — no lock, but `pickerOpen` is true. Full-screen `DevicePicker`. Hash is left unchanged until a choice is written. Switcher / Leva / DevPanel are hidden.
3. **Developer** — otherwise the tototoben `main` shell: hash routes, station switcher, Leva / DevPanel in `import.meta.env.DEV`, empty hash → `#/orb`. Also mount `#/photobash` → `PhotobashScreen` (route already on this branch).

Invalid or unreadable storage is treated as unlocked (developer), not as picker.

## Components

### `orb-platform/src/lib/productionHotkey.ts`

Pure helpers. No React. No storage. Typing checks always use `document.activeElement`, matching `DeviceUnlockLayer`.

- `isTypingTarget(target)` — true when `target` is an `HTMLElement` whose `tagName` is `INPUT` or `TEXTAREA`.
- `isProductionHotkey(event)` — true when `event.code === 'KeyP'`, `event.shiftKey`, (`event.metaKey` || `event.ctrlKey`), not `event.repeat`, and `document.activeElement` is not a typing target.
- `isPickerDismissKey(event)` — true when not typing and not repeat and either `event.key === 'Escape'` or `isProductionHotkey(event)`.

### `orb-platform/src/App.tsx`

Restored tototoben developer routing, plus production overlay:

- State: `lock` from `readDeviceLock()`, `pickerOpen` default `false`, existing hash / quality / wall flags.
- Window `keydown`, in this order: (1) if `pickerOpen && isPickerDismissKey(event)` → `preventDefault` / `stopPropagation`, set `pickerOpen` false, keep `lock`; (2) else if `isProductionHotkey(event)` → `preventDefault` / `stopPropagation`, set `pickerOpen` true. Escape in developer (`pickerOpen` false) is a no-op.
- `applyLock` writes storage, sets `lock`, clears `pickerOpen`, `replaceState` to `lockHref`.
- `unlock` clears storage, `lock`, and `pickerOpen`. Does not change the hash. If the picker was open for a re-pick, it closes too.

### Unchanged

`deviceLock.ts`, `DevicePicker`, `DeviceUnlockLayer`, Photobash vs Station III mount rules, `notifyRevealReady` no-op.

## Data flow

| Action | Result |
| --- | --- |
| Cold boot, no lock | Developer. `#/orb` if hash empty. |
| Cmd/Ctrl+Shift+P | `pickerOpen = true`. Picker fills the viewport. Hash unchanged. |
| Pick Station I | `hons-device-lock=station-1`, hash `#/station-1`, Station I, chrome hidden. |
| Refresh while locked | Locked surface immediately. No picker. No switcher. |
| `~` or corner hold | Lock and picker cleared. Developer chrome on leftover hash. |
| Escape / second chord, no lock | `pickerOpen = false`. Developer. Storage untouched. |
| Escape / second chord while re-picking | Picker closes. Previous lock remains. |
| Chord while typing | No-op. |

## Wall windows

Developer (unlocked): tototoben routing. `?wallRole=` + `#/mirror` still mounts `ThirdStationWall`.

While a lock is set: keep the current production bypass. `#/wall-sim` stays `WallSim` and is not rewritten to the lock href. `?wallRole=` windows mount `PhotobashScreen` even if the stored lock is a kiosk station. Lock `station-3` on a window **without** `wallRole` still mounts `ThirdStation` only (no wall collage, no Debra/code/recording wall chrome).

## Error handling

- `localStorage` throws on read → unlocked developer. Hotkey still opens the in-memory picker.
- `localStorage` throws on write → React `lock` still updates for this visit (session-only). Refresh returns to developer.
- Invalid stored value → unlocked developer. Do not auto-open the picker.
- Host browser also bound to Cmd+Shift+P → `preventDefault` / `stopPropagation`. Unlock `~` and Escape remain.
- Hash changes while `pickerOpen` and unlocked → ignore; do not mount developer routes under the picker.
- Unlock mid-journey → unmount that journey, show developer chrome on the leftover hash. No confirm dialog.
- Missing Photobash assets → existing surface fallback. Not this feature.

## Testing

`productionHotkey.test.ts` (jsdom):

- Cmd+Shift+P and Ctrl+Shift+P match; Shift+P, Cmd+P, and KeyP alone do not.
- `event.repeat` does not match.
- Focused `input` / `textarea` makes the hotkey false.
- Escape is a dismiss key when not typing.

`App.runtime.test.tsx` (jsdom `createRoot`, same pattern as `DeviceUnlockLayer.runtime.test.tsx`):

- Default `#/orb` shows `.station-switcher`, not DevicePicker.
- Cmd+Shift+P shows DevicePicker and hides the switcher.
- Escape after that restores the switcher and does not write `hons-device-lock`.
- Choosing Station I writes the lock, hides the switcher, and leaves no picker.
- Stored lock at boot: no switcher, no picker, unlock layer present.
- `~` after a lock restores the switcher; hash stays `#/station-1`.
- Cmd+Shift+P while an `input` is focused does not open the picker.

`stationComposition.test.ts`: developer `App.tsx` must contain `station-switcher`, `ThirdStationWall`, `DevicePicker`, `DeviceUnlockLayer`, `PhotobashScreen`, and `isProductionHotkey`. Photobash source still has no Debra/code/recording wall chrome. Station III lock path still mounts `ThirdStation` without `WallCollageBlanket`.

Existing `deviceLock`, DevicePicker, and DeviceUnlockLayer tests stay.

Verify: `cd orb-platform && npm test && npx tsc --noEmit`. Browser: `npm run dev` → developer nav → chord → picker → lock Station I → refresh stays locked → `~` restores nav on `#/station-1`.

## Out of scope

- LAN / visualizer / firehose production broadcast.
- Per-tab locks on one Chrome profile (shared `hons-device-lock` stays).
- PIN, password, or visible operator button.
- Changing Station I / II scripts, collage look, or forming prelude.
- Deleting Orb / Cards / Avatars / Align / Wall sim.
- Auto-opening the picker on first boot.
- `contenteditable` typing guard (unlock already ignores only `INPUT` / `TEXTAREA`).
