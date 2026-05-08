import type { Vec3 } from './common'

export interface HeatContact {
  entityId: string
  positionNED: Vec3
  heatSignatureKW: number
  velocityNED: Vec3
}

export interface FlareContact {
  positionNED: Vec3
  heatSignatureKW: number
  ageSec: number
}

export interface IRSeekerState {
  gimbalAzDeg: number
  gimbalElDeg: number
  locked: boolean
  lockedEntityId: string | null
  scanMode: boolean
}

export interface HMSState {
  cursorAzDeg: number
  cursorElDeg: number
  locked: boolean
  lockedEntityId: string | null
  enabled: boolean
}
