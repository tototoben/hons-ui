import { useEffect, useRef, useState } from 'react'
import { collageCueFromVisitCentral, type CollageCue } from './collageCue'
import { peekActiveVisits, pickRevealVisit, refreshVisitCache, type ActiveVisit } from './visitCentral'

/**
 * November wall without a live dialogue.
 *
 * In September the visitor's face only appeared on the wall talk by talk,
 * during the reveal dialogue. For EKA November the dialogue may not run, so
 * when a visit reaches Central's `reveal` state and no conversation owns the
 * wall, every panel sweeps that visitor's face into the collage instead (the
 * existing 45 s ticket-capture sweep), holds it for a while, then goes back
 * to the ambient collage. A live dialogue still takes precedence.
 */

/** How long the wall shows a visitor after it first sees their reveal:
 * the 45 s sweep plus time to look at the finished face. */
export const REVEAL_SWEEP_HOLD_MS = 3 * 60_000
const POLL_MS = 4000

/**
 * The visit to sweep in now, or null for the ambient wall. `firstSeen`
 * records, per visit, when this screen first saw it in reveal. Screen-local
 * time on purpose: Central's timestamps come from another machine's clock,
 * and the installation's clocks disagree.
 */
export function pickSweepVisit(
  visits: ActiveVisit[],
  firstSeen: Map<string, number>,
  now: number,
  holdMs: number = REVEAL_SWEEP_HOLD_MS,
): ActiveVisit | null {
  const visit = pickRevealVisit(visits)
  if (!visit?.visit_id) return null
  if (!firstSeen.has(visit.visit_id)) firstSeen.set(visit.visit_id, now)
  const seenAt = firstSeen.get(visit.visit_id) ?? now
  return now - seenAt < holdMs ? visit : null
}

export type RevealSweep = { visitId: string; cue: CollageCue | null }

/** Polls Central while `enabled` and returns the visit to sweep in, if any. */
export function useCentralRevealSweep(enabled: boolean): RevealSweep | null {
  const [sweep, setSweep] = useState<RevealSweep | null>(null)
  const firstSeenRef = useRef(new Map<string, number>())
  const sweepRef = useRef<RevealSweep | null>(null)
  sweepRef.current = sweep

  useEffect(() => {
    if (!enabled) {
      setSweep(null)
      return
    }
    let cancelled = false
    const poll = async () => {
      await refreshVisitCache(true)
      if (cancelled) return
      const visit = pickSweepVisit(peekActiveVisits(), firstSeenRef.current, performance.now())
      if (!visit) {
        setSweep((current) => (current === null ? current : null))
        return
      }
      if (sweepRef.current?.visitId === visit.visit_id) return
      const cue = await collageCueFromVisitCentral().catch(() => null)
      if (cancelled) return
      setSweep((current) =>
        current?.visitId === visit.visit_id ? current : { visitId: visit.visit_id, cue },
      )
    }
    void poll()
    const timer = window.setInterval(() => void poll(), POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [enabled])

  return sweep
}
