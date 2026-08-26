# Station III 6-Display Wall + Photobash Reveal — Handoff

**Date:** 2026-08-26  
**Repos:** [house-of-negotiated-selves](https://github.com/martinorav-png/house-of-negotiated-selves)  
**Live app:** https://house-of-negotiated-selves.vercel.app/  
**Local workspace (dev):** `/Users/martin/ars-electronica` (`orb-platform/`)  
**Install machine:** Mac Studio (user often `hons`), driving a 6-monitor wall  

This handoff is for someone picking up the **Station III wall install**: role-per-screen Chrome windows, phase sync, full-wall face blanket, visitor↔match photobash, and launch scripts. It is not about the Hons 3D avatar GLB work (see `2026-08-25-hons-avatar-browser-integration-handoff.md` for that).

---

## What we built (intent)

Station III on the gallery wall is **not** one stretched browser window. It is **six chromeless Chrome app windows**, each bound to a physical display, each loading the same deploy with a different `?wallRole=…`.

While Station III runs:

1. Roles show different UI (code, Debra, copy, guide arrows, avatar stub, status).
2. Phases stay in sync via `BroadcastChannel` (Debra = conductor).
3. On the **`loading`** phase, **every** role switches to a shared **face blanket**: one portrait image cover-scaled onto a virtual wall canvas; each monitor only shows its crop.
4. The blanket starts as the clean **match face** (woman), then **glitches** into a pre-baked **photobash** (random visitor-face shards over the match), choppy and irregular.
5. Timing is wall-specific: short intro/prompt/countdown/recording, long face hold (~65s), then loop.

---

## Hardware

| Piece | Notes |
| --- | --- |
| **Mac Studio** | Drives all six displays. Launch scripts run here. Screen Sharing from a laptop has been flaky; prefer local Terminal / Universal Control when possible. |
| **6 displays** | Irregular mix of **portrait** (1080×1920) and **landscape** (1920×1080), staggered in macOS display arrangement — **not** a clean grid. |
| **Measured bounding box** | Virtual wall ≈ **3585 × 5258** CSS px (derived from panel origins + sizes). |
| **Chrome** | Required. Windows are opened with `--app=` so there is **no tab bar / address bar**. Bounds are set via AppleScript after each window opens. |

Display labels (from `MEASURED_WALL_PANELS` in code) — useful when remapping:

| Role | Origin (x, y) | Size | Label (as measured) |
| --- | --- | --- | --- |
| `code` | -47, -3338 | 1080×1920 | L24i-4A (4) top-left |
| `status` | 1033, -3000 | 1080×1920 | L24i-4A (1) top |
| `avatar` | 2113, -1920 | 1080×1920 | Beyond TV (2) top-right |
| `debra` | -392, -1080 | 1920×1080 | Beyond TV (1) mid-left **conductor** |
| `copy` | 0, 0 | 1080×1920 | L24i-4A (2) bottom-left |
| `guide` | 1080, 305 | 1920×1080 | L24i-4A (3) bottom-right |

**If the physical layout changes**, re-measure window bounds in macOS (or from a probe) and update **both**:

- `orb-platform/src/lib/wallRole.ts` → `MEASURED_WALL_PANELS`
- `scripts/blanket-station3-wall-measured.applescript` (and any gitless paste script)

Keep role ↔ display mapping intentional: Debra should stay on a comfortable landscape panel if she remains conductor.

---

## Software stack

| Layer | Detail |
| --- | --- |
| App | Vite + React in `orb-platform/` |
| Deploy | Vercel → https://house-of-negotiated-selves.vercel.app/ |
| GitHub | `martinorav-png/house-of-negotiated-selves` (`main`) |
| Wall entry | `?wallRole=<role>#/mirror` |
| Face align tool | `#/face-align` (manual visitor lineup; Save → `localStorage`) |
| Sync | `BroadcastChannel('hons-station3-wall-phase')` — same Chrome profile / machine only |

**Dev note:** Local MacBook git was often blocked by **Xcode license**; pushes sometimes went through `gh` API / Node rather than `git push`. Prefer fixing Xcode license or pushing from the Mac Studio / CI.

---

## How to launch (no git required)

On the Mac Studio, paste into Terminal (gitless — talks only to Vercel + Chrome):

```bash
osascript <<'APPLESCRIPT'
use scripting additions

set baseUrl to "https://house-of-negotiated-selves.vercel.app/"
set chromeBin to "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

set panels to {¬
	{-47, -3338, 1080, 1920, "code"}, ¬
	{1033, -3000, 1080, 1920, "status"}, ¬
	{2113, -1920, 1080, 1920, "avatar"}, ¬
	{-392, -1080, 1920, 1080, "debra"}, ¬
	{0, 0, 1080, 1920, "copy"}, ¬
	{1080, 305, 1920, 1080, "guide"}}

tell application "Google Chrome"
	activate
	try
		close every window
	end try
end tell
delay 0.6

repeat with p in panels
	set sx to item 1 of p
	set sy to item 2 of p
	set sw to item 3 of p
	set sh to item 4 of p
	set wallRole to item 5 of p
	set targetUrl to baseUrl & "?wallRole=" & wallRole & "#/mirror"
	do shell script quoted form of chromeBin & " --new-window --app=" & quoted form of targetUrl & " >/dev/null 2>&1 &"
	delay 1.0
	tell application "Google Chrome"
		set bounds of front window to {sx, sy, sx + sw, sy + sh}
	end tell
	delay 0.35
end repeat
APPLESCRIPT
```

Repo copy of the same idea:

```bash
osascript scripts/blanket-station3-wall-measured.applescript
```

**Important launch details:**

- Use **`--app=`** first, **then** set `bounds`. Do not rely on macOS “Full Screen” (Spaces / menu bar fights the wall).
- After a Vercel deploy, **relaunch** (or hard-refresh all six windows). Stale app caches will show old photobash behavior.
- Optional: save the heredoc as `~/wall-station3.applescript` and run `osascript ~/wall-station3.applescript`.

Related scripts under `scripts/` (older / alternate approaches):

- `blanket-station3-wall.sh` / `.applescript` — earlier wall launcher variants  
- `blanket-safari*`, `blanket-chrome-displays*` — full-desktop blanket experiments (largely superseded by role-per-screen)

---

## Architecture (software)

### Routing

- `orb-platform/src/App.tsx` — if `parseWallRole()` is set and hash is `#/mirror`, render `ThirdStationWall` instead of normal `ThirdStation`.
- `orb-platform/src/lib/wallRole.ts` — roles, measured panels, `measuredPanelForRole()`.
- `orb-platform/src/lib/wallMode.ts` — crop math (`wallModeTransform`) for panel → viewport.
- Abandoned primary approach: single UI stretched with `?wall=1&wallW=…` (`WallModeViewport`). Kept for reference; **role mode is the install path**.

### Phase sync

**File:** `orb-platform/src/lib/wallPhaseSync.ts`

- Channel: `hons-station3-wall-phase`
- **Conductor:** `wallRole=debra`
- Followers only apply messages; they do not advance timers.
- Wall timing (`WALL_TIMING`): intro 3s, prompt 3s, countdown steps 0.8s, recording 6s, **loading 65s**.
- Each `loading` cycle mints a **`photobashSeed`** (random int) and broadcasts it so all panels pick the **same** random shard subset and glitch schedule.

### Role UI

**File:** `orb-platform/src/components/ThirdStationWall.tsx` (+ `.css`)

Role panels during non-loading phases (code readout, Debra voice/progress, copy, guide, etc.). On `phase === 'loading'`, all roles render `WallFaceBlanket`.

### Face blanket (shared image across monitors)

**Files:**

- `orb-platform/src/components/WallFaceBlanket.tsx` / `.css`
- Uses `measuredPanelForRole` + `wallModeTransform` so each window shows only its slice of a shared wall-sized canvas.
- Portrait plate size constant: `MATCH_FACE_SIZE` = **864×960**, cover-scaled onto the wall bounds.

### Photobash + glitch

**File:** `orb-platform/src/lib/wallMatchPhotobash.ts`

| Asset | Path |
| --- | --- |
| Match (woman) | `orb-platform/public/assets/wall-avatar/match-face.png` |
| Visitor (operator photo) | `orb-platform/public/assets/wall-avatar/visitor-face.jpg` |

**Pipeline:**

1. **Align** visitor onto match plate with `DEFAULT_VISITOR_ALIGN` (tuned on `#/face-align`):

   ```json
   { "scale": 1.62, "offsetX": -0.00938, "offsetY": -0.17378 }
   ```

   Override per browser via `localStorage` key `hons-wall-visitor-align` (Save on align tool). Wall Chrome app windows share a profile if launched as the same user — Save once on that machine if tweaking live.

2. **Shard pool** — ~11 irregular polygons (eye, nose, mouth halves, cheeks, brow, chin, temple…).
3. **`pickRevealShards(seed)`** — each cycle picks **4–6** shards (seeded Fisher–Yates).
4. **`composeWallMatchPhotobash`** — draws match base, clips visitor into chosen shards (no black stroke outlines). Returns a JPEG data URL (**pre-merged plate**).
5. **Reveal UX** (`WallFaceBlanket`):
   - Show **clean match only** for `MATCH_HOLD_MS` (6s).
   - Then **`glitchShowMergedAt(elapsed, seed)`** drives choppy on/off of the merged plate (bursts + flicker + late holds), with CSS jitter/tear on hot frames (`WallFaceBlanket.css`).

### Face lineup tool

- Route: `#/face-align` (`WallFaceAlignTool.tsx`)
- Drag to pan, scroll to scale, onion skin + shard guide overlays.
- **Save** → localStorage; **Copy JSON** → paste into `DEFAULT_VISITOR_ALIGN` for a permanent bake in repo.

---

## Key file map

```text
orb-platform/src/
  App.tsx                          # wallRole → ThirdStationWall; #/face-align
  lib/wallRole.ts                  # roles + MEASURED_WALL_PANELS
  lib/wallMode.ts                  # crop / cover transforms
  lib/wallPhaseSync.ts             # BroadcastChannel conductor + WALL_TIMING + seed
  lib/wallMatchPhotobash.ts        # align, shards, compose, glitch gate
  components/ThirdStationWall.*    # role UI + loading → blanket
  components/WallFaceBlanket.*     # wall crop + match/merge glitch
  components/WallFaceAlignTool.*   # manual lineup UI
public/assets/wall-avatar/
  match-face.png
  visitor-face.jpg
scripts/
  blanket-station3-wall-measured.applescript   # install launcher
```

---

## Known issues / open polish

1. **Visitor lineup on the big wall** still felt off at times even after `#/face-align` bake — wall **cover-scale** of a tight portrait onto a huge irregular canvas changes how features read. Prefer re-tuning on the **actual wall** (Save on Studio Chrome) or baking a higher-res precomposed PNG if runtime canvas quality is insufficient.
2. **Glitch aesthetic** is intentional but tunable: `MATCH_HOLD_MS`, `PHOTOBASH_GLITCH_MS`, and `glitchShowMergedAt` in `wallMatchPhotobash.ts`; CSS in `WallFaceBlanket.css`.
3. **Sync scope:** `BroadcastChannel` only works across windows of the **same browser profile on the same machine**. Separate devices will not sync.
4. **Do not use macOS Full Screen** for these windows; chromeless `--app=` + explicit bounds is the supported path.
5. TypeScript: prefer widening numeric constants (`: number`) when using them as `useState` / default params — `as const` literals previously broke Vercel (`SetStateAction<6>` style errors).

---

## Suggested next steps for a new owner

1. Pull / open live deploy; run the **gitless launch script** on the Mac Studio; confirm six roles and phase lock.
2. Open `#/face-align` on the Studio, re-check lineup against the wall, Save or bake new `DEFAULT_VISITOR_ALIGN`.
3. If fragment composition should be “one perfect merge” rather than runtime canvas: pre-render a PNG in tooling and swap `composeWallMatchPhotobash` for a static asset (+ optional second glitch asset).
4. If displays move: remeasure → update `wallRole.ts` + measured AppleScript together.
5. Keep wall timing / photobash changes behind the wall path so kiosk / single-screen `#/mirror` stays usable.

---

## Quick verification checklist

- [ ] Six Chrome `--app=` windows, one per display, correct roles in URL  
- [ ] Debra advances phases; other panels follow within ~1 frame of BroadcastChannel  
- [ ] On loading: all panels show the **same** face crop (seams align across bezels)  
- [ ] ~6s clean woman, then irregular flashes of visitor shards  
- [ ] New loading loop → different shard subset (new seed) but still identical across screens  
- [ ] `#/face-align` Save affects subsequent wall compose on that browser  

---

## Glossary

| Term | Meaning |
| --- | --- |
| **wallRole** | Query param selecting which Station III panel UI to render |
| **Conductor** | Debra panel; owns timers and publishes phase + `photobashSeed` |
| **Face blanket** | Shared portrait cover-scaled to wall; each display shows a crop |
| **Match face** | Generated / chosen woman still (`match-face.png`) |
| **Visitor face** | Operator photo (`visitor-face.jpg`) |
| **Photobash** | Puzzle-shard composite of visitor over match |
| **Glitch reveal** | Hold match, then choppy swap to pre-merged photobash |
