export const PHOTOBASH_CYCLE_MS = 65_000
export const PHOTOBASH_FILL_MS = 4000

export function mintPhotobashSeed(random: () => number = Math.random) {
  return (random() * 1_000_000_000) | 0
}

export function photobashProgress(elapsedMs: number, fillMs: number = PHOTOBASH_FILL_MS) {
  return Math.min(1, Math.max(0, elapsedMs / fillMs))
}
