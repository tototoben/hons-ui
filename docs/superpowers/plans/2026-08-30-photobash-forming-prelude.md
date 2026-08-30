# Photobash Forming Prelude Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play a 4s fleshy-rectangle forming beat on the collage wall before the existing photobash photos appear, with PARTNER FORMING on Debra, then hard-cut into `WallCollageBlanket`.

**Architecture:** Pure helpers in `wallForming.ts` derive tile motion from the existing `loadingProgress` fill (0→1 over `PHOTOBASH_FILL_MS`). `WallFormingBlanket` paints `collageRects` in mixed-bruise fills on the same wall-crop plate as the collage. `ThirdStationWall` and `PhotobashScreen` switch on `pickWallLoadingSurface`. No new BroadcastChannel message.

**Tech Stack:** React 19, TypeScript 5.9, Canvas 2D, Vitest 4, Vite 8, jsdom runtime tests.

**Spec:** `docs/superpowers/specs/2026-08-30-photobash-forming-prelude-design.md`

## Global Constraints

- Execute in worktree `/Users/martin/ars-electronica/.worktrees/ars-production-build` on branch `ars-production-build`. Current `main` does not have the collage stack.
- Do not change `PHOTOBASH_FILL_MS` (must stay `4000`) or `PHOTOBASH_CYCLE_MS`.
- Do not modify `WallFaceBlanket`, lip sprites, collage composition, or MATCH LOCKED.
- No em dashes in UI copy. Caption text is exactly `PARTNER FORMING`.
- Tile clocks must use `loadingProgress * PHOTOBASH_FILL_MS`, not a local animation start time.
- Stage only task-owned files. Copy the spec into this worktree’s `docs/superpowers/specs/` if it is missing before the first commit that needs it.
- Run tests from `orb-platform/` with `npm test -- <path>`.

### File map

| File | Responsibility |
| --- | --- |
| `orb-platform/src/lib/wallForming.ts` | Pure forming math, caption/surface gates, `drawWallForming` |
| `orb-platform/src/lib/wallForming.test.ts` | Unit tests for those helpers |
| `orb-platform/src/components/WallFormingBlanket.tsx` | Wall-crop canvas + optional caption; warms face-bank cache |
| `orb-platform/src/components/WallFormingBlanket.css` | Forming canvas background + caption chip |
| `orb-platform/src/components/WallFormingBlanket.runtime.test.tsx` | Debra vs copy caption |
| `orb-platform/src/components/WallFormingBlanket.css.test.ts` | Caption chip styles |
| `orb-platform/src/components/ThirdStationWall.tsx` | Loading-phase surface switch |
| `orb-platform/src/components/PhotobashScreen.tsx` | Loop surface switch + null-role caption |
| `orb-platform/src/components/PhotobashScreen.runtime.test.tsx` | Progress 0 → forming, progress 1 → collage |

---

### Task 1: Forming helpers

**Files:**
- Create: `orb-platform/src/lib/wallForming.ts`
- Test: `orb-platform/src/lib/wallForming.test.ts`

**Interfaces:**
- Consumes: `PHOTOBASH_FILL_MS` from `./photobashLoop`, `collageRects` / `visitorRevealOrder` / `CollageRect` from `./wallCollagePhotobash`, `WallRole` from `./wallRole`, `mulberry32` is not needed if shuffle goes through `visitorRevealOrder`.
- Produces: `FLESH_SWATCHES`, `FORMING_COPY`, `FORMING_STAGGER_MS`, `FORMING_TILE_MS`, `FORMING_FROM_SCALE`, `FORMING_PLATE_BG`, `fleshFillForRect`, `formingStagger`, `formingElapsedMs`, `formingTileOpacity`, `formingTileScale`, `shouldShowForming`, `shouldShowFormingCaption`, `pickWallLoadingSurface`, `drawWallForming`.

- [ ] **Step 1: Write the failing test**

