import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  centralApiBase,
  fetchPersonaForCurrentVisit,
  fetchVisitPersona,
  isStationTurnActive,
  peekStationOneForStation,
  pickVisitAtStation,
  peekRevealVisitorFace,
  pickRevealVisit,
  pickVisitForReveal,
  pickVisitForStationThree,
  refreshVisitCache,
  resetVisitCacheForTests,
  shouldGateStationTurn,
  stationOnePayload,
  stationTwoPayload,
  visitSessionKeyForStation,
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

  it('gates station turns when central is explicit on the URL', () => {
    vi.stubGlobal('window', {
      location: {
        search: '?central=http%3A%2F%2Fb310-mac%3A8087',
        hostname: 'rpi400-2',
      },
    })
    expect(shouldGateStationTurn(2)).toBe(true)
    expect(isStationTurnActive(2, [])).toBe(false)
    expect(
      isStationTurnActive(2, [
        { visit_id: 'v-1', state: 'station_1', active_station: 1, station_data: {} },
      ]),
    ).toBe(false)
    expect(
      isStationTurnActive(2, [
        { visit_id: 'v-1', state: 'station_2', active_station: 2, station_data: {} },
      ]),
    ).toBe(true)
    expect(
      isStationTurnActive(3, [
        { visit_id: 'v-1', state: 'station_2', active_station: 2, station_data: {} },
      ]),
    ).toBe(false)
    expect(
      isStationTurnActive(3, [
        { visit_id: 'v-1', state: 'reveal', active_station: null, station_data: {} },
      ]),
    ).toBe(true)
    expect(visitSessionKeyForStation(2, [{ visit_id: 'v-9', state: 'station_2', active_station: 2, station_data: {} }])).toBe(
      'v-9',
    )
  })

  it('does not gate local dev without an explicit central param', () => {
    expect(shouldGateStationTurn(2)).toBe(false)
    expect(isStationTurnActive(2, [])).toBe(true)
  })

  it('fetches the persona system prompt for a visit id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        visit_id: 'v-persona',
        system_prompt: 'Satellite 5 persona for Ada',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const persona = await fetchVisitPersona('v-persona')
    expect(persona?.system_prompt).toContain('Satellite 5')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8087/api/visits/v-persona/persona',
      { cache: 'no-store' },
    )
  })

  it('loads persona for the active station-three visit', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          visit_id: 'v-3',
          system_prompt: 'Ego type: Hero',
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const persona = await fetchPersonaForCurrentVisit()
    expect(pickVisitForStationThree()).toBeTruthy()
    expect(persona?.visit_id).toBe('v-3')
    expect(persona?.system_prompt).toContain('Ego type')
  })
})


describe('pickRevealVisit (strict)', () => {
  const at = (visit_id: string, state: string, last_activity_at: number, faceCapture?: string) =>
    ({
      visit_id,
      state,
      active_station: null,
      last_activity_at,
      station_data: faceCapture ? { '1': { answers: {}, faceCapture } } : {},
    }) as unknown as Parameters<typeof pickRevealVisit>[0][number]

  it('never falls back to a visitor still at Station 3 or 2', () => {
    // 2026-09-12: the loose pick loaded the next visitor's photo during a
    // no-photo reveal. The wall must wear nobody else's face.
    const visits = [at('v-s2', 'station_2', 5, 'data:next-person'), at('v-s3', 'station_3', 4)]
    expect(pickVisitForReveal(visits)?.visit_id).toBe('v-s3') // the loose one still does
    expect(pickRevealVisit(visits)).toBeNull() // the strict one does not
  })

  it('picks the most recently active visit in reveal', () => {
    const visits = [at('v-old', 'reveal', 1, 'data:old'), at('v-new', 'reveal', 9, 'data:new')]
    expect(pickRevealVisit(visits)?.visit_id).toBe('v-new')
  })

  it('peekRevealVisitorFace is null with no reveal visit, even if others have photos', () => {
    expect(peekRevealVisitorFace()).toBeNull()
  })
})
