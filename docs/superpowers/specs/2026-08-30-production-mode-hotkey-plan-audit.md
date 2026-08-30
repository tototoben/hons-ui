# Production Mode Hotkey — Plan Self-Review Audit

**Date:** 2026-08-30  
**Plan:** [2026-08-30-production-mode-hotkey.md](../plans/2026-08-30-production-mode-hotkey.md)  
**Spec:** [2026-08-30-production-mode-hotkey-design.md](./2026-08-30-production-mode-hotkey-design.md)  
**Checklist:** writing-plans self-review (spec coverage, placeholders, type consistency)

## 1. Spec coverage

| Spec requirement | Task |
| --- | --- |
| Developer default; empty hash → `#/orb` | Task 2 (`lock` skips empty-hash rewrite) |
| Cmd/Ctrl+Shift+P, `KeyP` + shift + meta/ctrl, ignore repeat | Task 1 |
| `preventDefault` / `stopPropagation` | Task 2 handler; Task 2 test spies `preventDefault` |
| Ignore chord / Escape / `~` while INPUT or TEXTAREA | Task 1 helpers; Task 2 input-focus test; `~` stays in `DeviceUnlockLayer` |
| `pickerOpen` memory-only | Task 2 `useState(false)` — never written to storage |
| Persist `hons-device-lock`; refresh skips picker | Task 2 boot + stored-lock test |
| Unlock clears lock + picker; hash unchanged | Task 2 `unlock` + tilde test |
| Escape / second chord dismiss; re-pick keeps lock | Task 1 `isPickerDismissKey`; Task 2 re-pick test |
| Hotkey while locked opens picker | Task 2 render `pickerOpen` first; re-pick test |
| No LAN / firehose / query boot flag | Global constraints; no such files |
| Sibling windows follow lock via `storage` | Task 2 existing listener |
| Picker labels, kiosk omits Photobash, Wall sim link | Unchanged `DevicePicker` |
| Station III kiosk vs Photobash collage | Task 2 lock branches; Task 3 Photobash source checks |
| Unlocked `?wallRole=` + `#/mirror` → `ThirdStationWall` | Task 2 developer `mirror` branch |
| Locked `?wallRole=` → `PhotobashScreen`; `#/wall-sim` not rewritten | Task 2 render + lock hash effect |
| Lock `station-3` without wallRole → `ThirdStation` only | Task 2 `lock ? <ThirdStation />` |
| Storage throw / invalid lock → developer | Existing `readDeviceLock` / `writeDeviceLock`; Task 2 uses them |
| Hash changes under unlocked picker do not show developer routes | Task 2 `pickerOpen` wins the ternary |
| Composition: switcher + overlay + `isProductionHotkey` | Task 3 |
| Full `npm test` + `tsc` + browser path | Task 4 |

No spec section lacks a task. Wall-sim / wallRole bypass has no dedicated runtime test; it is encoded in the Task 2 `App.tsx` branches copied from current production behavior.

## 2. Placeholder scan — pass after one add

No TBD / TODO / “handle later” / “write tests for the above.” Task 3 Step 3 is “no extra implementation if Task 2 landed,” with a concrete fallback (fix `App.tsx` strings). Task 4 allows skipping a commit when already green.

**Fix applied:** added App tests for `preventDefault` and for re-open picker while locked + second chord keeping `station-1`.

## 3. Type consistency — pass

Task 1 produces `isTypingTarget`, `isProductionHotkey`, `isPickerDismissKey` with the `Pick<KeyboardEvent, …>` shapes Task 2 imports. `STORAGE_KEY`, `lockHref`, `lockToStation`, `DeviceLock` stay the existing `deviceLock` exports. `pickerOpen` is boolean React state, never a storage key.

## Result

Plan is implementation-ready. Pre-existing `useMirrorCamera` timeout fail is called out so agents do not treat it as this feature’s regression.
