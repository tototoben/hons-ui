# Kiosk offline assets — Design Specification

**Date:** 2026-09-06  
**Status:** Approved for implementation  
**Source of truth:** Festival blocker audit plus locked decisions below

## Objective

Festival kiosks must run face tracking and the photobash wall with no public CDN. MediaPipe WASM and the face landmarker model load from this app. Photobash face-bank and lip-sprite URLs honor Vite `base()`, so they work at both `/` (Vercel) and `/orb/` (default Vite / visualizer embed).

## Locked decisions

- Vendor MediaPipe locally. Runtime code must not fetch `cdn.jsdelivr.net` or `storage.googleapis.com`.
- Copy WASM from `node_modules/@mediapipe/tasks-vision/wasm` at `predev` / `prebuild`. Do not commit the ~18MB WASM binaries.
- Commit `face_landmarker.task` under `orb-platform/public/mediapipe/`.
- Prefix photobash asset URLs with the existing `base()` helper in `orb-platform/src/config.ts`.
- Do not restore Debra speech. The nine MP3s stay on disk unused. No `DebraVoice` component this pass.
- Do not change webcam lifetime. Overlay mode `none` still keeps the live mirror and skips MediaPipe. Existing runtime test remains the contract.

## Out of scope

- Deleting `orb-ui/`, GridScan, unused npm deps, or Debra MP3s
- Webcam start/stop by journey phase
- MediaPipe `setState` per-tick performance
- Dual lockfiles, HANDOFF.md rewrite, default-hash orb route

## MediaPipe vendoring

### Layout

| Path | Source | Git |
| --- | --- | --- |
| `orb-platform/public/mediapipe/wasm/` | Copied from `node_modules/@mediapipe/tasks-vision/wasm/` | gitignored |
| `orb-platform/public/mediapipe/face_landmarker.task` | Official MediaPipe float16 model (current URL used only by the vendor script if the file is missing) | committed |

WASM files to copy (all four, so SIMD and no-SIMD devices both work):

- `vision_wasm_internal.js`
- `vision_wasm_internal.wasm`
- `vision_wasm_nosimd_internal.js`
- `vision_wasm_nosimd_internal.wasm`

### Vendor script

Create `orb-platform/scripts/vendor-mediapipe.mjs`.

1. Resolve `node_modules/@mediapipe/tasks-vision/wasm`. If that directory is missing, exit non-zero with a message to run `npm install` in `orb-platform`.
2. Copy its contents into `public/mediapipe/wasm/`, creating directories as needed.
3. If `public/mediapipe/face_landmarker.task` is missing, download it once from the current Google Storage URL used in `PARALLAX.modelUrl`. If the file already exists, skip the download.
4. Exit zero only when wasm files and the `.task` file are present.

Wire it as `predev` and `prebuild` in `orb-platform/package.json` so `npm run dev` and `npm run build` cannot start without local assets.

### Runtime URLs

Change `PARALLAX` in `orb-platform/src/config.ts`:

- `wasmBase`: `base('/mediapipe/wasm')`
- `modelUrl`: `base('/mediapipe/face_landmarker.task')`

Callers stay unchanged: `useMirrorCamera`, `useMediaSensors`, `faceBankAlign` already read `PARALLAX.wasmBase` and `PARALLAX.modelUrl`.

A failed landmarker load still surfaces through the existing camera-unavailable UI. Do not add a new error toast.

### Gitignore

Add:

```
orb-platform/public/mediapipe/wasm/
```

Do not ignore `face_landmarker.task`.

## Photobash `base()` paths

Working examples already in tree:

- `MATCH_FACE_URL = base('/assets/wall-avatar/match-face.png')`
- `VISITOR_FACE_URL = base('/assets/wall-avatar/visitor-face.jpg')`

Broken:

- `FACE_BANK_DIR` in `orb-platform/src/lib/faceBank.ts` is `'/assets/wall-avatar/face-bank/'`
- `LIP_SPRITE_SRC` in `orb-platform/src/lib/wallLipClips.ts` is `'/assets/wall-avatar/lips/mouth-sprite.jpg'`

Fix both with `base(...)`. `base()` already strips a trailing slash from `import.meta.env.BASE_URL` and concatenates the path, so:

- Vercel (`base: '/'`) → `/assets/wall-avatar/face-bank/`
- Default Vite (`base: '/orb/'`) → `/orb/assets/wall-avatar/face-bank/`

Manifest fetch and image loads that concatenate `FACE_BANK_DIR` + filename inherit the prefix. Lip sprite loads that use `LIP_SPRITE_SRC` inherit it too.

No other hardcoded `/assets/` photobash URLs are in this pass.

## Testing

TDD. Watch each test fail before implementing.

1. **Config / PARALLAX** — `wasmBase` and `modelUrl` equal `base('/mediapipe/wasm')` and `base('/mediapipe/face_landmarker.task')`. Neither string contains `jsdelivr`, `googleapis`, or `http`.
2. **faceBank** — `FACE_BANK_DIR` equals `base('/assets/wall-avatar/face-bank/')` and ends with `/`. Existing pick-order tests stay.
3. **wallLipClips** — `LIP_SPRITE_SRC` equals `base('/assets/wall-avatar/lips/mouth-sprite.jpg')`. Existing frame-rect tests stay.
4. **Webcam contract** — existing `useMirrorCamera.runtime.test.tsx` case “keeps the live camera but skips MediaPipe when tracking is off” must still pass. Do not change that behavior.
5. **Suite** — `npm test` in `orb-platform` must pass. `prebuild` must copy wasm before `vite build` (script exists and is referenced from `predev` / `prebuild`).

Do not add Debra audio tests. Do not add webcam start/stop tests beyond the existing tracking-off case.

## Verification (human / kiosk)

- `cd orb-platform && npm run dev` with WAN disabled after the first vendor run: Station I scan still loads the landmarker (no jsdelivr/Google requests in the network panel).
- Photobash / collage images load at `http://localhost:5176/orb/#/photobash` (default base) and would load at `/` on Vercel.
- Station II still shows the live mirror during `cameraMode="none"`.

## Success criteria

- No runtime MediaPipe request leaves the machine.
- Face-bank and lip sprite URLs include Vite `base()`.
- Debra remains silent in this app.
- Webcam still runs whenever a station mounts `MirrorCameraLayer`, including overlay `none`.
