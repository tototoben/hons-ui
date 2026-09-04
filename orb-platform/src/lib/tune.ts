/**
 * Controls visibility of the Leva tuning overlay.
 *
 * - `?tune=1` — force show the panel (even in production builds)
 * - `?tune=0` — force hide the panel (even in dev builds)
 * - No param  — fall back to `import.meta.env.DEV` (default: dev only)
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
  return import.meta.env.DEV
}
