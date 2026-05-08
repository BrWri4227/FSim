import type { Vec3 } from '../types/common'
import type { FlareContact } from '../types/ir'

export class CMDS {
  flareCount = 30
  chaffCount = 30
  flares: FlareContact[] = []
  private flareTimer = 0
  private readonly FLARE_COOLDOWN = 0.5

  dispenseFlare(posNED: Vec3): void {
    if (this.flareCount <= 0 || this.flareTimer > 0) return
    this.flareCount--
    this.flareTimer = this.FLARE_COOLDOWN
    this.flares.push({
      positionNED: [...posNED],
      heatSignatureKW: 60,  // bright flare
      ageSec: 0
    })
  }

  dispenseChaff(posNED: Vec3): void {
    if (this.chaffCount <= 0) return
    this.chaffCount--
    // Chaff handled separately in radar detection
  }

  update(dt: number): void {
    if (this.flareTimer > 0) this.flareTimer -= dt
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const f = this.flares[i]!
      f.ageSec += dt
      f.heatSignatureKW = Math.max(0, 60 * (1 - f.ageSec / 4.0))
      if (f.ageSec > 4.0) this.flares.splice(i, 1)
    }
  }
}