Create `orb-platform/src/lib/wallForming.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { PHOTOBASH_FILL_MS } from './photobashLoop'
import { collageRects } from './wallCollagePhotobash'
import {
  FLESH_SWATCHES,
  FORMING_COPY,
  FORMING_FROM_SCALE,
  FORMING_STAGGER_MS,
  FORMING_TILE_MS,
  fleshFillForRect,
  formingElapsedMs,
  formingStagger,
  formingTileOpacity,
  formingTileScale,
  pickWallLoadingSurface,
  shouldShowForming,
  shouldShowFormingCaption,
} from './wallForming'

describe('wallForming', () => {
  it('keeps the locked mixed-bruise swatch list', () => {
    expect([...FLESH_SWATCHES]).toEqual([
      '#e8b48c',
      '#c97a6e',
      '#d4a574',
      '#8e5a58',
      '#f0c4b0',
      '#a07068',
      '#d4927a',
      '#b86b5c',
      '#c4a080',
    ])
  })

  it('uses PARTNER FORMING as the only forming copy', () => {
    expect(FORMING_COPY).toBe('PARTNER FORMING')
  })

  it('assigns the same swatch for the same seed and index', () => {
    expect(fleshFillForRect(7, 0)).toBe(fleshFillForRect(7, 0))
    expect(FLESH_SWATCHES).toContain(fleshFillForRect(7, 0))
  })

  it('staggers every rect inside the 2500ms window, stably', () => {
    const rects = collageRects(1)
    const a = formingStagger(1, rects.length)
    const b = formingStagger(1, rects.length)
    expect(a).toEqual(b)
    expect(a).toHaveLength(rects.length)
    expect(new Set(a).size).toBe(rects.length)
    a.forEach((delay) => {
      expect(delay).toBeGreaterThanOrEqual(0)
      expect(delay).toBeLessThanOrEqual(FORMING_STAGGER_MS)
    })
    expect(Math.min(...a)).toBe(0)
    expect(Math.max(...a)).toBe(FORMING_STAGGER_MS)
  })

  it('maps loadingProgress onto the 4s fill clock', () => {
    expect(formingElapsedMs(0)).toBe(0)
    expect(formingElapsedMs(0.5)).toBe(PHOTOBASH_FILL_MS / 2)
    expect(formingElapsedMs(1)).toBe(PHOTOBASH_FILL_MS)
    expect(formingElapsedMs(2)).toBe(PHOTOBASH_FILL_MS)
    expect(formingElapsedMs(-1)).toBe(0)
  })

  it('keeps a tile invisible before its delay and settled after the ease', () => {
    expect(formingTileOpacity(0, 1000)).toBe(0)
    expect(formingTileOpacity(1000, 1000)).toBe(0)
    expect(formingTileOpacity(1000 + FORMING_TILE_MS, 1000)).toBe(1)
    expect(formingTileScale(0, 1000)).toBe(FORMING_FROM_SCALE)
    expect(formingTileScale(1000 + FORMING_TILE_MS, 1000)).toBe(1)
  })

  it('shows forming only while progress is below 1', () => {
    expect(shouldShowForming(0)).toBe(true)
    expect(shouldShowForming(0.99)).toBe(true)
    expect(shouldShowForming(1)).toBe(false)
  })

  it('shows the caption on Debra and on a null Photobash role only', () => {
    expect(shouldShowFormingCaption('debra')).toBe(true)
    expect(shouldShowFormingCaption(null)).toBe(true)
    expect(shouldShowFormingCaption('copy')).toBe(false)
    expect(shouldShowFormingCaption('guide')).toBe(false)
    expect(shouldShowFormingCaption('code')).toBe(false)
    expect(shouldShowFormingCaption('status')).toBe(false)
    expect(shouldShowFormingCaption('avatar')).toBe(false)
  })

  it('picks forming, collage, or the old face blanket from collage+progress', () => {
    expect(pickWallLoadingSurface(false, 0)).toBe('face')
    expect(pickWallLoadingSurface(false, 1)).toBe('face')
    expect(pickWallLoadingSurface(true, 0)).toBe('forming')
    expect(pickWallLoadingSurface(true, 0.5)).toBe('forming')
    expect(pickWallLoadingSurface(true, 1)).toBe('collage')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/martin/ars-electronica/.worktrees/ars-production-build/orb-platform && npm test -- src/lib/wallForming.test.ts
```

Expected: FAIL with `Cannot find module './wallForming'` (or equivalent).

- [ ] **Step 3: Write minimal implementation**

Create `orb-platform/src/lib/wallForming.ts`:

