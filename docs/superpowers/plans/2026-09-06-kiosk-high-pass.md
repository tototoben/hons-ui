# Kiosk High-Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop per-tick React state in the mirror camera, delete unused GridScan-cluster source, and rewrite handoff docs — without changing station visuals.

**Architecture:** MediaPipe detect writes a `sampleRef`. `MirrorCameraLayer` paints overlay, CSS pose vars, appearance HUD, and visitor-face capture from that ref. Dead files with no production importer are deleted. Docs are brought in line with the tree.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 4, MediaPipe Tasks Vision. No new npm dependencies.

## Global Constraints

- Do not change CSS rules, UI copy, overlay geometry, pose formulas, or appearance markup.
- Overlay, CSS custom properties, and appearance readout must still update from each detect sample using the same values as today.
- Do not restore Debra speech. No `DebraVoice` component.
- Do not change webcam lifetime. Overlay mode `none` still keeps the live mirror and skips MediaPipe.
- Do not delete `orb-ui/`, Debra MP3s, persona PNGs, or any file imported by a live station / photobash / AvatarStation.
- Do not add npm dependencies.
- Work on branch `feat/kiosk-high-pass`, not `main`.
- Commit after each task. Do not push.

---

### Task 1: MediaPipe sample ref (no per-tick setState)

**Files:**
- Modify: `orb-platform/src/hooks/useMirrorCamera.ts`
- Modify: `orb-platform/src/hooks/useMirrorCamera.runtime.test.tsx`
- Modify: `orb-platform/src/components/MirrorCameraLayer.tsx`
- Modify: `orb-platform/src/components/MirrorCameraLayer.runtime.test.tsx` (only if the mock must expose `sampleRef`)

**Interfaces:**
- Consumes: existing `FaceLandmarker.detectForVideo`, `deriveMirrorFaceSignals`, `smoothAppearance`
- Produces: `MirrorCameraSample` and `sampleRef` on `MirrorCameraHandle`. Detect ticks do not call `setLandmarks` / `setSignals` / `setAppearance`.

- [ ] **Step 1: Write the failing tests**

In `orb-platform/src/hooks/useMirrorCamera.runtime.test.tsx`, change `Harness` so the test can read the hook handle, and replace the blendshape DOM `data-*` assertions with `sampleRef` reads.

Keep the existing permission / tracking-off cases.

Add this case (render count must not rise on detect frames after `active`):

```ts
  it('does not re-render on each MediaPipe detect tick', async () => {
    const stream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    })
    vision.detectForVideo.mockReturnValue({
      faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
    })
    let renders = 0
    function CountHarness() {
      renders += 1
      useMirrorCamera({ tracking: true })
      return <video />
    }

    await act(async () => {
      root.render(<CountHarness />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    const afterActive = renders

    await act(async () => {
      animationFrames.at(-1)?.(1000)
    })
    await act(async () => {
      animationFrames.at(-1)?.(2000)
    })

    expect(renders).toBe(afterActive)
  })
```

Update the existing `'publishes blendshape and transformation signals from a detected face'` case so after the detect rAF it asserts on the hook's `sampleRef.current.signals` (blink `0.6`, mouthOpen `0.75`, headYaw close to `0.5`) instead of `video.dataset`.

In `MirrorCameraLayer.runtime.test.tsx`, add `sampleRef: { current: { landmarks: camera.landmarks, signals: camera.signals, appearance: camera.appearance } }` to the hoisted mock **or** keep drawing from `camera.landmarks` on first paint so existing stroke/readout tests still pass without rAF. Prefer: layer paints immediately from `sampleRef.current` if present, else from `landmarks` / `signals` / `appearance` on the handle, so the current mock still works if you also copy those fields onto `sampleRef` in the mock.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd orb-platform && npx vitest run src/hooks/useMirrorCamera.runtime.test.tsx src/components/MirrorCameraLayer.runtime.test.tsx
```

Expected: FAIL on the new render-count case because detect still `setState`s. Blendshape case may still pass until you switch it to `sampleRef`.

- [ ] **Step 3: Write minimal implementation**

In `orb-platform/src/hooks/useMirrorCamera.ts`:

Add:

```ts
export type MirrorCameraSample = {
  landmarks: NormalizedLandmark[]
  signals: MirrorFaceSignals
  appearance: FaceAppearance | null
}

