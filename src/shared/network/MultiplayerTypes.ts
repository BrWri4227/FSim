export type MultiplayerMode = 'single' | 'host' | 'join'

export interface MultiplayerConfig {
  mode: MultiplayerMode
  host: string
  port: number
}

export type DamageZone = 'ENGINE' | 'WING_LEFT' | 'WING_RIGHT' | 'FUSELAGE' | 'TAIL' | 'COCKPIT'

export type RadarMode = 'OFF' | 'RWS' | 'TWS' | 'STT' | 'GMTI'

export interface NetPlayerProfile {
  aircraftId: string
  /**
   * Display name shown to every other client. Optional so a client on an older
   * build still validates; receivers fall back to the peer id.
   */
  callsign?: string
}

export interface NetRadarState {
  mode: RadarMode
  sttTargetId: string | null
}

export interface NetMissileState {
  id: string
  positionNED: [number, number, number]
  velocityNED: [number, number, number]
  targetEntityId: string
  active: boolean
}

export interface NetFlareState {
  positionNED: [number, number, number]
  velocityNED: [number, number, number]
  heatSignatureKW: number
  ageSec: number
}

export interface NetChaffState {
  positionNED: [number, number, number]
  velocityNED: [number, number, number]
  rcsM2: number
  ageSec: number
}

export interface NetCountermeasureState {
  flares: NetFlareState[]
  chaffClouds: NetChaffState[]
}

export interface NetPlayerState {
  positionNED: [number, number, number]
  velocityNED: [number, number, number]
  attitudeQuat: [number, number, number, number]
  throttle: number
  ejected: boolean
  structuralFailure: boolean
  radar: NetRadarState
  missiles: NetMissileState[]
  /**
   * `null` means "unchanged since my last snapshot" — the sender omits the
   * countermeasure payload when no flare/chaff was dispensed or expired, and
   * the receiver ages its existing clouds locally. Cuts bandwidth sharply
   * during heavy countermeasure use (a 30-flare salvo is ~150 numbers).
   */
  countermeasures: NetCountermeasureState | null
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
  | { type: 'profile-update'; profile: NetPlayerProfile }
  | { type: 'state'; state: NetPlayerState }
  /** Clears in-flight state on the server so roster shows IN LOBBY again. */
  | { type: 'return-to-lobby' }
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
      type: 'peer-profile-update'
      playerId: string
      profile: NetPlayerProfile
    }
  | {
      type: 'state'
      playerId: string
      profile: NetPlayerProfile
      state: NetPlayerState | null
    }
  | {
      type: 'hit'
      hit: HitEvent
    }

export function cloneNetPlayerState(s: NetPlayerState): NetPlayerState {
  return {
    positionNED: [...s.positionNED],
    velocityNED: [...s.velocityNED],
    attitudeQuat: [...s.attitudeQuat],
    throttle: s.throttle,
    ejected: s.ejected,
    structuralFailure: s.structuralFailure,
    radar: {
      mode: s.radar.mode,
      sttTargetId: s.radar.sttTargetId,
    },
    missiles: s.missiles.map(m => ({
      id: m.id,
      positionNED: [...m.positionNED],
      velocityNED: [...m.velocityNED],
      targetEntityId: m.targetEntityId,
      active: m.active,
    })),
    countermeasures: s.countermeasures
      ? {
          flares: s.countermeasures.flares.map(f => ({
            positionNED: [...f.positionNED],
            velocityNED: [...f.velocityNED],
            heatSignatureKW: f.heatSignatureKW,
            ageSec: f.ageSec,
          })),
          chaffClouds: s.countermeasures.chaffClouds.map(c => ({
            positionNED: [...c.positionNED],
            velocityNED: [...c.velocityNED],
            rcsM2: c.rcsM2,
            ageSec: c.ageSec,
          })),
        }
      : null,
  }
}
