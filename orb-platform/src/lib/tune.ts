/**
 * Controls visibility of the Leva tuning overlay.
 *
 * - `?tune=1` — show the panel (dev or production)
 * - `?tune=0` — hide the panel (dev or production)
 * - No param  — hidden (default). The dev server is used for realistic
 *   testing and live operation, so the tuning overlay is opt-in only.
 */
export function showTuningPanel(
  search: string = typeof window === 'undefined' ? '' : window.location.search,
): boolean {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  )
  const tune = params.get('tune')
  if (tune === '1') return true
  if (tune === '0') return false
  return false
}
