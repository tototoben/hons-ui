import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  centralApiBase,
  peekStationOneForStation,
  pickVisitAtStation,
  pickVisitForReveal,
  refreshVisitCache,
  resetVisitCacheForTests,
  stationOnePayload,
  stationTwoPayload,
} from './visitCentral'

describe('visitCentral', () => {
  beforeEach(() => {
    resetVisitCacheForTests()
    vi.stubGlobal('window', {
      location: { search: '', hostname: 'localhost' },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetVisitCacheForTests()
  })

  it('reads central API base from the kiosk query string', () => {
    vi.stubGlobal('window', {
      location: {
        search: '?central=http%3A%2F%2Fb310-mac%3A8087',
        hostname: 'localhost',
      },
    })
    expect(centralApiBase()).toBe('http://b310-mac:8087')
  })

  it('picks the active visit for a station and reveal', () => {
    const visits = [
      {
        visit_id: 'v-1',
        state: 'station_2',
        active_station: 2,
        station_data: {
          '1': { answers: { age: '30', identity: 'woman' } },
        },
      },
      {
        visit_id: 'v-2',
        state: 'reveal',
        active_station: null,
        station_data: {
          '1': { answers: { age: '22' }, faceCapture: 'data:image/jpeg;base64,face' },
          '2': { answers: { attractiveness: 'yes' }, height: 0.7 },
        },
      },
    ]

    expect(pickVisitAtStation(2, visits)?.visit_id).toBe('v-1')
    expect(pickVisitForReveal(visits)?.visit_id).toBe('v-2')
    expect(stationOnePayload(pickVisitForReveal(visits))?.faceCapture).toBe(
      'data:image/jpeg;base64,face',
    )
    expect(stationTwoPayload(pickVisitForReveal(visits))?.height).toBe(0.7)
  })

  it('refreshes active visits from central', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        visits: [
          {
            visit_id: 'v-3',
            state: 'station_3',
            active_station: 3,
            station_data: { '1': { answers: { callName: 'Ada' } } },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await refreshVisitCache(true)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8087/api/visits/active', {
      cache: 'no-store',
    })
    expect(peekStationOneForStation(3)?.answers?.callName).toBe('Ada')
  })
})
