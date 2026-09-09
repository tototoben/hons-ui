export const PHOTOBASH_CYCLE_MS = 65_000
export const PHOTOBASH_FILL_MS = 4000

/** Stable seeds for the idle wall loop until a real reveal arrives. */
export const PLACEHOLDER_PHOTOBASH_SEEDS = [42, 137, 891, 2048] as const
export const DEFAULT_PLACEHOLDER_PHOTOBASH_SEED = PLACEHOLDER_PHOTOBASH_SEEDS[0]

export function mintPhotobashSeed(random: () => number = Math.random) {
  return (random() * 1_000_000_000) | 0
}

export function photobashProgress(elapsedMs: number, fillMs: number = PHOTOBASH_FILL_MS) {
  return Math.min(1, Math.max(0, elapsedMs / fillMs))
}
