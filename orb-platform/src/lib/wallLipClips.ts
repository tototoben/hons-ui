/**
 * "Talking" mouth animation for the collage photobash's mouth region —
 * built from a single grid of distinct still mouth shapes (open, closed,
 * teeth, tongue) rather than real video, cropped at runtime with
 * canvas drawImage source-rects and stepped through like a flipbook.
 * Empty SPRITE src means the layer simply doesn't mount.
 */
export const LIP_SPRITE_SRC = '/assets/wall-avatar/lips/mouth-sprite.jpg'
export const LIP_SPRITE_COLS = 4
export const LIP_SPRITE_ROWS = 6
export const LIP_SPRITE_FRAME_COUNT = LIP_SPRITE_COLS * LIP_SPRITE_ROWS

/** Relaxed, closed-lips cell (row 2, col 2) — the "resting" frame between
 * talking bursts. */
export const LIP_REST_FRAME = 5

export const LIP_FRAME_MS = 120
export const LIP_TALK_BURST_MS = { min: 1_800, max: 3_600 }
export const LIP_PAUSE_MS = { min: 500, max: 1_400 }

export function lipFrameRect(frameIndex: number) {
  const col = frameIndex % LIP_SPRITE_COLS
  const row = Math.floor(frameIndex / LIP_SPRITE_COLS) % LIP_SPRITE_ROWS
  return {
    col,
    row,
    u: col / LIP_SPRITE_COLS,
    v: row / LIP_SPRITE_ROWS,
    w: 1 / LIP_SPRITE_COLS,
    h: 1 / LIP_SPRITE_ROWS,
  }
}

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export type LipState = {
  /** True during a pause between talking bursts — the caller should hide
   * the sprite layer entirely and let the still collage piece underneath
   * show through, rather than freeze on the rest frame. */
  resting: boolean
  frame: number
}

/** Deterministic per-session talking rhythm: alternating bursts of quick
 * frame changes (excluding the rest frame, no immediate repeats) and
 * pauses (sprite layer hidden, still collage piece shows through) —
 * seeded so every wall panel stays in sync. */
export function lipStateAt(elapsedMs: number, seed: number): LipState {
  let cursor = 0
  let cycleIndex = 0
  // Walk cycle-by-cycle (deterministic given the seed) until we find the
  // burst/pause window containing elapsedMs.
  while (true) {
    const burstSeed = seed + cycleIndex * 7919
    const burstRand = mulberry32(burstSeed)
    const burstMs =
      LIP_TALK_BURST_MS.min + burstRand() * (LIP_TALK_BURST_MS.max - LIP_TALK_BURST_MS.min)
    const pauseMs = LIP_PAUSE_MS.min + burstRand() * (LIP_PAUSE_MS.max - LIP_PAUSE_MS.min)

    if (elapsedMs < cursor + burstMs) {
      const withinBurst = elapsedMs - cursor
      const frameStep = Math.floor(withinBurst / LIP_FRAME_MS)
      const frameRand = mulberry32(burstSeed + frameStep * 101)
      let frame = Math.floor(frameRand() * (LIP_SPRITE_FRAME_COUNT - 1))
      if (frame >= LIP_REST_FRAME) frame += 1
      return { resting: false, frame }
    }
    cursor += burstMs
    if (elapsedMs < cursor + pauseMs) return { resting: true, frame: LIP_REST_FRAME }
    cursor += pauseMs
    cycleIndex += 1
    if (cycleIndex > 10_000) return { resting: true, frame: LIP_REST_FRAME } // safety valve
  }
}
