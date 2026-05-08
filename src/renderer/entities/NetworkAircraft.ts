import type * as THREE from 'three'
import type { AircraftSpec } from '../types/aircraft'
import type { NetPlayerState } from '../network/MultiplayerTypes'
import { Aircraft } from './Aircraft'

export class NetworkAircraft extends Aircraft {
  constructor(spec: AircraftSpec, scene: THREE.Scene, entityId: string) {
    super(spec, [], scene, entityId)
    this.state.invincible = true
  }

  applyNetworkState(net: NetPlayerState): void {
    this.state.positionNED = [...net.positionNED]
    this.state.velocityNED = [...net.velocityNED]
    this.state.attitudeQuat = [...net.attitudeQuat]
    this.state.throttle = net.throttle
    this.state.ejected = net.ejected
    this.damage.structuralFailure = net.structuralFailure
  }
}
