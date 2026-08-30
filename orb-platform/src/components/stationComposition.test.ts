import { describe, expect, it } from 'vitest'
import scene from './Scene.tsx?raw'
import secondStation from './SecondStation.tsx?raw'
import cardPointCloudRoom from './CardPointCloudRoom.tsx?raw'
import cardStationPostProcessing from './CardStationPostProcessing.tsx?raw'
import questionCardDeck from './QuestionCardDeck.tsx?raw'
import questionCardDeckStyles from './QuestionCardDeck.css?raw'
import postProcessing from './PostProcessing.tsx?raw'
import pointCloudShaders from '../shaders/pointCloudShaders.ts?raw'
import cardSwapSource from './CardSwap.jsx?raw'
import cardSwapStyles from './CardSwap.css?raw'
import appSource from '../App.tsx?raw'
import photobashSource from './PhotobashScreen.tsx?raw'
import stationOneSource from './StationOne.tsx?raw'
import stationTwoSource from './StationTwo.tsx?raw'
import journeyStyles from './MirrorJourney.css?raw'
import thirdStationStyles from './ThirdStation.css?raw'

describe('station composition', () => {
  it('keeps developer station-switcher and overlays the production picker', () => {
    expect(appSource).toContain('station-switcher')
    expect(appSource).toContain('ThirdStationWall')
    expect(appSource).toContain('DevicePicker')
    expect(appSource).toContain('DeviceUnlockLayer')
    expect(appSource).toContain('PhotobashScreen')
    expect(appSource).toContain('isProductionHotkey')
    expect(appSource).toContain("station === 'photobash'")
  })

  it('keeps Station III as the kiosk ThirdStation only', () => {
    expect(appSource).toContain('<ThirdStation />')
    expect(appSource).not.toContain('WallCollageBlanket')
  })

  it('keeps Photobash as collage-only with no Debra or code wall chrome', () => {
    expect(photobashSource).toContain('WallCollageBlanket')
    expect(photobashSource).toContain('usePhotobashLoop')
    expect(photobashSource).not.toContain('WallDebraPanel')
    expect(photobashSource).not.toContain('WallCodePanel')
    expect(photobashSource).not.toContain('STANDBY')
    expect(photobashSource).not.toContain('RECORDING')
  })

  it('uses the registry CardSwap implementation and stylesheet', () => {
    expect(cardSwapSource).toContain("import gsap from 'gsap'")
    expect(cardSwapSource).toContain('const makeSlot =')
    expect(cardSwapSource).toContain("ease: 'elastic.out(0.85, 0.55)'")
    expect(cardSwapSource).toContain('export default CardSwap')
    expect(cardSwapStyles).toContain('.card-swap-container')
    expect(cardSwapStyles).toContain('perspective: 900px')
  })

  it('keeps question cards out of the orb scene', () => {
    expect(scene).not.toContain('RoomQuestionCards')
  })

  it('keeps the orb station on the solid dune room without answer dissolve', () => {
    expect(scene).toContain('SpaceRoom')
    expect(scene).not.toContain('RoomDissolveController')
    expect(scene).not.toContain('DissolvingRoomDust')
    expect(scene).not.toContain('<Room')
  })

  it('uses a point-cloud depth scan behind the React Bits question deck', () => {
    expect(secondStation).toContain('CardPointCloudRoom')
    expect(secondStation).toContain('QuestionCardDeck')
    expect(secondStation).not.toContain('GridScan')
    expect(secondStation).not.toContain('AutoCardStack')
  })

  it('keeps the previous GridScan post stack on the cards point-cloud station', () => {
    expect(cardPointCloudRoom).toContain('CardStationPostProcessing')
    expect(cardStationPostProcessing).toContain('Bloom')
    expect(cardStationPostProcessing).toContain('ChromaticAberration')
    expect(cardStationPostProcessing).toContain('radialModulation')
    expect(cardStationPostProcessing).toContain('Noise')
    expect(cardStationPostProcessing).toContain('bloomIntensity')
  })

  it('passes every existing question to the exact CardSwap component', () => {
    expect(questionCardDeck).toContain("import CardSwap, { Card } from './CardSwap'")
    expect(questionCardDeck).toContain('stationCards.map')
    expect(questionCardDeck).toContain('<CardSwap')
    expect(questionCardDeck).toContain('pauseOnHover={true}')
    expect(questionCardDeck).toContain('easing="elastic"')
  })

  it('limits the presentation to three visible depth slots', () => {
    expect(questionCardDeck).toContain('question-deck-viewport')
    expect(questionCardDeckStyles).toContain('overflow: visible')
    expect(questionCardDeckStyles).toContain('--deck-visible-slots: 3')
  })

  it('hides animated cards outside the three highest live depth slots', () => {
    expect(questionCardDeck).toContain('new MutationObserver(syncVisibleCards)')
    expect(questionCardDeck).toContain('.slice(0, DECK_VISIBLE_SLOTS)')
    expect(questionCardDeck).toContain("toggleAttribute('data-deck-visible'")
    expect(questionCardDeckStyles).toContain(
      '.question-deck-viewport:not(.question-deck-static) .question-swap-card:not([data-deck-visible])',
    )
    expect(questionCardDeckStyles).toContain('visibility: hidden')
  })

  it('uses a stable three-card fallback for reduced motion', () => {
    expect(questionCardDeck).toContain('usePrefersReducedMotion')
    expect(questionCardDeck).toContain('stationCards.slice(0, 3)')
    expect(questionCardDeck).toContain('question-deck-static')
  })

  it('keeps VHS-style post effects out of the orb', () => {
    expect(postProcessing).not.toContain('ChromaticAberration')
    expect(postProcessing).not.toContain('<Noise')
    expect(postProcessing).not.toContain('<Vignette')
  })

  it('keeps moving scan bands out of the orb point cloud', () => {
    expect(pointCloudShaders).not.toContain('vScan')
    expect(pointCloudShaders).not.toContain('scanLocal')
  })

  it('lets Station I yes/no be tapped and persists both station interviews', () => {
    expect(stationOneSource).not.toContain('hideButtons')
    expect(stationOneSource).toContain('saveStationOneState')
    expect(stationTwoSource).toContain('firehoseReducer')
    expect(stationTwoSource).toContain('saveStationTwoState')
  })

  it('pins station copy to a shared question-desk height and enlarges Station III frame', () => {
    expect(journeyStyles).toContain('--question-desk-bottom: 12vh')
    expect(journeyStyles).toContain('margin-bottom: var(--question-desk-bottom)')
    expect(thirdStationStyles).toContain('min(86vw, 440px)')
    expect(thirdStationStyles).toContain('var(--question-desk-bottom, 12vh)')
  })
})