```ts
import { PHOTOBASH_FILL_MS } from './photobashLoop'
import { visitorRevealOrder, type CollageRect } from './wallCollagePhotobash'
import type { WallRole } from './wallRole'

export const FLESH_SWATCHES = [
  '#e8b48c',
  '#c97a6e',
  '#d4a574',
  '#8e5a58',
  '#f0c4b0',
  '#a07068',
  '#d4927a',
  '#b86b5c',
  '#c4a080',
] as const

export const FORMING_COPY = 'PARTNER FORMING'
export const FORMING_STAGGER_MS = 2500
export const FORMING_TILE_MS = 600
export const FORMING_FROM_SCALE = 0.96
export const FORMING_PLATE_BG = '#120d0a'

export function fleshFillForRect(seed: number, index: number): string {
  const order = visitorRevealOrder(seed + 3, FLESH_SWATCHES.length)
  return FLESH_SWATCHES[order[index % order.length]]
}

export function formingStagger(seed: number, rectCount: number): number[] {
  const order = visitorRevealOrder(seed + 17, rectCount)
  const last = Math.max(1, rectCount - 1)
  const delays = new Array<number>(rectCount)
  order.forEach((rectIndex, rank) => {
    delays[rectIndex] = (rank / last) * FORMING_STAGGER_MS
  })
  return delays
}

export function formingElapsedMs(loadingProgress: number, fillMs: number = PHOTOBASH_FILL_MS) {
  return Math.max(0, Math.min(1, loadingProgress)) * fillMs
}

export function formingTileOpacity(elapsedMs: number, delayMs: number) {
  return Math.max(0, Math.min(1, (elapsedMs - delayMs) / FORMING_TILE_MS))
}

export function formingTileScale(elapsedMs: number, delayMs: number) {
  const t = formingTileOpacity(elapsedMs, delayMs)
  return FORMING_FROM_SCALE + (1 - FORMING_FROM_SCALE) * t
}

export function shouldShowForming(loadingProgress: number) {
  return loadingProgress < 1
}

export function shouldShowFormingCaption(role: WallRole | null) {
  return role === 'debra' || role === null
}

export function pickWallLoadingSurface(
  collage: boolean,
  loadingProgress: number,
): 'forming' | 'collage' | 'face' {
  if (!collage) return 'face'
  return shouldShowForming(loadingProgress) ? 'forming' : 'collage'
}

export type DrawWallFormingOptions = {
  width: number
  height: number
  rects: CollageRect[]
  seed: number
  elapsedMs: number
}

export function drawWallForming(
  ctx: CanvasRenderingContext2D,
  { width, height, rects, seed, elapsedMs }: DrawWallFormingOptions,
) {
  const delays = formingStagger(seed, rects.length)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = FORMING_PLATE_BG
  ctx.fillRect(0, 0, width, height)

  rects.forEach((rect, index) => {
    const opacity = formingTileOpacity(elapsedMs, delays[index])
    if (opacity <= 0) return
    const scale = formingTileScale(elapsedMs, delays[index])
    const x = rect.x * width
    const y = rect.y * height
    const w = rect.w * width
    const h = rect.h * height
    const cx = x + w / 2
    const cy = y + h / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    ctx.translate(-cx, -cy)
    ctx.globalAlpha = opacity
    ctx.fillStyle = fleshFillForRect(seed, index)
    ctx.fillRect(x, y, w, h)
    ctx.restore()
  })

  ctx.save()
  ctx.strokeStyle = 'rgba(8, 6, 4, 0.35)'
  ctx.lineWidth = Math.max(1, width * 0.0015)
  rects.forEach((rect, index) => {
    const opacity = formingTileOpacity(elapsedMs, delays[index])
    if (opacity <= 0) return
    ctx.globalAlpha = opacity
    ctx.strokeRect(rect.x * width, rect.y * height, rect.w * width, rect.h * height)
  })
  ctx.restore()
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run:

```bash
cd /Users/martin/ars-electronica/.worktrees/ars-production-build/orb-platform && npm test -- src/lib/wallForming.test.ts
```

Expected: PASS, all tests in `wallForming.test.ts`.

- [ ] **Step 5: Commit**

Run (from the production worktree root):

```bash
git add orb-platform/src/lib/wallForming.ts orb-platform/src/lib/wallForming.test.ts
git commit -m "$(cat <<'EOF'
feat: add photobash forming prelude helpers