const EMPTY_SAMPLE: MirrorCameraSample = {
  landmarks: [],
  signals: NEUTRAL_MIRROR_FACE_SIGNALS,
  appearance: null,
}
```

Add `sampleRef` to `MirrorCameraHandle`.

Replace the three `useState` values for landmarks/signals/appearance with:

```ts
  const sampleRef = useRef<MirrorCameraSample>(EMPTY_SAMPLE)
```

Keep `appearanceRef` for `smoothAppearance` input, or read `sampleRef.current.appearance`.

In the tracking-off branch, set `sampleRef.current = EMPTY_SAMPLE` and `appearanceRef.current = null`. Do not `setState` those fields.

In `detect`, after `detectForVideo`, assign:

```ts
        const nextSignals =
          detectedLandmarks.length > 0
            ? deriveMirrorFaceSignals(
                result.faceBlendshapes?.[0]?.categories,
                result.facialTransformationMatrixes?.[0]?.data,
              )
            : NEUTRAL_MIRROR_FACE_SIGNALS
        let nextAppearance = sampleRef.current.appearance
        if (detectedLandmarks.length >= MIN_APPEARANCE_LANDMARKS) {
          missedFaces = 0
          const derived = appearanceFromLandmarks(video, detectedLandmarks)
          const smoothed = derived
            ? smoothAppearance(appearanceRef.current, derived)
            : null
          appearanceRef.current = smoothed
          nextAppearance = smoothed
        } else {
          missedFaces += 1
          if (missedFaces > 8) {
            appearanceRef.current = null
            nextAppearance = null
          }
        }
        sampleRef.current = {
          landmarks: detectedLandmarks,
          signals: nextSignals,
          appearance: nextAppearance,
        }
```

Do **not** call `setLandmarks`, `setSignals`, or `setAppearance`.

Return value: keep `landmarks`, `signals`, and `appearance` as getters from `sampleRef.current` so existing callers that read them during a React render still see the last sample (stale until something else re-renders). Also return `sampleRef`.

In `orb-platform/src/components/MirrorCameraLayer.tsx`:

- Keep the same `drawLandmarks` function body (no stroke/color/width changes).
- Keep the same CSS custom-property formulas (`computeCameraFocus`, clamp ranges, `* 8` / `* 6` / `* 1.8` pose, tracking-glow).
- Add a `stageRef` on the camera stage div.
- Replace the layout-effect that redraws on `camera.landmarks` with an effect that:
  1. reads `const sample = camera.sampleRef?.current ?? { landmarks: camera.landmarks, signals: camera.signals, appearance: camera.appearance }`
  2. draws immediately (so tests without rAF still see strokes)
  3. schedules `requestAnimationFrame` to repeat while mounted when `mode !== 'none'`
  4. writes the same CSS vars via `element.style.setProperty` on `stageRef`
  5. runs visitor-face capture with the same `FACE_CAPTURE_MIN_LANDMARKS` / `FACE_CAPTURE_INTERVAL_MS` gates
- Appearance HUD: subscribe to `sampleRef` with `useSyncExternalStore` so the existing `<aside className="journey-appearance">` markup still renders the same fields. Do not change labels (`Hair color`, `Eye color`) or swatch markup.

Do not edit `MirrorJourney.css`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd orb-platform && npx vitest run src/hooks/useMirrorCamera.runtime.test.tsx src/components/MirrorCameraLayer.runtime.test.tsx
```

Expected: PASS, including tracking-off and overlay stroke tests.

- [ ] **Step 5: Commit**

