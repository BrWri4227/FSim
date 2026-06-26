import * as THREE from 'three'
import type { GroundTargetSpec, GroundTargetState } from '../types/groundTarget'
import { nedToThree } from '../utils/MathUtils'

let _gtCounter = 0

/**
 * A static or slow-moving ground entity. Receives damage from missiles / bombs
 * but has no flight model. Discriminated from Aircraft via `readonly type`.
 */
export class GroundTarget {
  readonly type = 'GROUND' as const
  readonly entityId: string
  readonly spec: GroundTargetSpec
  state: GroundTargetState
  mesh: THREE.Group
  private scene: THREE.Scene
  private healthBarSprite: THREE.Sprite | null = null
  private samCooldownRemainingSec = 0
  private radarDish: THREE.Object3D | null = null   // SAM rotating dish
  private turret:    THREE.Object3D | null = null   // ARMOR turret + barrel group
  private radarRotSpeed = 1.2 + Math.random() * 0.6  // rad/s, slightly randomised

  constructor(spec: GroundTargetSpec, scene: THREE.Scene, positionNED: [number, number, number], headingDeg = 0, entityId?: string) {
    this.entityId = entityId ?? `ground_${++_gtCounter}`
    this.spec = spec
    this.scene = scene
    this.state = {
      positionNED: [...positionNED] as [number, number, number],
      velocityNED: [0, 0, 0],
      attitudeQuat: [1, 0, 0, 0],
      headingDeg,
      hp: spec.hpMax,
      invincible: false,
      destroyed: false,
    }
    this.mesh = this.buildMesh()
    scene.add(this.mesh)
    this.updateMesh()
  }

  private buildMesh(): THREE.Group {
    const group = new THREE.Group()
    const { lengthM, widthM, heightM } = this.spec.meshSize
    const baseGeo = new THREE.BoxGeometry(lengthM, heightM, widthM)
    const mat = new THREE.MeshStandardMaterial({ color: this.spec.meshColor, metalness: 0.15, roughness: 0.88 })
    const body = new THREE.Mesh(baseGeo, mat)
    body.position.y = heightM / 2
    body.castShadow = true
    body.receiveShadow = true
    group.add(body)

    // Category-specific protrusions for visual recognition
    if (this.spec.category === 'SAM_SITE') {
      // Vertical launch tubes pointing up
      const tubeGeo = new THREE.CylinderGeometry(0.4, 0.4, 5, 8)
      const tubeMat = new THREE.MeshStandardMaterial({ color: 0x202020, metalness: 0.7, roughness: 0.4 })
      for (let i = 0; i < 4; i++) {
        const t = new THREE.Mesh(tubeGeo, tubeMat)
        const dx = ((i % 2) - 0.5) * 1.6
        const dz = (Math.floor(i / 2) - 0.5) * 1.6
        t.position.set(dx, heightM + 2.5, dz)
        group.add(t)
      }
      // Radar dish on top — kept in a pivot group for rotation
      const dishPivot = new THREE.Group()
      dishPivot.position.set(0, heightM + 1.5, 0)
      const dishGeo = new THREE.SphereGeometry(1.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)
      const dish = new THREE.Mesh(dishGeo, new THREE.MeshStandardMaterial({ color: 0x808080, metalness: 0.6, roughness: 0.4 }))
      dish.rotation.x = -Math.PI / 6
      dishPivot.add(dish)
      // Radar mast
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.5, 8),
        new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.3 }))
      mast.position.y = -0.75
      dishPivot.add(mast)
      group.add(dishPivot)
      this.radarDish = dishPivot
    } else if (this.spec.category === 'ARMOR') {
      // Tank turret + barrel — in a pivot group for azimuth tracking
      const turretPivot = new THREE.Group()
      turretPivot.position.y = heightM + 0.4
      const turretGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.8, 12)
      const turret = new THREE.Mesh(turretGeo, mat)
      turretPivot.add(turret)
      const barrelGeo = new THREE.CylinderGeometry(0.12, 0.12, 4, 8)
      barrelGeo.rotateZ(Math.PI / 2)
      const barrel = new THREE.Mesh(barrelGeo, new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.3 }))
      barrel.position.set(2, 0, 0)
      turretPivot.add(barrel)
      group.add(turretPivot)
      this.turret = turretPivot
    } else if (this.spec.category === 'SHIP') {
      // Superstructure block
      const ssGeo = new THREE.BoxGeometry(lengthM * 0.3, heightM * 0.6, widthM * 0.7)
      const ss = new THREE.Mesh(ssGeo, new THREE.MeshPhongMaterial({ color: 0x556070 }))
      ss.position.set(-lengthM * 0.15, heightM + heightM * 0.3, 0)
      group.add(ss)
    }

    return group
  }

  applyDamage(amount: number): void {
    if (this.state.destroyed || this.state.invincible) return
    this.state.hp = Math.max(0, this.state.hp - amount)
    if (this.state.hp <= 0) this.state.destroyed = true
  }

  /** Simple integration: ships drift along heading, statics do nothing. */
  update(dt: number, targetNED?: [number, number, number]): void {
    if (this.state.destroyed) return
    if (this.spec.speedMS > 0) {
      const hdgRad = this.state.headingDeg * (Math.PI / 180)
      const vN = Math.cos(hdgRad) * this.spec.speedMS
      const vE = Math.sin(hdgRad) * this.spec.speedMS
      this.state.velocityNED = [vN, vE, 0]
      this.state.positionNED[0] += vN * dt
      this.state.positionNED[1] += vE * dt
    }
    if (this.samCooldownRemainingSec > 0) this.samCooldownRemainingSec = Math.max(0, this.samCooldownRemainingSec - dt)

    // Rotate SAM radar dish continuously
    if (this.radarDish) {
      this.radarDish.rotation.y += this.radarRotSpeed * dt
    }

    // Point tank turret roughly toward target
    if (this.turret && targetNED) {
      const myPos = this.state.positionNED
      const dx = targetNED[1] - myPos[1]  // east delta
      const dy = targetNED[0] - myPos[0]  // north delta
      // Desired world-space azimuth (Three.js Y-axis rotation).
      // mesh heading is -headingDeg, so we need to account for the parent rotation.
      const worldAz  = Math.atan2(dx, dy)
      const parentAz = -this.state.headingDeg * (Math.PI / 180)
      const localAz  = worldAz - parentAz
      // Smooth track
      const diff = ((localAz - this.turret.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI
      this.turret.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), 0.8 * dt)
    }
  }

  updateMesh(): void {
    if (this.state.destroyed) {
      this.mesh.visible = false
      return
    }
    const p = nedToThree(this.state.positionNED)
    this.mesh.position.set(p.x, p.y, p.z)
    this.mesh.rotation.y = -this.state.headingDeg * (Math.PI / 180)
  }

  /** True if SAM ready to fire (called by EntityManager when GMTI/SAM logic lands). */
  samReadyToFire(): boolean {
    return (
      this.spec.category === 'SAM_SITE' &&
      !this.state.destroyed &&
      this.samCooldownRemainingSec <= 0
    )
  }

  triggerSamCooldown(): void {
    this.samCooldownRemainingSec = this.spec.samReloadSec ?? 8
  }

  dispose(): void {
    this.scene.remove(this.mesh)
    if (this.healthBarSprite) this.scene.remove(this.healthBarSprite)
    this.mesh.traverse(o => {
      if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose()
      const m = (o as THREE.Mesh).material
      if (Array.isArray(m)) m.forEach(mat => mat.dispose())
      else if (m) m.dispose()
    })
  }
}
