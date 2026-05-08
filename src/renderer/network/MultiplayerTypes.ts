import type { DamageZone } from '../types/damage'

export type MultiplayerMode = 'single' | 'host' | 'join'

export interface MultiplayerConfig {
  mode: MultiplayerMode
  host: string
  port: number
}

export interface NetPlayerProfile {
  aircraftId: string
}

export interface NetPlayerState {
  positionNED: [number, number, number]
  velocityNED: [number, number, number]
  attitudeQuat: [number, number, number, number]
  throttle: number
  ejected: boolean
  structuralFailure: boolean
}

export interface HitEvent {
  sourceId: string
  targetId: string
  zone: DamageZone
  severity: number
  weapon: 'GUN' | 'MISSILE'
}

export type ClientMessage =
  | { type: 'join'; profile: NetPlayerProfile }
  | { type: 'state'; state: NetPlayerState }
  | { type: 'hit'; hit: HitEvent }

export type ServerMessage =
  | {
      type: 'welcome'
      playerId: string
      peers: Array<{ playerId: string; profile: NetPlayerProfile; state: NetPlayerState | null }>
    }
  | {
      type: 'peer-join'
      playerId: string
      profile: NetPlayerProfile
    }
  | {
      type: 'peer-leave'
      playerId: string
    }
  | {
      type: 'state'
      playerId: string
      profile: NetPlayerProfile
      state: NetPlayerState
    }
  | {
      type: 'hit'
      hit: HitEvent
    }
