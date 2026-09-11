import { centralApiBase } from './visitCentral'

/**
 * Fire-and-forget technical-only summary of a photobash decision, posted to
 * central (see components/central/src/central/api.py
 * POST /api/diagnostics/wall) so "how were the photos picked" is answerable
 * from central.log afterward instead of only from a live wall window's
 * devtools console. 2026-09-11.
 *
 * Never pass raw image data or visitor-authored text -- central additionally
 * drops any string field starting with "data:" and clips long strings as a
 * backstop, but the caller should not rely on that.
 */
export function postWallDiagnostic(
  kind: 'face_capture' | 'collage_assembled',
  fields: Record<string, string | number | boolean | null | Array<string | number | boolean | null>>,
  visitId?: string | null,
): void {
  const base = centralApiBase()
  if (!base) return
  const body = JSON.stringify({ kind, visit_id: visitId ?? undefined, ...fields })
  void fetch(`${base}/api/diagnostics/wall`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {})
}
