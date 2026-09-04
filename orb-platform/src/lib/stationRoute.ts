export type StationRoute =
  | 'orb'
  | 'cards'
  | 'avatars'
  | 'mirror'
  | 'station-1'
  | 'station-2'
  | 'face-align'
  | 'wall-sim'
  | 'wall-cal'
  | 'photobash'
  | 'debra-capture'

export function getStationFromHash(hash: string): StationRoute {
  if (hash === '#/cards') return 'cards'
  if (hash === '#/avatars') return 'avatars'
  if (hash === '#/mirror') return 'mirror'
  if (hash === '#/station-1') return 'station-1'
  if (hash === '#/station-2') return 'station-2'
  if (hash === '#/face-align') return 'face-align'
  if (hash === '#/wall-sim') return 'wall-sim'
  if (hash === '#/wall-cal') return 'wall-cal'
  if (hash === '#/photobash') return 'photobash'
  if (hash === '#/debra-capture') return 'debra-capture'
  return 'orb'
}

export function getStationHref(station: StationRoute) {
  return `#/${station}`
}

export function isEmptyStationHash(hash: string) {
  return hash === '' || hash === '#' || hash === '#/'
}

/** Developer / wall-tool hashes that must not mount on a kiosk Pi. */
export function isKioskBlockedStation(station: StationRoute) {
  return (
    station === 'orb' ||
    station === 'cards' ||
    station === 'avatars' ||
    station === 'face-align' ||
    station === 'wall-sim' ||
    station === 'wall-cal' ||
    station === 'debra-capture' ||
    station === 'photobash'
  )
}