EOF
)"
```

---

### Task 2: WallFormingBlanket

**Files:**
- Create: `orb-platform/src/components/WallFormingBlanket.tsx`
- Create: `orb-platform/src/components/WallFormingBlanket.css`
- Test: `orb-platform/src/components/WallFormingBlanket.runtime.test.tsx`
- Test: `orb-platform/src/components/WallFormingBlanket.css.test.ts`

**Interfaces:**
- Consumes: `collageRects` from `../lib/wallCollagePhotobash`, `MATCH_FACE_SIZE` from `../lib/wallMatchPhotobash`, `measuredPanelForRole` / `WallRole` from `../lib/wallRole`, `panelFitScale` / `wallModeTransform` from `../lib/wallMode`, `loadFaceBankImages` from `../lib/faceBank`, `drawWallForming` / `formingElapsedMs` / `FORMING_COPY` from `../lib/wallForming`.
- Produces: `WallFormingBlanket({ role, photobashSeed, loadingProgress, showCaption })`.

- [ ] **Step 1: Write the failing runtime and CSS tests**

Create `orb-platform/src/components/WallFormingBlanket.runtime.test.tsx`:

```tsx
// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FORMING_COPY } from '../lib/wallForming'
import { WallFormingBlanket } from './WallFormingBlanket'

vi.mock('../lib/faceBank', () => ({
  loadFaceBankImages: () => Promise.resolve([]),
}))

describe('WallFormingBlanket', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('shows PARTNER FORMING on Debra and paints a forming canvas', () => {
    act(() =>
      root.render(
        <WallFormingBlanket role="debra" photobashSeed={1} loadingProgress={0} showCaption />,
      ),
    )
    expect(container.querySelector('.wall-forming-caption')?.textContent).toBe(FORMING_COPY)
    expect(container.querySelector('canvas.wall-forming-canvas')).not.toBeNull()
  })

  it('hides the caption on copy', () => {
    act(() =>
      root.render(
        <WallFormingBlanket role="copy" photobashSeed={1} loadingProgress={0} showCaption={false} />,
      ),
    )
    expect(container.querySelector('.wall-forming-caption')).toBeNull()
    expect(container.querySelector('canvas.wall-forming-canvas')).not.toBeNull()
  })
})
```

Create `orb-platform/src/components/WallFormingBlanket.css.test.ts`:

```ts
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import formingStyles from './WallFormingBlanket.css?raw'