```bash
git add orb-platform/src/hooks/useMirrorCamera.ts orb-platform/src/hooks/useMirrorCamera.runtime.test.tsx orb-platform/src/components/MirrorCameraLayer.tsx orb-platform/src/components/MirrorCameraLayer.runtime.test.tsx
git commit -m "$(cat <<'EOF'
perf: keep MediaPipe samples off the React render path

EOF
)"
```

---

### Task 2: Delete unused GridScan cluster and orphaned deps

**Files:**
- Delete: `orb-platform/src/components/GridScan.tsx`
- Delete: `orb-platform/src/components/GridScan.css`
- Delete: `orb-platform/src/components/MorphSlider.tsx`
- Delete: `orb-platform/src/components/MorphSlider.css`
- Delete: `orb-platform/src/components/GlassSurface.tsx`
- Delete: `orb-platform/src/components/GlassSurface.css`
- Delete: `orb-platform/src/components/RoomQuestionCards.tsx`
- Delete: `orb-platform/src/components/TiltedCard.tsx`
- Delete: `orb-platform/src/components/TiltedCard.css`
- Delete: `orb-platform/src/components/AutoCardStack.tsx`
- Delete: `orb-platform/src/components/AutoCardStack.css`
- Delete: `orb-platform/src/components/Room.tsx`
- Delete: `orb-platform/src/components/RoomDissolve.tsx`
- Delete: `orb-platform/src/components/WallAvatarViewer.tsx`
- Delete: `orb-platform/src/components/WallAvatarViewer.css`
- Delete: `orb-platform/src/lib/roomDissolve.ts`
- Delete: `orb-platform/src/lib/roomDissolve.test.ts`
- Delete: `orb-platform/src/lib/autoStack.ts`
- Delete: `orb-platform/src/lib/autoStack.test.ts`
- Delete: `orb-platform/src/lib/cardFlow.ts`
- Delete: `orb-platform/src/lib/cardFlow.test.ts`
- Delete: `orb-platform/src/lib/cardPalette.ts`
- Delete: `orb-platform/src/lib/roomCardLayout.ts`
- Delete: `orb-platform/src/lib/roomCardLayout.test.ts`
- Delete: `orb-platform/src/lib/mirrorPrompt.ts`
- Delete: `orb-platform/src/lib/mirrorPrompt.test.ts`
- Delete: `orb-platform/src/lib/typewriter.ts`
- Delete: `orb-platform/src/lib/typewriter.test.ts`
- Delete: `orb-platform/src/lib/pointTexture.ts`
- Delete: `orb-platform/public/assets/wall-avatar/miku.gltf` (and `miku.bin` / miku textures if present and unreferenced)
- Modify: `orb-platform/package.json` (remove `animejs`, `face-api.js`, `ogl`, `motion`)
- Modify: `orb-platform/src/lib/avatarPortraits.ts` (comment that names MorphSlider → AvatarStation)
- Modify: `orb-platform/src/lib/scanUniforms.ts` (drop “until fully removed” Room comment)

**Interfaces:**
- Consumes: grep confirming no production importer
- Produces: `tsc --noEmit` clean; live station tests still pass

- [ ] **Step 1: Write the failing tests**

Add `orb-platform/src/lib/deadCluster.test.ts`:

```ts
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, '..', 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>
}

describe('dead cluster removal', () => {
  it('removes unused GridScan and orphaned npm packages', () => {
    expect(existsSync(join(root, 'components', 'GridScan.tsx'))).toBe(false)
    expect(existsSync(join(root, 'components', 'MorphSlider.tsx'))).toBe(false)
    expect(existsSync(join(root, 'components', 'Room.tsx'))).toBe(false)
    expect(pkg.dependencies['face-api.js']).toBeUndefined()
    expect(pkg.dependencies.animejs).toBeUndefined()
    expect(pkg.dependencies.ogl).toBeUndefined()
    expect(pkg.dependencies.motion).toBeUndefined()
  })
})
```

