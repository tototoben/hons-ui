import { submitKioskInterview } from './arsIngest'
import { collageCueFromAnswers } from './collageCue'
import type { StationTwoState } from './mirrorJourney'
import { publish } from './firehose'
import { mintPhotobashSeed } from './photobashLoop'
import {
  fetchVisitPersona,
  pickVisitAtStation,
  pickVisitForReveal,
  refreshVisitCache,
  type ActiveVisit,
} from './visitCentral'

/** Central still models three stations; while it does, the single-screen
 * visit may sit at any of them when the journey ends. */
function pickVisitForSingleJourney(): ActiveVisit | null {
  return pickVisitAtStation(1) ?? pickVisitForReveal()
}

/**
 * End of the single-screen journey: hand the typed answers to ARS (with a
 * synthetic intro, since there is no spoken one any more) and queue the
 * reveal through Central. The kiosk supplies the answers for ARS and the
 * collage; Central owns the reveal lifecycle for both wall hosts.
 */
export async function revealFromSingleJourney(input: {
  stationOneAnswers: Record<string, string>
  stationTwo: Pick<StationTwoState, 'answers' | 'lightningAnswers' | 'height'>
}): Promise<number> {
  await refreshVisitCache(true)
  const visit = pickVisitForSingleJourney()
  const persona = visit ? await fetchVisitPersona(visit.visit_id) : null
  const built = await submitKioskInterview(
    '',
    {
      visitId: visit?.visit_id ?? '',
      stationOneAnswers: input.stationOneAnswers,
      stationTwo: input.stationTwo,
      systemPrompt: persona?.system_prompt,
    },
    {},
    'station-1',
  )
  const age = Number(input.stationOneAnswers.age)
  const seed = mintPhotobashSeed()
  await publish('station-1', 'reveal_ready', {
    photobashSeed: seed,
    collageCue: collageCueFromAnswers({
      identity: input.stationOneAnswers.identity,
      age: Number.isFinite(age) && age > 0 ? age : null,
      orientation: input.stationOneAnswers.orientation,
      attractiveness: input.stationTwo.answers.attractiveness,
      lightningAnswers: input.stationTwo.lightningAnswers,
    }),
    readyAnswer: 'skip',
    visitId: visit?.visit_id ?? null,
    transcript: built.intro,
    transcriptSource: built.transcriptSource,
  })
  return seed
}
