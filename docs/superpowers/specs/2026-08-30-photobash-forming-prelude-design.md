# Photobash Forming Prelude Design

**Date:** 2026-08-30  
**Status:** Approved after audit  
**Surface:** Station III 6-display wall collage photobash, plus the dedicated Photobash loop  
**Implementation home:** branch `ars-production-build` (worktree `/Users/martin/ars-electronica/.worktrees/ars-production-build`). The current `main` checkout does not contain `WallCollageBlanket` / `PhotobashScreen` / `collageRects`.

## Goal

Give the wall a short, readable loading beat before the photobash photos appear: the same collage rectangles assembling in fleshy tones, with one line of copy on Debra. Then cut to the existing collage. This replaces yesterday’s over-ambitious loading experiments with Tõnis’s simpler constraint: the photobash is already rectangles.

## Context

When Station III hits `loading`, all six screens currently jump straight into `WallCollageBlanket` (stranger face-bank pieces, then visitor swap). There is no forming beat. `loadingProgress` already fills from 0 to 1 in the first 4000ms (`PHOTOBASH_FILL_MS`) and then holds at 1 for the rest of the 65s cycle; that clock is unused as a visual gate today.

The dedicated `PhotobashScreen` loop uses the same 4s fill + 65s cycle (`usePhotobashLoop` already returns `loadingProgress`) but only consumes `photobashSeed`, so it also mounts the collage immediately.

Non-collage `WallFaceBlanket` (organic shard glitch, `?collage=0`) is unchanged.

## Experience

1. Recording ends (Station III) or a new photobash cycle starts (`PhotobashScreen`).
2. All six role windows show one shared wall plate: the current `collageRects(photobashSeed)`, empty of photos, filled with mixed-bruise flesh swatches.
3. Rectangles fade in and settle over about 2.5s (opacity 0→1, scale 0.96→1), staggered in a seeded order. They hold for the rest of the 4s.
4. Debra’s landscape TV overlays a caption chip: **PARTNER FORMING**, same chrome as the later MATCH LOCKED plate, with a slow fleshy glow. Other roles show tiles only.
5. At 4.00s (`loadingProgress` reaches 1): hard cut. Unmount forming, mount the existing collage with the same seed. The boxes match. Collage reveal timing starts at this cut, not during forming.
6. Remainder of the 65s cycle is the photobash as it already behaves.

Total loading length stays 65s. Forming is the first 4s of that window, not extra time.

## Visual

### Tiles

- Draw on the same `MATCH_FACE_SIZE` canvas plate and wall-crop transform as `WallCollageBlanket`. Not DOM tiles (CSS animation would drift across the six windows).
- Geometry: exact `collageRects(seed)` (same positions and sizes as the photobash, including the merged mouth rect). No extra jitter beyond what `collageRects` already applies.
- Fill: solid mixed-bruise swatches, one per rect, assigned by seed. Locked swatches:

  `#e8b48c` `#c97a6e` `#d4a574` `#8e5a58` `#f0c4b0` `#a07068` `#d4927a` `#b86b5c` `#c4a080`

- Plate background: `#120d0a` (existing collage canvas).
- Outline: keep the existing faint rect stroke (`rgba(8, 6, 4, 0.35)`, line width `max(1, width * 0.0015)`).
- Motion: stagger across the 9 rects over 2500ms; each tile eases for 600ms; last ~1.5s is a hold. No flight, no outlines-first, no sampled-from-photo fills.
- Clock: tile opacity/scale are functions of `loadingProgress * PHOTOBASH_FILL_MS`, not a local RAF start time. All six windows stay in lockstep via the existing BroadcastChannel progress.

### Debra copy

- Show when `shouldShowFormingCaption(role)` is true: `role === 'debra'`, or `role === null` on `PhotobashScreen` (laptop preview with no `wallRole`).
- Do not show on `copy` / `guide` / `code` / `status` / `avatar`, including wall-sim iframes for those roles. ThirdStationWall without `wallRole` defaults to `copy` and has no chip (that case is Station III, not the Photobash preview).
- Chip matches `.wall-face-caption`: bottom-center of the **panel** (not baked into the plate canvas), 11px ui-monospace, 0.18em tracking, uppercase, dark translucent pad, 1px border.
- Swap the cream border/text for mixed-bruise (`#f2c8b4` text, fleshy border, slow opacity pulse 2.4s).
- Copy constant: `PARTNER FORMING` (no em dash, no percent, no second line).

