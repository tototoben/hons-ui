# Production Device Lock — Design Specification

**Date:** 2026-08-27  
**Status:** Approved for implementation  
**Source of truth:** Operator brief (dev menu that locks each machine to one exhibit surface)

## Objective

Give every install machine (Mac Studio and kiosk screens) a boot picker that locks that browser into one production surface. Once locked, the machine shows only that process: no station-switcher pills, no Leva, no experimental routes. The lock survives refresh and reboot until the operator unlocks it.

Photobash is not a station. It is the six-display avatar reveal on the Mac Studio wall. Station III is only the kiosk intro on the third mirror.

## Locked decisions

- Persist the lock in `localStorage` until unlock.
- Unlock with a hidden bottom-left corner hold (~2s) and the tilde key (`~`).
- Picker lists Station I, Station II, Station III, and Photobash. No Orb, Cards, Avatars, Align, or Wall sim.
- Photobash appears on the Mac Studio / full-quality picker only. Kiosk quality (`quality=kiosk` or Pi detection) omits it.
- Station III never drives the wall. The wall never shows Debra intro, code HUD, or recording chrome.
- Photobash loops on its own. A later Station III → wall handoff is a named no-op stub only.

## Device lock

Storage key: `hons-device-lock`  
Values: `station-1` | `station-2` | `station-3` | `photobash`

| Lock | Hash forced while locked | Surface |
| --- | --- | --- |
| `station-1` | `#/station-1` | Station I kiosk journey |
| `station-2` | `#/station-2` | Station II kiosk journey |
| `station-3` | `#/mirror` | Station III kiosk intro only (`ThirdStation`) |
| `photobash` | `#/photobash` | Collage reveal only |

Missing, invalid, or unreadable storage means unlocked. If `localStorage` throws (privacy-restricted kiosk browsers), the picker still works for the current session and a refresh returns to the picker.

Sibling Chrome windows on the same profile follow the lock via the `storage` event.

## Boot flow

1. Unlocked → full-screen picker. Hash is ignored until a choice is stored.
2. Choosing a lock writes storage, sets the hash, and mounts that surface with production chrome hidden.
3. Locked → that surface only. Manual hash changes are overwritten back to the lock href.
4. Unlock clears storage and returns to the picker.

Default empty-hash behaviour no longer falls through to `#/orb`. Unlocked boot is the picker.

## Picker

Full-viewport menu, one column, large tap targets. Labels:

- Station I
- Station II
- Station III
- Photobash (hidden when device quality is `kiosk`)

No other links. Experimental routes stay in the codebase but are not listed and are not reachable while a lock is set.

## Unlock

- Invisible 64×64 CSS-pixel hit target, bottom-left corner. Press and hold 2000ms to unlock. Pointer up or leave before 2000ms cancels. No visible button, label, or focus ring that a visitor would treat as UI.
- Tilde (`~`) also unlocks. Ignored while an `input` or `textarea` is focused so Station I typing cannot fire it.
- Unlock never navigates between stations; it only clears the lock and shows the picker.

## Chrome while locked or on the picker

Hidden:

- `.station-switcher` pills
- Leva / DevPanel
- Station II’s `Continue to Station III` link (`<a href="#/mirror">`)

Station I’s “Proceed to the next station” copy stays as a hold for the visitor to walk on. It is not a link.

The `fills` portrait-preview key sequence may remain for operators; it must not draw on-screen controls.

## Station III vs Photobash split

### Station III (kiosk)

Route `#/mirror` (and lock `station-3`) always mounts `ThirdStation`: intro → prompt → recording → processing, looping on that one screen. It must not mount `ThirdStationWall`, `WallCollageBlanket`, or `WallFaceBlanket`. A `?wallRole=` query on this lock is ignored.

### Photobash (Mac Studio wall)

New route `#/photobash`. Always the collage (or `WallFaceBlanket` when `collage=0`). Never intro / prompt / recording role chrome.

`?wallRole=` still selects which measured panel crop that Chrome window shows. Six Studio windows keep the existing role URLs, with the hash changed to `#/photobash`.

No `wallRole` (laptop preview): render the collage cropped to the `copy` panel, full-bleed in the window, and this window is the timing conductor.

Debra remains the silent conductor when `wallRole=debra` so all six windows share `photobashSeed` and loop in sync over `BroadcastChannel`. Cycle length stays `WALL_TIMING.loadingSeconds` (65s). Each cycle mints a new seed. There is no intro/prompt/recording phase on this path.

### Later handoff (out of scope to wire)

Export `notifyRevealReady()` as a no-op in `orb-platform/src/lib/photobashTrigger.ts`. Station III must not call it yet. Document that a future change will have Station III notify the wall when the visitor finishes.

## Launch scripts

`scripts/blanket-station3-wall-measured.applescript` (and any sibling that currently opens `?wallRole=…#/mirror`) must open `?wallRole=…#/photobash` instead.

## Error handling

- Invalid stored lock → treat as unlocked.
- Storage write/read throws → session-only lock if the in-memory value was set this visit; otherwise picker.
- Photobash window without a conductor still renders (seed falls back to `1` until a conductor publishes).
- Unlock during a journey unmounts that journey and shows the picker; no confirmation dialog.

## Testing

Cover at least:

- Read/write/clear lock; reject invalid values; storage throw → unlocked.
- Kiosk picker omits Photobash; full quality includes it.
- Lock href mapping (`station-3` → `#/mirror`, `photobash` → `#/photobash`).
- Locked hash cannot escape (resolver always returns the lock route).
- `#/photobash` is a station route; `#/mirror` remains Station III.
- App (or composition test) does not mount wall collage on Station III, and does not mount Debra/code/recording wall chrome on Photobash.
- Station II continue link is absent when locked.
- Unlock hold duration and tilde key constants are the specified values.

## Out of scope

- Networking a visitor face from a kiosk to the Mac Studio.
- Deleting Orb / Cards / Avatars / Align / Wall sim code.
- Changing Station I / II question scripts or Photobash collage look.
- Visible operator chrome, PIN, or password.
- Committing or pushing (operator authorization required).
