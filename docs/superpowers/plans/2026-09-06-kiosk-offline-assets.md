# Kiosk Offline Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load MediaPipe and photobash assets from this app (Vite `base()` + vendored files) so festival kiosks work with no public CDN.

**Architecture:** Photobash URLs go through the existing `base()` helper. `PARALLAX.wasmBase` / `modelUrl` point at files under `public/mediapipe/`. A vendor script copies WASM from `node_modules` at `predev`/`prebuild` and downloads the `.task` model only if it is missing.

**Tech Stack:** Vite 8, TypeScript 5.9, Vitest 4, `@mediapipe/tasks-vision` already in `orb-platform/package.json`. No new npm dependencies.

## Global Constraints

- Runtime code must not fetch `cdn.jsdelivr.net` or `storage.googleapis.com`.
- Copy WASM from `node_modules/@mediapipe/tasks-vision/wasm` at `predev` / `prebuild`. Do not commit the ~18MB WASM binaries.
- Commit `face_landmarker.task` under `orb-platform/public/mediapipe/`.
- Prefix photobash asset URLs with `base()` from `orb-platform/src/config.ts`.
- Do not restore Debra speech. No `DebraVoice` component.
- Do not change webcam lifetime. Overlay mode `none` still keeps the live mirror and skips MediaPipe.
- Do not delete `orb-ui/`, GridScan, unused npm deps, or Debra MP3s.
- Do not add npm dependencies.
- Work on branch `feat/kiosk-offline-assets`, not `main`.
- Commit after each task. Do not push.

---

### Task 1: Photobash `base()` paths

**Files:**
- Modify: `orb-platform/src/lib/faceBank.ts`
- Modify: `orb-platform/src/lib/faceBank.test.ts`
- Modify: `orb-platform/src/lib/wallLipClips.ts`
- Modify: `orb-platform/src/lib/wallLipClips.test.ts`

**Interfaces:**
- Consumes: `base(path: string): string` from `orb-platform/src/config.ts`
- Produces: `FACE_BANK_DIR` equals `base('/assets/wall-avatar/face-bank/')` and ends with `/`. `LIP_SPRITE_SRC` equals `base('/assets/wall-avatar/lips/mouth-sprite.jpg')`.

- [ ] **Step 1: Write the failing tests**

Add to `orb-platform/src/lib/faceBank.test.ts`:

```ts
import { base } from '../config'
import { FACE_BANK_DIR, pickFaceBankFiles } from './faceBank'
```

and a new case:

```ts
  it('prefixes the face-bank directory with the Vite base URL', () => {
    expect(FACE_BANK_DIR).toBe(base('/assets/wall-avatar/face-bank/'))
    expect(FACE_BANK_DIR.endsWith('/')).toBe(true)
  })
```

Add to `orb-platform/src/lib/wallLipClips.test.ts` imports: `base` from `../config` and `LIP_SPRITE_SRC` from `./wallLipClips`. Add:

```ts
  it('prefixes the lip sprite with the Vite base URL', () => {
    expect(LIP_SPRITE_SRC).toBe(base('/assets/wall-avatar/lips/mouth-sprite.jpg'))
  })
```

Keep every existing test in both files.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd orb-platform && npx vitest run src/lib/faceBank.test.ts src/lib/wallLipClips.test.ts
```

Expected: FAIL because `FACE_BANK_DIR` is `'/assets/wall-avatar/face-bank/'` and `LIP_SPRITE_SRC` is `'/assets/wall-avatar/lips/mouth-sprite.jpg'`, which do not equal `base(...)` when Vite `base` is `/orb/`.

- [ ] **Step 3: Write minimal implementation**

In `orb-platform/src/lib/faceBank.ts`, add `import { base } from '../config'` and set:

```ts
export const FACE_BANK_DIR = base('/assets/wall-avatar/face-bank/')
```

Leave `MANIFEST_URL = \`${FACE_BANK_DIR}manifest.json\`` as-is.

In `orb-platform/src/lib/wallLipClips.ts`, add `import { base } from '../config'` and set:

```ts
export const LIP_SPRITE_SRC = base('/assets/wall-avatar/lips/mouth-sprite.jpg')
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd orb-platform && npx vitest run src/lib/faceBank.test.ts src/lib/wallLipClips.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add orb-platform/src/lib/faceBank.ts orb-platform/src/lib/faceBank.test.ts orb-platform/src/lib/wallLipClips.ts orb-platform/src/lib/wallLipClips.test.ts
git commit -m "fix: prefix photobash face-bank and lip sprite with Vite base"
```

---

### Task 2: Local MediaPipe URLs in PARALLAX

**Files:**
- Modify: `orb-platform/src/config.ts` (`PARALLAX.wasmBase` and `PARALLAX.modelUrl`)
- Create: `orb-platform/src/config.test.ts`

**Interfaces:**
- Consumes: `base(path: string)` in the same file
- Produces: `PARALLAX.wasmBase === base('/mediapipe/wasm')`, `PARALLAX.modelUrl === base('/mediapipe/face_landmarker.task')`. Neither value contains `jsdelivr`, `googleapis`, or `http`.

- [ ] **Step 1: Write the failing test**

Create `orb-platform/src/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { PARALLAX, base } from './config'

describe('PARALLAX asset URLs', () => {
  it('loads MediaPipe from the app origin, not a public CDN', () => {
    expect(PARALLAX.wasmBase).toBe(base('/mediapipe/wasm'))
    expect(PARALLAX.modelUrl).toBe(base('/mediapipe/face_landmarker.task'))
    expect(PARALLAX.wasmBase).not.toMatch(/jsdelivr|googleapis|https?:/)
    expect(PARALLAX.modelUrl).not.toMatch(/jsdelivr|googleapis|https?:/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd orb-platform && npx vitest run src/config.test.ts
```