describe('WallFormingBlanket caption', () => {
  afterEach(() => {
    document.head.replaceChildren()
    document.body.replaceChildren()
  })

  it('uses fleshy uppercase tracking, not the cream MATCH LOCKED chip', () => {
    const style = document.createElement('style')
    style.textContent = formingStyles
    document.head.append(style)

    const chip = document.createElement('div')
    chip.className = 'wall-forming-caption'
    document.body.append(chip)

    const computed = getComputedStyle(chip)
    expect(computed.letterSpacing).toBe('0.18em')
    expect(computed.textTransform).toBe('uppercase')
    expect(computed.color).toBe('rgb(242, 200, 180)')
    expect(formingStyles).toContain('#f2c8b4')
    expect(formingStyles).not.toContain('255, 244, 232')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd /Users/martin/ars-electronica/.worktrees/ars-production-build/orb-platform && npm test -- src/components/WallFormingBlanket.runtime.test.tsx src/components/WallFormingBlanket.css.test.ts
```

Expected: FAIL resolving `./WallFormingBlanket` / missing CSS module.

- [ ] **Step 3: Write the component**

Create `orb-platform/src/components/WallFormingBlanket.css`:

```css
.wall-forming-canvas {
  background: #120d0a;
}

.wall-forming-caption {
  position: absolute;
  left: 50%;
  bottom: 4%;
  z-index: 2;
  transform: translateX(-50%);
  padding: 8px 14px;
  border: 1px solid rgba(242, 200, 180, 0.28);
  background: rgba(8, 6, 4, 0.42);
  font: 500 11px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #f2c8b4;
  text-shadow: 0 0 10px rgba(232, 180, 164, 0.55);
  pointer-events: none;
  animation: wall-forming-caption-glow 2.4s ease-in-out infinite;
}

@keyframes wall-forming-caption-glow {
  0%,
  100% {
    opacity: 0.65;
  }
  50% {
    opacity: 1;
  }
}
```

Create `orb-platform/src/components/WallFormingBlanket.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { loadFaceBankImages } from '../lib/faceBank'
import { collageRects } from '../lib/wallCollagePhotobash'
import {
  drawWallForming,
  formingElapsedMs,
  FORMING_COPY,
} from '../lib/wallForming'
import { MATCH_FACE_SIZE } from '../lib/wallMatchPhotobash'
import { panelFitScale, wallModeTransform } from '../lib/wallMode'
import { measuredPanelForRole, type WallRole } from '../lib/wallRole'
import './WallFaceBlanket.css'
import './WallFormingBlanket.css'

export function WallFormingBlanket({
  role,
  photobashSeed = 1,
  loadingProgress,
  showCaption = false,
}: {
  role: WallRole
  photobashSeed?: number
  loadingProgress: number
  showCaption?: boolean
}) {
  const seed = photobashSeed || 1
  const panel = measuredPanelForRole(role)
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rects = useMemo(() => collageRects(seed), [seed])

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    void loadFaceBankImages()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    drawWallForming(ctx, {
      width: canvas.width,
      height: canvas.height,
      rects,
      seed,
      elapsedMs: formingElapsedMs(loadingProgress),
    })
  }, [loadingProgress, rects, seed])

  const layout = useMemo(() => {
    if (!panel) return null
    const crop = wallModeTransform(
      {
        wallWidth: panel.wallWidth,
        wallHeight: panel.wallHeight,
        panelX: panel.panelX,
        panelY: panel.panelY,
        panelWidth: panel.panelWidth,
        panelHeight: panel.panelHeight,
      },
      panel.panelWidth,
      panel.panelHeight,
    )
    const fitScale = panelFitScale(panel.panelWidth, panel.panelHeight, viewport.width, viewport.height)
    const coverScale = Math.max(
      panel.wallWidth / MATCH_FACE_SIZE.width,
      panel.wallHeight / MATCH_FACE_SIZE.height,
    )
    const faceW = MATCH_FACE_SIZE.width * coverScale
    const faceH = MATCH_FACE_SIZE.height * coverScale
    return {
      crop,
      fitScale,
      panelWidth: panel.panelWidth,
      panelHeight: panel.panelHeight,
      faceW,
      faceH,
      faceX: (panel.wallWidth - faceW) / 2,
      faceY: (panel.wallHeight - faceH) / 2,
    }
  }, [panel, viewport.height, viewport.width])

  if (!panel || !layout) return null

  const faceStyle = {
    width: layout.faceW,
    height: layout.faceH,
    left: layout.faceX,
    top: layout.faceY,
  }

  return (
    <div className="wall-face-blanket wall-forming-blanket" aria-label="Partner forming">
      <div
        className="wall-face-fit"
        style={{
          width: layout.panelWidth,
          height: layout.panelHeight,
          transform: `scale(${layout.fitScale})`,
        }}
      >
        <div
          className="wall-face-canvas"
          style={{
            width: layout.crop.wallWidth,
            height: layout.crop.wallHeight,
            transform: `translate(${layout.crop.translateX}px, ${layout.crop.translateY}px)`,
          }}
        >
          <canvas
            ref={canvasRef}
            width={MATCH_FACE_SIZE.width}
            height={MATCH_FACE_SIZE.height}
            className="wall-face-image wall-forming-canvas"
            style={faceStyle}
          />
        </div>
      </div>
      {showCaption ? <div className="wall-forming-caption">{FORMING_COPY}</div> : null}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run:

```bash
cd /Users/martin/ars-electronica/.worktrees/ars-production-build/orb-platform && npm test -- src/components/WallFormingBlanket.runtime.test.tsx src/components/WallFormingBlanket.css.test.ts src/lib/wallForming.test.ts
```

Expected: PASS. If `getComputedStyle` color is not `rgb(242, 200, 180)` in this jsdom, assert via the raw CSS string only and keep the letter-spacing / text-transform checks.

- [ ] **Step 5: Commit**

```bash
git add orb-platform/src/components/WallFormingBlanket.tsx \
  orb-platform/src/components/WallFormingBlanket.css \
  orb-platform/src/components/WallFormingBlanket.runtime.test.tsx \
  orb-platform/src/components/WallFormingBlanket.css.test.ts
git commit -m "$(cat <<'EOF'
feat: render fleshy collage rects for the forming prelude

EOF
)"
```

---

### Task 3: Station III wall gate

**Files:**
- Modify: `orb-platform/src/components/ThirdStationWall.tsx` (loading branch around the current `collage ? WallCollageBlanket : WallFaceBlanket` ternary)

**Interfaces:**
- Consumes: `pickWallLoadingSurface` / `shouldShowFormingCaption` from `../lib/wallForming`, `WallFormingBlanket`.
- Produces: loading phase mounts forming while `loadingProgress < 1` in collage mode.

- [ ] **Step 1: Write a failing unit test for the gate already covered by Task 1, then wire the call site**

No new helper test is needed if Task 1 passed. Add the imports and replace the loading branch in `ThirdStationWall.tsx`.

Current:

```tsx
{calibrate ? null : phase === 'loading' ? (
  collage ? (
    <WallCollageBlanket role={role} photobashSeed={photobashSeed} />
  ) : (
    <WallFaceBlanket role={role} photobashSeed={photobashSeed} />
  )
) : (
```

Replace with:

```tsx
{calibrate ? null : phase === 'loading' ? (
  pickWallLoadingSurface(collage, loadingProgress) === 'forming' ? (
    <WallFormingBlanket
      role={role}
      photobashSeed={photobashSeed}
      loadingProgress={loadingProgress}
      showCaption={shouldShowFormingCaption(role)}
    />
  ) : pickWallLoadingSurface(collage, loadingProgress) === 'collage' ? (
    <WallCollageBlanket role={role} photobashSeed={photobashSeed} />
  ) : (
    <WallFaceBlanket role={role} photobashSeed={photobashSeed} />
  )
) : (
```

Add imports at the top of `ThirdStationWall.tsx`:

```tsx
import { WallFormingBlanket } from './WallFormingBlanket'
import { pickWallLoadingSurface, shouldShowFormingCaption } from '../lib/wallForming'
```

Call `pickWallLoadingSurface` once into a local in the component body (before the return) to avoid evaluating it twice:

```tsx
  const loadingSurface = pickWallLoadingSurface(collage, loadingProgress)
```

Then switch on `loadingSurface` in the JSX (`'forming'` / `'collage'` / `'face'`).

- [ ] **Step 2: Run existing wall tests plus forming tests**

Run:

```bash
cd /Users/martin/ars-electronica/.worktrees/ars-production-build/orb-platform && npm test -- src/lib/wallForming.test.ts src/lib/wallCollagePhotobash.test.ts src/lib/photobashLoop.test.ts src/components/WallFormingBlanket.runtime.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Typecheck**

Run:

```bash
cd /Users/martin/ars-electronica/.worktrees/ars-production-build/orb-platform && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add orb-platform/src/components/ThirdStationWall.tsx
git commit -m "$(cat <<'EOF'
feat: play forming prelude before station III collage

EOF
)"
```

---

### Task 4: PhotobashScreen loop gate

**Files:**
- Modify: `orb-platform/src/components/PhotobashScreen.tsx`
- Test: `orb-platform/src/components/PhotobashScreen.runtime.test.tsx`

**Interfaces:**
- Consumes: `loadingProgress` from `usePhotobashLoop`, `pickWallLoadingSurface` / `shouldShowFormingCaption`, `WallFormingBlanket`.
- Produces: every 65s cycle starts with 4s forming; null `wallRole` still shows the caption.

- [ ] **Step 1: Write the failing runtime test**

Create `orb-platform/src/components/PhotobashScreen.runtime.test.tsx`:

```tsx
// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loop = vi.hoisted(() => ({
  photobashSeed: 1,
  loadingProgress: 0,
}))

