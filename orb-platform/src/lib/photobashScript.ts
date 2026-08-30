import { loadStationTwoState } from './interviewStore'
import { STATION_TWO_LIGHTNING, type StationTwoState } from './mirrorJourney'
import { getVisitorProfile, type VisitorProfile } from './visitorProfile'

export type PhotobashScript = {
  opening: string[]
  middle: string[]
  closing: string[]
}

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function heightLine(height: number) {
  if (height <= 0.4) return 'You asked for someone shorter than you.'
  if (height >= 0.6) return 'You asked for someone taller than you.'
  return 'You left height somewhere in the middle.'
}

function lightningLine(stationTwo: StationTwoState) {
  for (const pair of STATION_TWO_LIGHTNING) {
    const pick = stationTwo.lightningAnswers[pair.id]
    if (pick === pair.left || pick === pair.right) {
      return `When we asked ${pair.left.toLowerCase()} or ${pair.right.toLowerCase()}, you chose ${pick.toLowerCase()}.`
    }
  }
  return null
}

export function buildPhotobashScript({
  profile = getVisitorProfile(),
  stationTwo = loadStationTwoState(),
  hasVoice = false,
}: {
  profile?: VisitorProfile
  stationTwo?: StationTwoState | null
  hasVoice?: boolean
} = {}): PhotobashScript {
  const opening = ['I have been listening. Let me show you who we made.']
  const name = cleanName(profile.callName)
  if (name) opening.push(`Hello, ${name}.`)

  const middle: string[] = []
  const orientation = cleanName(profile.orientation)
  if (orientation) middle.push(`You said your orientation is ${orientation}.`)

  if (stationTwo) {
    middle.push(heightLine(stationTwo.height))
    if (stationTwo.answers.attractiveness === 'yes') {
      middle.push('Looks mattered to you.')
    } else if (stationTwo.answers.attractiveness === 'no') {
      middle.push('You said looks were not the point.')
    }
    const lightning = lightningLine(stationTwo)
    if (lightning) middle.push(lightning)
  }

  const closing = ['This is the companion we negotiated. Look closely.']
  if (hasVoice) closing.push('And this is you, introducing yourself.')

  return { opening, middle, closing }
}

export function flattenPhotobashScript(script: PhotobashScript) {
  return [...script.opening, ...script.middle, ...script.closing]
}
