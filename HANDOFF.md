# Handoff — continue on the other Mac

**Date:** 2026-09-06  
**Repo:** https://github.com/martinorav-png/house-of-negotiated-selves  
**Branch:** `feat/kiosk-high-pass` (merge to `main` when this pass is done)  
**Pull first:** `git pull`

This file is the short “open this on the other computer” note. Full project context stays in [`CONTEXT.md`](CONTEXT.md).

---

## What to continue next (highest priority)

### Festival kiosk bring-up for `orb-platform`

Active app is **`orb-platform/`**: stations I–III plus photobash. Face tracking is already shipped — do **not** implement the Aug 3 face-parallax plan.

| Already true | Detail |
|--------------|--------|
| MediaPipe Face Landmarker | In `orb-platform/package.json` (`@mediapipe/tasks-vision`). Loads from vendored `orb-platform/public/mediapipe/` (see [`docs/superpowers/specs/2026-09-06-kiosk-offline-assets-design.md`](docs/superpowers/specs/2026-09-06-kiosk-offline-assets-design.md)). |
| Debra speech | **Not wired** in this app (visual guide only). Do not add `DebraVoice`. |
| Webcam | Stays on whenever `MirrorCameraLayer` mounts, including overlay `none`. |

**On the other machine, tell the agent:**

> Festival kiosk bring-up: `cd orb-platform && npm install && npm run dev`, then WAN-off check. Do not implement face parallax from `docs/superpowers/plans/2026-08-03-webcam-face-parallax.md`.

---

## What’s already in `orb-platform` (built & working)

React 19 + R3F + Three.js station / photobash app:

- Station journey (I–III) + photobash wall
- Local MediaPipe Face Landmarker (`predev` / `prebuild` vendor `public/mediapipe/`)
- Live mirror via `MirrorCameraLayer` (camera stays up; overlay `none` skips MediaPipe but keeps the webcam)
- Debra as on-screen guide only (no speech in this app)
- Mic-driven motion, heartbeat ripple, CRT / spatial copy where those routes still mount

```bash
cd orb-platform
npm install
npm run dev
# → http://localhost:5176
```

Key knobs: `orb-platform/src/config.ts` (`ORB.heartbeat*`, `SCAN`, `PALETTE`, `CAMERA`, `PARALLAX`).

---

## Quick start on a fresh machine

```bash
git clone https://github.com/martinorav-png/house-of-negotiated-selves.git
cd house-of-negotiated-selves
git pull

# Installation app (current focus)
cd orb-platform && npm install && npm run dev
```

Needs **HTTPS or localhost** for camera. MediaPipe WASM is copied on `npm run dev` / `npm run build`; the landmarker `.task` is committed under `public/mediapipe/`.

Optional team Flutter repo:

```bash
git clone https://github.com/tototoben/eka-ars26-house.git work/eka-ars26-house
```

(`work/eka-ars26-house/` is gitignored as a nested clone.)

---

## Repo map (relevant bits)

| Path | Role |
|------|------|
| `orb-platform/` | **Active** installation app — stations I–III + photobash |
| `orb-ui/` | Older orb experiments — don’t extend |
| `orb-platform/public/mediapipe/` | Vendored Face Landmarker assets (see kiosk-offline spec) |
| `assets/moodboard-inspo/` | Visual references for the orb language |
| `docs/superpowers/` | Specs / plans (Aug 3 parallax is historical; Sep 6 kiosk specs are current) |
| `CONTEXT.md` | Full installation handoff |

---

## Do not re-litigate

- Composition = tension; no fake HUD / dual globes
- Restrained bloom; orb glow kept down
- CRT: plain language, one large centered line
- Question text in 3D space under orb, no blue underplate
- Hover transition must stay damped (no snap `useEffect` on `hoverAmt`)
- Do not add `DebraVoice` or restore Debra speech in this app
- Do not change webcam lifetime (`MirrorCameraLayer` keeps the camera, including overlay `none`)

---

## Kiosk smoke checklist

1. `cd orb-platform && npm install && npm run dev` → http://localhost:5176
2. Stations I–III + photobash load; Debra is visual only
3. Webcam stays on with `MirrorCameraLayer` mounted, including overlay `none`
4. WAN-off: MediaPipe still loads from `public/mediapipe/` (no CDN)
5. `npm test` and `npm run build` in `orb-platform` pass