vi.mock('../lib/wallPhaseSync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/wallPhaseSync')>()
  return {
    ...actual,
    usePhotobashLoop: () => loop,
  }
})

vi.mock('../lib/faceBank', () => ({
  loadFaceBankImages: () => Promise.resolve([]),
}))

import { PhotobashScreen } from './PhotobashScreen'
import { FORMING_COPY } from '../lib/wallForming'

describe('PhotobashScreen forming prelude', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    loop.loadingProgress = 0
    loop.photobashSeed = 1
    window.history.replaceState({}, '', '/?collage=1')
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    window.history.replaceState({}, '', '/')
  })

  it('mounts forming with PARTNER FORMING when wallRole is missing', () => {
    act(() => root.render(<PhotobashScreen />))
    expect(container.querySelector('.wall-forming-caption')?.textContent).toBe(FORMING_COPY)
    expect(container.querySelector('.wall-forming-canvas')).not.toBeNull()
    expect(container.querySelector('.wall-collage-canvas')).toBeNull()
  })

  it('cuts to collage once loadingProgress reaches 1', () => {
    loop.loadingProgress = 1
    act(() => root.render(<PhotobashScreen />))
    expect(container.querySelector('.wall-forming-canvas')).toBeNull()
    expect(container.querySelector('.wall-collage-canvas')).not.toBeNull()
    expect(container.querySelector('.wall-forming-caption')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/martin/ars-electronica/.worktrees/ars-production-build/orb-platform && npm test -- src/components/PhotobashScreen.runtime.test.tsx
```

Expected: FAIL (forming canvas/caption missing; collage mounted at progress 0).

- [ ] **Step 3: Wire PhotobashScreen**

Replace `orb-platform/src/components/PhotobashScreen.tsx` with:

```tsx
import { useEffect } from 'react'
import { parseWallCollage, parseWallRole } from '../lib/wallRole'
import { usePhotobashLoop } from '../lib/wallPhaseSync'
import { pickWallLoadingSurface, shouldShowFormingCaption } from '../lib/wallForming'
import { WallCollageBlanket } from './WallCollageBlanket'
import { WallFaceBlanket } from './WallFaceBlanket'
import { WallFormingBlanket } from './WallFormingBlanket'
import './DeviceUnlockLayer.css'

export function PhotobashScreen() {
  const role = parseWallRole()
  const collage = parseWallCollage()
  const isConductor = role === 'debra' || role === null
  const { photobashSeed, loadingProgress } = usePhotobashLoop(isConductor)
  const crop = role ?? 'copy'
  const surface = pickWallLoadingSurface(collage, loadingProgress)

  useEffect(() => {
    document.documentElement.dataset.wallMode = 'true'
    document.documentElement.dataset.wallRole = crop
    return () => {
      delete document.documentElement.dataset.wallMode
      delete document.documentElement.dataset.wallRole
    }
  }, [crop])

  return (
    <section className="photobash-screen" aria-label="Photobash reveal">
      {surface === 'forming' ? (
        <WallFormingBlanket
          role={crop}
          photobashSeed={photobashSeed}
          loadingProgress={loadingProgress}
          showCaption={shouldShowFormingCaption(role)}
        />
      ) : surface === 'collage' ? (
        <WallCollageBlanket role={crop} photobashSeed={photobashSeed} />
      ) : (
        <WallFaceBlanket role={crop} photobashSeed={photobashSeed} />
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
cd /Users/martin/ars-electronica/.worktrees/ars-production-build/orb-platform && npm test -- src/components/PhotobashScreen.runtime.test.tsx src/components/WallFormingBlanket.runtime.test.tsx src/lib/wallForming.test.ts
```

Expected: PASS.

- [ ] **Step 5: Full orb-platform test + typecheck**

Run:

```bash
cd /Users/martin/ars-electronica/.worktrees/ars-production-build/orb-platform && npm test && npx tsc --noEmit
```

Expected: all tests PASS, `tsc` exit 0.

- [ ] **Step 6: Commit**

```bash
git add orb-platform/src/components/PhotobashScreen.tsx \
  orb-platform/src/components/PhotobashScreen.runtime.test.tsx
git commit -m "$(cat <<'EOF'
feat: start each photobash loop with the forming prelude

EOF
)"
```

---

### Task 5: Land the spec on the production branch

**Files:**
- Create (on this branch, copied from the main workspace if needed): `docs/superpowers/specs/2026-08-30-photobash-forming-prelude-design.md`
- Create: `docs/superpowers/plans/2026-08-30-photobash-forming-prelude.md`

- [ ] **Step 1: Copy docs into the production worktree if they are not already there**

```bash
cp /Users/martin/ars-electronica/docs/superpowers/specs/2026-08-30-photobash-forming-prelude-design.md \
  /Users/martin/ars-electronica/.worktrees/ars-production-build/docs/superpowers/specs/
cp /Users/martin/ars-electronica/docs/superpowers/plans/2026-08-30-photobash-forming-prelude.md \
  /Users/martin/ars-electronica/.worktrees/ars-production-build/docs/superpowers/plans/
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-08-30-photobash-forming-prelude-design.md \
  docs/superpowers/plans/2026-08-30-photobash-forming-prelude.md
git commit -m "$(cat <<'EOF'
docs: spec and plan the photobash forming prelude

EOF
)"
```

---

## Browser check (after all tasks)

On the production worktree: `cd orb-platform && npm run dev`, open `#/photobash` (or the DevicePicker Photobash lock). Confirm ~4s fleshy rects + PARTNER FORMING, then the existing collage. Then `#/wall-sim` with collage on: only the Debra iframe shows the chip; all six panels share the same tiles; at 4s they cut together.
