# Production Mode Hotkey — Spec Self-Review Audit

**Date:** 2026-08-30  
**Spec:** [2026-08-30-production-mode-hotkey-design.md](./2026-08-30-production-mode-hotkey-design.md)  
**Checklist:** brainstorming spec self-review (placeholder, consistency, scope, ambiguity)

## 1. Placeholder scan — pass

No `TBD`, `TODO`, incomplete sections, or “handle later” requirements. Hotkey modifiers, storage keys, boot order, dismiss keys, unlock destination, wall bypass, tests, and out-of-scope list are concrete.

## 2. Internal consistency — pass after one fix

The spec amends 27 Aug boot/unlock (developer default, unlock → developer) and keeps lock values, picker labels, Station III vs Photobash, and unlock gestures. Boot gate, data-flow table, and component wiring agree: three shells (locked / picker / developer); `pickerOpen` is memory-only; stored lock survives refresh.

**Fix applied:** App `keydown` was described as two overlapping conditions. Replaced with a single order: dismiss if `pickerOpen && isPickerDismissKey`, else open if `isProductionHotkey`. Unlock during re-pick now also closes the picker (data-flow row updated).

## 3. Scope check — pass

One subsystem: overlay the existing DevicePicker on the tototoben developer `App` via a same-machine hotkey. Fits a single implementation plan. LAN broadcast, per-tab locks, and collage/forming work stay out of scope.

## 4. Ambiguity check — pass after two picks

| Risk | Pick (now in spec) |
| --- | --- |
| Escape in developer | No-op; dismiss only when `pickerOpen` |
| Typing guard target | Always `document.activeElement`, same as unlock |
| Key repeat | Ignored; holding the chord does not toggle |
| Second chord while re-picking | Closes picker, keeps existing lock |
| `?wallRole=` while locked to a kiosk station | Still `PhotobashScreen` (current production bypass) |
| Empty hash | `#/orb` in developer; not the picker |
| Storage throw on write | Session lock via React state; refresh → developer (not picker) |

No remaining two-way readings on boot destination, hotkey match, or unlock landing.

## Result

Spec is implementation-ready. Next step after operator review: writing-plans.
