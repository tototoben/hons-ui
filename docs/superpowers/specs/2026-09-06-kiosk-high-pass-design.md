# Kiosk high-pass — Design Specification

**Date:** 2026-09-06  
**Status:** Approved for implementation (visual freeze locked by user)  
**Source of truth:** Festival High findings plus the visual-freeze constraint below

## Objective

Close the three High items from the 6 Sep audit without changing what a visitor sees or hears on the station / photobash surfaces.

## Locked decisions

- **Visual freeze.** No CSS, copy, layout, motion, overlay geometry, color, type, or camera-stage pose formulas may change. Overlay drawing, `--journey-focus-*` / `--journey-pose-*` values, and the appearance readout must still update at the existing detect interval with the same numbers they would have produced before.
- **Optimize:** stop `setLandmarks` / `setSignals` / `setAppearance` on every MediaPipe detect tick. Write the sample into a ref. Drive canvas, CSS custom properties, appearance HUD, and visitor-face capture from that ref so the pixels stay the same.
- **Distill:** delete confirmed-unused source (GridScan cluster and friends) and drop npm packages that only those files imported. Do not delete `orb-ui/`, Debra MP3s, persona PNGs, or any file imported by a live station / photobash / AvatarStation route.
- **Clarify:** rewrite `HANDOFF.md`, `CONTEXT.md`, and root `README.md` so they match the tree (MediaPipe is in `orb-platform`, Debra speech is not wired in this app, webcam stays on for the live mirror, kiosk assets are local). Do not change on-screen UI copy.
- Do not change webcam lifetime. Overlay `none` still keeps the live camera and skips MediaPipe.
- Do not restore Debra speech.
- Do not add npm dependencies.
- Work on branch `feat/kiosk-high-pass`, not `main`.
- Commit after each task. Do not push unless asked.

## Out of scope

- Camera-fallback contrast / `aria-hidden` (P2 from the PR audit)
- Dual lockfiles, default-hash orb route, `postMessage` origin
- Festival WAN-off kiosk dry run (human)

## Optimize (MediaPipe tick)

Today `useMirrorCamera` calls three `setState`s inside the detect rAF (66 ms desktop / 120 ms kiosk). That re-renders `MirrorCameraLayer` (video, canvas, scan overlay, appearance HUD, lazy dev panel) at 8–15 Hz.

Target:

1. `useMirrorCamera` writes `{ landmarks, signals, appearance }` to `sampleRef` on each detect. It does **not** call `setLandmarks` / `setSignals` / `setAppearance` on that path.
2. `setState` remains for `status`, `devices`, `selectedDeviceId`, `activeDeviceId`.
3. Tracking-off still clears the sample (empty landmarks, neutral signals, null appearance) and still skips Face Landmarker creation.
4. `MirrorCameraLayer` paints from `sampleRef` (immediate tick plus rAF): same `drawLandmarks` call, same CSS custom-property formulas, same appearance markup. Visitor-face capture stays on the face-mode path with the same landmark-count and interval gates.
5. Existing overlay tests stay green. The blendshape runtime test reads `sampleRef` after a detect frame instead of React `data-*` attributes driven by per-tick state.

## Distill (dead cluster)

Delete only files with no production importer. Keep comments that name GridScan as historical language in live files (`CardScanSweep`, `CardStationPostProcessing`, `stationComposition.test.ts` assertions that live stations do **not** contain GridScan).

Drop unused npm deps that become orphaned: `animejs`, `face-api.js`, `ogl`, `motion`.

## Clarify (docs)

Agents landing on a second machine must not be told face parallax is unbuilt or that `npm run samples:debra` exists in this package (it does not). Point them at `orb-platform` stations + local MediaPipe.

## Testing

TDD.

1. Detect ticks do not increase a render counter on a hook harness after status is `active`.
2. After one detect rAF, `sampleRef.current.signals` still matches the existing blendshape expectations.
3. Tracking-off still starts the camera and does not create a landmarker.
4. `MirrorCameraLayer` overlay and appearance tests still pass (same strokes, same readout copy).
5. Full `npm test` in `orb-platform` passes after each task.

## Success criteria

- Stations look the same.
- MediaPipe ticks do not re-render the camera React tree.
- Dead GridScan / MorphSlider / Room / TiltedCard cluster is gone from `src/`.
- Handoff docs describe the current app.
