import { parseCollageCue, type CollageCue } from './collageCue'

export type WallCaptureParams = { seed: number; cue: CollageCue }

/**
 * Direct-render override for central's headless-Chrome wall capture (QL
 * ticket). A fresh headless tab has no live reveal state (conductor
 * BroadcastChannel, Central poll), so central passes the exact seed/cue to
 * render and each role draws that collage straight away. Never set by the
 * real installation windows. Ported from ui 6b55deb, which never reached main.
 */
export function parseWallCaptureParams(
  search: string = typeof window === 'undefined' ? '' : window.location.search,
): WallCaptureParams | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const rawSeed = params.get('captureSeed')
  if (!rawSeed) return null
  const seed = Number(rawSeed)
  if (!Number.isFinite(seed) || seed <= 0) return null
  let cue: CollageCue = {}
  const rawCue = params.get('captureCue')
  if (rawCue) {
    try {
      cue = parseCollageCue(JSON.parse(rawCue))
    } catch {
      cue = {}
    }
  }
  return { seed, cue }
}