Keep every existing `stationComposition.test.ts` case (including “does not contain GridScan”).

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd orb-platform && npx vitest run src/lib/deadCluster.test.ts
```

Expected: FAIL because the files and deps still exist.

- [ ] **Step 3: Delete the files and drop the deps**

Delete the files listed above. Run `npm uninstall animejs face-api.js ogl motion` in `orb-platform` (or edit `package.json` and `package-lock.json` consistently). Do not remove `gsap`, `leva`, `three`, or `@react-three/*`.

Update the MorphSlider comment in `avatarPortraits.ts`. Do not change portrait paths or captions.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd orb-platform && npx vitest run src/lib/deadCluster.test.ts src/components/stationComposition.test.ts
cd orb-platform && npx tsc --noEmit
```

Expected: PASS / clean.

- [ ] **Step 5: Commit**

```bash
git add -A orb-platform
git commit -m "$(cat <<'EOF'
chore: remove unused GridScan cluster and orphaned deps

EOF
)"
```

Do not add Debra MP3s, persona PNGs, or `orb-ui/`.

---

### Task 3: Rewrite handoff docs to match the tree

**Files:**
- Modify: `HANDOFF.md`
- Modify: `CONTEXT.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: current `orb-platform` (stations, local MediaPipe, Debra silent in this app, webcam always-on for the live mirror)
- Produces: no claim that face parallax is unbuilt; no `npm run samples:debra` as a root script; next step is not “implement MediaPipe from scratch”

- [ ] **Step 1: Write the failing tests**

Create `scripts/handoff-docs.test.mjs` **or** a small vitest file at repo-adjacent `orb-platform/src/lib/handoffDocs.test.ts` that reads the three markdown files from repo root:

```ts
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repo = join(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('handoff docs', () => {
  it('describes the shipped orb-platform, not an unbuilt MediaPipe plan', () => {
    const handoff = readFileSync(join(repo, 'HANDOFF.md'), 'utf8')
    const context = readFileSync(join(repo, 'CONTEXT.md'), 'utf8')
    const readme = readFileSync(join(repo, 'README.md'), 'utf8')
    expect(handoff).not.toMatch(/approved, not built yet/i)
    expect(handoff).not.toMatch(/no MediaPipe in `package\.json`/)
    expect(context).not.toMatch(/Spec \+ plan approved; not implemented/)
    expect(readme).not.toMatch(/npm run samples:debra/)
    expect(handoff).toMatch(/orb-platform/)
    expect(handoff).toMatch(/MediaPipe/)
  })
})
```

Fix the `repo` join so it resolves to the git root from `orb-platform/src/lib/`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd orb-platform && npx vitest run src/lib/handoffDocs.test.ts
```

Expected: FAIL on the stale phrases.

- [ ] **Step 3: Rewrite the three docs**

`HANDOFF.md` should tell the next machine:

- Active app is `orb-platform/` (stations I–III + photobash).
- MediaPipe Face Landmarker is already in `orb-platform/package.json` and loads from vendored `public/mediapipe/` (see kiosk-offline spec).
- Debra speech is **not** wired in this app (visual guide only). Do not add `DebraVoice`.
- Webcam stays on whenever `MirrorCameraLayer` mounts, including overlay `none`.
- Next work is festival kiosk bring-up (`npm run dev` in `orb-platform`, WAN-off check), not implementing face parallax from the Aug 3 plan.

`CONTEXT.md` “Where we left off” and checklist: same facts. Remove `npm run samples:debra` as if it were a root script. You may still mention `scripts/debra-intro.txt` as the canonical monologue text.

`README.md`: start-here points at stations + `cd orb-platform && npm install && npm run dev`. Remove `npm run samples:debra`. Keep the layout table.

Do not change PRODUCT.md unless a sentence contradicts the above.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd orb-platform && npx vitest run src/lib/handoffDocs.test.ts
cd orb-platform && npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add HANDOFF.md CONTEXT.md README.md orb-platform/src/lib/handoffDocs.test.ts
git commit -m "$(cat <<'EOF'
docs: align handoff with shipped MediaPipe stations

EOF
)"
```
