import type { Vec3 } from '../types/common'
import type { FlareContact } from '../types/ir'

export interface ChaffCloud {
  positionNED: Vec3
  velocityNED: Vec3
  rcsM2: number
  ageSec: number
}

export class CMDS {
  private readonly MAX_FLARES: number
  private readonly MAX_CHAFF: number
  flareCount: number
  chaffCount: number
  flares: FlareContact[] = []
  chaffClouds: ChaffCloud[] = []
  private flareTimer = 0
  private chaffTimer = 0
  private readonly FLARE_COOLDOWN = 0.5
  private readonly CHAFF_COOLDOWN = 0.25

  constructor(maxFlares = 120, maxChaff = 120) {
    this.MAX_FLARES = maxFlares
    this.MAX_CHAFF  = maxChaff
    this.flareCount = maxFlares
    this.chaffCount = maxChaff
  }

  private emitFlare(posNED: Vec3, velocityNED: Vec3): void {
    this.flares.push({
      positionNED: [...posNED] as Vec3,
      velocityNED: [...velocityNED] as Vec3,
      heatSignatureKW: 60,  // bright flare
      ageSec: 0
    })
  }

  dispenseFlare(posNED: Vec3, velocityNED: Vec3 = [0, 0, 0]): void {
    if (this.flareCount <= 0 || this.flareTimer > 0) return
    this.flareCount--
    this.flareTimer = this.FLARE_COOLDOWN
    this.emitFlare(posNED, velocityNED)
  }

  dispenseFlarePair(spawns: readonly { positionNED: Vec3; velocityNED: Vec3 }[]): void {
    if (this.flareTimer > 0 || this.flareCount < 2 || spawns.length < 2) return
    this.flareCount -= 2
    this.flareTimer = this.FLARE_COOLDOWN
    this.emitFlare(spawns[0]!.positionNED, spawns[0]!.velocityNED)
    this.emitFlare(spawns[1]!.positionNED, spawns[1]!.velocityNED)
  }

  dispenseChaff(posNED: Vec3, velocityNED: Vec3 = [0, 0, 0]): void {
    if (this.chaffCount <= 0 || this.chaffTimer > 0) return
    this.chaffCount--
    this.chaffTimer = this.CHAFF_COOLDOWN
    this.chaffClouds.push({
      positionNED: [...posNED] as Vec3,
      velocityNED: [...velocityNED] as Vec3,
      rcsM2: 25, // Dense dipole cloud appears as a very large radar return.
      ageSec: 0,
    })
  }

  update(dt: number): void {
    if (this.flareTimer > 0) this.flareTimer -= dt
    if (this.chaffTimer > 0) this.chaffTimer -= dt
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const f = this.flares[i]!
      f.ageSec += dt
      const drag = Math.max(0, 1 - dt * 1.8)
      f.velocityNED = [
        f.velocityNED[0] * drag,
        f.velocityNED[1] * drag,
        f.velocityNED[2] + dt * 3.5,
      ]
      f.positionNED = [
        f.positionNED[0] + f.velocityNED[0] * dt,
        f.positionNED[1] + f.velocityNED[1] * dt,
        f.positionNED[2] + f.velocityNED[2] * dt,
      ]
      f.heatSignatureKW = Math.max(0, 60 * (1 - f.ageSec / 4.0))
      if (f.ageSec > 4.0) this.flares.splice(i, 1)
    }
    for (let i = this.chaffClouds.length - 1; i >= 0; i--) {
      const c = this.chaffClouds[i]!
      c.ageSec += dt
      // Chaff cloud slows down and settles while dispersing.
      c.velocityNED = [
        c.velocityNED[0] * (1 - dt * 0.9),
        c.velocityNED[1] * (1 - dt * 0.9),
        c.velocityNED[2] + dt * 2.0,
      ]
      c.positionNED = [
        c.positionNED[0] + c.velocityNED[0] * dt,
        c.positionNED[1] + c.velocityNED[1] * dt,
        c.positionNED[2] + c.velocityNED[2] * dt,
      ]
      c.rcsM2 = Math.max(0.5, 25 * (1 - c.ageSec / 6.0))
      if (c.ageSec > 6.0) this.chaffClouds.splice(i, 1)
    }
  }

  getActiveFlares(): readonly FlareContact[] {
    return this.flares
  }

  getActiveChaffClouds(): readonly ChaffCloud[] {
    return this.chaffClouds
  }

  reloadCountermeasures(): void {
    this.flareCount = this.MAX_FLARES
    this.chaffCount = this.MAX_CHAFF
    this.flares.length = 0
    this.chaffClouds.length = 0
    this.flareTimer = 0
    this.chaffTimer = 0
  }
}
