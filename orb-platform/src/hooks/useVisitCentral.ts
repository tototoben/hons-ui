import { useEffect, useState } from 'react'
import {
  peekActiveVisits,
  refreshVisitCache,
  type ActiveVisit,
} from '../lib/visitCentral'

const POLL_MS = 2000

export function useVisitCentralPoll() {
  const [visits, setVisits] = useState<ActiveVisit[]>(() => peekActiveVisits())

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      const next = await refreshVisitCache()
      if (!cancelled) setVisits(next)
    }
    void poll()
    const timer = window.setInterval(() => {
      void poll()
    }, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  return visits
}
