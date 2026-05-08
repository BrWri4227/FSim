import type { Vec3 } from './common'

export type RadarMode = 'OFF' | 'RWS' | 'TWS' | 'STT'

export interface RadarTrack {
  entityId: string
  positionNED: Vec3
  velocityNED: Vec3
  rcsM2: number
  lastUpdateSec: number
  confidence: number
  isSTT: boolean
}

export interface RadarState {
  mode: RadarMode
  azimuthDeg: number       // current scan bar az position
  elevationBarDeg: number  // current bar elevation
  barIndex: number
  scanBarsElDeg: number[]  // e.g. [6, 2, -2, -6]
  scanRateDegs: number
  tracks: RadarTrack[]
  sttTargetId: string | null
  rangeModeM: number       // 37040=20nm, 74080=40nm, 148160=80nm
  lastFullScanSec: number
}

export interface DataLinkContact {
  entityId: string
  positionNED: Vec3
  velocityNED: Vec3
  classification: 'FRIENDLY' | 'HOSTILE' | 'UNKNOWN'
  confidence: number
  lastUpdateSec: number
}

export interface RWRThreat {
  entityId: string
  azimuthDeg: number   // relative to player nose
  type: 'SEARCH' | 'TRACK' | 'SAM' | 'MISSILE'
  priority: number     // 0-3
}

export interface RWRState {
  threats: RWRThreat[]
}