Expected: FAIL because `wasmBase` is still the jsdelivr URL and `modelUrl` is still the Google Storage URL.

- [ ] **Step 3: Write minimal implementation**

In `orb-platform/src/config.ts`, replace the `PARALLAX` URL fields with:

```ts
  wasmBase: base('/mediapipe/wasm'),
  modelUrl: base('/mediapipe/face_landmarker.task'),
```

Do not change other `PARALLAX` knobs. Do not change `useMirrorCamera`, `useMediaSensors`, or `faceBankAlign`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd orb-platform && npx vitest run src/config.test.ts src/hooks/useMirrorCamera.runtime.test.tsx
```

Expected: PASS. The existing “keeps the live camera but skips MediaPipe when tracking is off” case must still pass.

- [ ] **Step 5: Commit**

```bash
git add orb-platform/src/config.ts orb-platform/src/config.test.ts
git commit -m "fix: load MediaPipe WASM and landmarker from local public paths"
```

---

### Task 3: Vendor script, gitignore, and committed landmarker model

**Files:**
- Create: `orb-platform/scripts/vendor-mediapipe.mjs`
- Create: `orb-platform/scripts/vendor-mediapipe.test.ts`
- Modify: `orb-platform/package.json` (`scripts.predev`, `scripts.prebuild`)
- Modify: `.gitignore` (add `orb-platform/public/mediapipe/wasm/`)
- Create (by running the script): `orb-platform/public/mediapipe/face_landmarker.task`

**Interfaces:**
- Consumes: `node_modules/@mediapipe/tasks-vision/wasm` after `npm install` in `orb-platform`
- Produces: `public/mediapipe/wasm/` with `vision_wasm_internal.js`, `vision_wasm_internal.wasm`, `vision_wasm_nosimd_internal.js`, `vision_wasm_nosimd_internal.wasm`. `public/mediapipe/face_landmarker.task` present. `package.json` `predev` and `prebuild` are `node scripts/vendor-mediapipe.mjs`.

- [ ] **Step 1: Write the failing tests**

Create `orb-platform/scripts/vendor-mediapipe.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
}

describe('vendor-mediapipe npm wiring', () => {
  it('runs the vendor script before dev and build', () => {
    expect(pkg.scripts.predev).toBe('node scripts/vendor-mediapipe.mjs')
    expect(pkg.scripts.prebuild).toBe('node scripts/vendor-mediapipe.mjs')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd orb-platform && npx vitest run scripts/vendor-mediapipe.test.ts
```

Expected: FAIL because `predev` / `prebuild` are missing.

- [ ] **Step 3: Write the vendor script and wire npm**

Create `orb-platform/scripts/vendor-mediapipe.mjs`:

```js
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const wasmDest = join(root, 'public', 'mediapipe', 'wasm')
const taskDest = join(root, 'public', 'mediapipe', 'face_landmarker.task')
const TASK_SOURCE =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const REQUIRED_WASM = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (!existsSync(wasmSrc) || !statSync(wasmSrc).isDirectory()) {
  fail('Missing node_modules/@mediapipe/tasks-vision/wasm. Run npm install in orb-platform.')
}

mkdirSync(wasmDest, { recursive: true })
for (const name of readdirSync(wasmSrc)) {
  copyFileSync(join(wasmSrc, name), join(wasmDest, name))
}
for (const name of REQUIRED_WASM) {
  if (!existsSync(join(wasmDest, name))) {
    fail(`Vendor copy missing ${name}`)
  }
}

if (!existsSync(taskDest)) {
  mkdirSync(dirname(taskDest), { recursive: true })
  const response = await fetch(TASK_SOURCE)
  if (!response.ok) {
    fail(`Failed to download face_landmarker.task (${response.status})`)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  writeFileSync(taskDest, bytes)
}

if (!existsSync(taskDest)) {
  fail('face_landmarker.task is missing after vendor')
}

console.log('Vendored MediaPipe wasm and face_landmarker.task')
```

In `orb-platform/package.json` `scripts`, add before `dev`:

```json
    "predev": "node scripts/vendor-mediapipe.mjs",
    "prebuild": "node scripts/vendor-mediapipe.mjs",
```

Keep existing `dev`, `build`, `build:reveal`, `preview`, `test`.

Append to repo-root `.gitignore`:

```
orb-platform/public/mediapipe/wasm/
```

Do not ignore `face_landmarker.task`.

- [ ] **Step 4: Run the script, tests, and webcam contract**

Run:

```bash
cd orb-platform && node scripts/vendor-mediapipe.mjs
cd orb-platform && npx vitest run scripts/vendor-mediapipe.test.ts src/config.test.ts src/hooks/useMirrorCamera.runtime.test.tsx
cd orb-platform && npm test
```

Expected: vendor script exits 0, prints the success line, `public/mediapipe/face_landmarker.task` exists, wasm files exist under `public/mediapipe/wasm/` (untracked/ignored). All tests PASS. Do not add Debra audio. Do not change webcam start/stop.

Confirm `git check-ignore -q orb-platform/public/mediapipe/wasm/vision_wasm_internal.wasm` succeeds (ignored). Confirm `git check-ignore -q orb-platform/public/mediapipe/face_landmarker.task` fails (not ignored).

- [ ] **Step 5: Commit**

```bash
git add orb-platform/scripts/vendor-mediapipe.mjs orb-platform/scripts/vendor-mediapipe.test.ts orb-platform/package.json .gitignore orb-platform/public/mediapipe/face_landmarker.task
git commit -m "feat: vendor MediaPipe wasm at predev and commit the landmarker model"
```

Do not `git add` anything under `orb-platform/public/mediapipe/wasm/`.

---