## Architecture

### Clock

Reuse `PHOTOBASH_FILL_MS` (4000) and the existing `loadingProgress` curve. Forming is visible while `loadingProgress < 1`. Photobash is visible while `loadingProgress >= 1`. No new BroadcastChannel message.

### New unit: `WallFormingBlanket`

Same wall crop / fit-scale / face-plate transform as `WallCollageBlanket`. Draws fleshy rects via `drawWallForming`. On mount it kicks `loadFaceBankImages()` so the existing in-memory image cache is warm before the cut (forming still does not *draw* photos). Debra/null caption is a DOM overlay on that panel.

Helpers (pure, seed-deterministic, unit-tested) in `wallForming.ts`:

- `FLESH_SWATCHES` / `FORMING_COPY` / `FORMING_STAGGER_MS` / `FORMING_TILE_MS` / `FORMING_FROM_SCALE`
- `fleshFillForRect(seed, index)` → swatch
- `formingStagger(seed, rectCount)` → delay ms per index
- `formingElapsedMs(loadingProgress)` → `clamp(progress, 0, 1) * PHOTOBASH_FILL_MS`
- `formingTileOpacity(elapsedMs, delayMs)` / `formingTileScale(elapsedMs, delayMs)`
- `shouldShowForming(loadingProgress)` → `loadingProgress < 1`
- `shouldShowFormingCaption(role: WallRole | null)` → `role === 'debra' || role === null`
- `pickWallLoadingSurface(collage, loadingProgress)` → `'forming' | 'collage' | 'face'`
- `drawWallForming(ctx, options)`

### Call sites

- `ThirdStationWall`: during `phase === 'loading'`, `pickWallLoadingSurface(parseWallCollage(), loadingProgress)` chooses forming / collage / face. Pass `loadingProgress` into forming. Same seed throughout.
- `PhotobashScreen`: consume `loadingProgress` from `usePhotobashLoop`. Same gate at the start of every 65s loop (new seed each cycle). Pass `showCaption={shouldShowFormingCaption(parseWallRole())}` so a null role still gets the chip while the crop stays `copy`.

Do not mount `WallCollageBlanket` until the cut, so its 45s visitor reveal starts after forming. Face-bank decode still starts during forming via the cache warmup.

### Sync and failure

- Seed 0 / first paint: still form (`shouldShowForming(0) === true`).
- Face bank or visitor capture not ready at 4s: cut anyway; existing collage already handles missing images.
- Forming must not wait on network or decode. It is the hold.
- Non-collage wall path: `pickWallLoadingSurface(false, _)` is always `'face'`.

## Out of scope

- Station I / II, single-station ThirdStation orb loading, Hons 3D avatar.
- Changing collage composition, lip sprite, visitor reveal, or MATCH LOCKED (MATCH LOCKED remains on every collage panel after the cut, as today).
- Crossfade between forming and photos.
- Sampling flesh colors from the bank or visitor stills.
- Extracting shared layout from `WallCollageBlanket` (copy the existing crop/fit block).

## Testing

- Helper tests: swatch assignment and stagger order are stable for a given seed; `shouldShowForming(0)` true, `shouldShowForming(1)` false; caption helper; `pickWallLoadingSurface`; opacity 0 before delay and 1 after delay+600ms.
- Runtime: `WallFormingBlanket` with Debra shows `PARTNER FORMING`; with `copy` it does not. Canvas `.wall-forming-canvas` is present.
- PhotobashScreen at progress 0 mounts forming; at progress 1 mounts collage (`.wall-collage-canvas`).
- CSS: forming caption chip exists, uppercase tracking, fleshy color, not cream MATCH LOCKED styles.

## Files

**New**

- `orb-platform/src/lib/wallForming.ts` (+ `wallForming.test.ts`)
- `orb-platform/src/components/WallFormingBlanket.tsx` (+ css, runtime test, css test)

**Touch**

- `orb-platform/src/components/ThirdStationWall.tsx`
- `orb-platform/src/components/PhotobashScreen.tsx` (+ runtime test)

Do not change the `PHOTOBASH_FILL_MS` value in `photobashLoop.ts`.
