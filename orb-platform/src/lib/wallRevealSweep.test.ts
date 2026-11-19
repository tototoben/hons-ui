import { describe, expect, it } from 'vitest'
import type { ActiveVisit } from './visitCentral'
import { pickSweepVisit } from './wallRevealSweep'

function visit(id: string, state: string, lastActivity = 0): ActiveVisit {
  return { visit_id: id, state, station_data: {}, last_activity_at: lastActivity }
}

describe('pickSweepVisit', () => {
  it('ignores visits that are still interviewing', () => {
    const seen = new Map<string, number>()
    expect(pickSweepVisit([visit('v-a', 'station_1')], seen, 0)).toBeNull()
    expect(seen.size).toBe(0)
  })

  it('sweeps the visit in reveal, then lets the wall go ambient after the hold', () => {
    const seen = new Map<string, number>()
    const visits = [visit('v-a', 'reveal')]
    expect(pickSweepVisit(visits, seen, 1000, 5000)?.visit_id).toBe('v-a')
    expect(pickSweepVisit(visits, seen, 5999, 5000)?.visit_id).toBe('v-a')
    expect(pickSweepVisit(visits, seen, 6000, 5000)).toBeNull()
  })

  it('switches to a newer visit as soon as it reaches reveal', () => {
    const seen = new Map<string, number>([['v-a', 0]])
    const visits = [visit('v-a', 'reveal', 100), visit('v-b', 'reveal', 200)]
    expect(pickSweepVisit(visits, seen, 1_000_000, 5000)?.visit_id).toBe('v-b')
    expect(seen.get('v-b')).toBe(1_000_000)
  })
})
