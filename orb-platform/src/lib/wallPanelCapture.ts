import type { CollageCue } from './collageCue'
import { parseCollageCue } from './collageCue'
import {
  centralApiBase,
  fetchVisitById,
  pickVisitForStationThree,
  refreshVisitCache,
} from './visitCentral'
import { renderWallSouvenirPng } from './wallSouvenirComposite'
import { wallSouvenirTicketInputFromVisit } from './wallSouvenirTicket'

export type ActiveWallCapture = {
  capture_id: string
  visit_id?: string | null
  photobashSeed: number
  collageCue?: CollageCue
  moment: 'immediate' | 'hold'
}

const handledCaptureIds = new Set<string>()

export async function fetchActiveWallCapture(): Promise<ActiveWallCapture | null> {
  const base = centralApiBase()
  if (!base) return null
  const response = await fetch(`${base}/api/wall/capture/active`, { cache: 'no-store' })
  if (!response.ok) return null
  const payload = (await response.json()) as { capture?: ActiveWallCapture | null }
  return payload.capture ?? null
}

export async function uploadWallCaptureImage(captureId: string, png: Blob): Promise<boolean> {
  const base = centralApiBase()
  if (!base) return false
  const response = await fetch(`${base}/api/wall/capture/${captureId}/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: png,
  })
  return response.ok
}

export function resetHandledWallCaptures() {
  handledCaptureIds.clear()
}

/** Debra conductor: poll central and upload a rendered composite when ready. */
export async function maybeSubmitWallCapture(
  loadingProgress: number,
): Promise<boolean> {
  const active = await fetchActiveWallCapture()
  if (!active?.capture_id || handledCaptureIds.has(active.capture_id)) {
    return false
  }
  if (active.moment === 'hold' && loadingProgress < 1) {
    return false
  }

  try {
    const seed = active.photobashSeed
    const cue = parseCollageCue(active.collageCue ?? {})
    await refreshVisitCache(true)
    const visit =
      (active.visit_id ? await fetchVisitById(active.visit_id) : null) ??
      pickVisitForStationThree()
    const ticket = wallSouvenirTicketInputFromVisit(visit, {
      visitId: active.visit_id,
      photobashSeed: seed,
      collageCue: cue,
    })
    const png = await renderWallSouvenirPng(seed, cue, ticket)
    const ok = await uploadWallCaptureImage(active.capture_id, png)
    if (ok) {
      handledCaptureIds.add(active.capture_id)
    } else {
      console.error('[wall-capture] upload rejected', active.capture_id)
    }
    return ok
  } catch (error) {
    console.error('[wall-capture] render/upload failed', active.capture_id, error)
    return false
  }
}
