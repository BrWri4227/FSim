import * as THREE from 'three'
import type { PlayerAircraft } from '../entities/PlayerAircraft'
import type { EntityManager } from '../entities/EntityManager'
import type { AircraftSpec } from '../types/aircraft'
import type { DataLinkContact } from '../types/radar'
import { createPlaceholderCockpit } from './PlaceholderCockpits'
import { FA18Cockpit } from './FA18Cockpit'
import { GlassHUD } from './GlassHUD'
import { MFDRenderer } from './MFDRenderer'
import { nedToThree, nedQuatToThree } from '../utils/MathUtils'
import { COCKPIT_VIEW_LAYER } from '../camera/CameraLayers'
import { F15CCockpit } from '../aircraftmodels/f15c/F15CCockpit'
import { F16CCockpit } from '../aircraftmodels/f16c/F16CCockpit'
import { F22ARaptorCockpit } from '../aircraftmodels/f22a-raptor/F22ARaptorCockpit'
import { F35ACockpit } from '../aircraftmodels/f35a/F35ACockpit'
import { MiG29ACockpit } from '../aircraftmodels/mig29a/MiG29ACockpit'
import { Su27Cockpit } from '../aircraftmodels/su27/Su27Cockpit'
import { Su35SCockpit } from '../aircraftmodels/su35s/Su35SCockpit'
import { Su57Cockpit } from '../aircraftmodels/su57/Su57Cockpit'
import { prepareCockpitForSim, type AnimatedCockpit } from '../aircraftmodels/core/CockpitSimAdapter'

/** Roster id → detailed animated cockpit factory. Ids not listed fall back to the placeholder. */
const DETAILED_COCKPIT_FACTORIES: Record<string, () => AnimatedCockpit> = {
  fa18e: () => new FA18Cockpit(),
  f15c: () => prepareCockpitForSim('f15c', new F15CCockpit()),
  f16c: () => prepareCockpitForSim('f16c', new F16CCockpit()),
  f22: () => prepareCockpitForSim('f22', new F22ARaptorCockpit()),
  f35a: () => prepareCockpitForSim('f35a', new F35ACockpit()),
  mig29: () => prepareCockpitForSim('mig29', new MiG29ACockpit()),
  su27: () => prepareCockpitForSim('su27', new Su27Cockpit()),
  su35: () => prepareCockpitForSim('su35', new Su35SCockpit()),
  su57: () => prepareCockpitForSim('su57', new Su57Cockpit()),
}

/**
 * Wires in-cockpit 3D visuals: interior shell, glass HUD combiner, and MFD pages.
 * Cockpit is scene-rooted and synced to the player each frame so it stays visible
 * when the external aircraft mesh is hidden in first-person view.
 */
export class CockpitController {
  private cockpitGroup: THREE.Group
  /** Set when a bespoke animated interior is used (stick + throttle driven each frame). */
  private detailedCockpit: AnimatedCockpit | null = null
  private glassHUD: GlassHUD
  /** Null when the cockpit layout exposes no bindable MFD face (guarded everywhere). */
  private mfdLeft: MFDRenderer | null = null
  private mfdRight: MFDRenderer | null = null
  private scene: THREE.Scene
  private _pilotEyeBody: [number, number, number]
  private _eyeOffset = new THREE.Vector3()
  private visible = true

  constructor(scene: THREE.Scene, spec: AircraftSpec) {
    this.scene = scene
    this._pilotEyeBody = spec.pilotEyePointM
    const factory = DETAILED_COCKPIT_FACTORIES[spec.id]
    if (factory) {
      this.detailedCockpit = factory()
      this.cockpitGroup = this.detailedCockpit
    } else {
      this.cockpitGroup = createPlaceholderCockpit(spec.id)
    }
    this.cockpitGroup.name = 'cockpit_controller'

    this.glassHUD = new GlassHUD()
    this.cockpitGroup.add(this.glassHUD.mesh)

    // MFD faces vary by cockpit layout — only bind a renderer when the mesh exists.
    const lMfd = this.cockpitGroup.getObjectByName('mfd_left') as THREE.Mesh | undefined
    const rMfd = this.cockpitGroup.getObjectByName('mfd_right') as THREE.Mesh | undefined
    if (lMfd) this.mfdLeft = new MFDRenderer('RADAR', lMfd)
    if (rMfd) this.mfdRight = new MFDRenderer('EW', rMfd)

    // Pin the whole interior to the cockpit-view layer so it always renders in
    // first person, and keep it out of frustum culling near the eye.
    this.cockpitGroup.traverse(obj => {
      obj.layers.set(COCKPIT_VIEW_LAYER)
      obj.frustumCulled = false
      if (obj instanceof THREE.Mesh) obj.renderOrder = 20
    })

    scene.add(this.cockpitGroup)
  }

  cycleLeftMFD(): void { this.mfdLeft?.cycleForward() }
  cycleRightMFD(): void { this.mfdRight?.cycleForward() }

  setVisible(v: boolean): void {
    this.visible = v
    this.cockpitGroup.visible = v
  }

  private syncTransform(player: PlayerAircraft): void {
    const pos = nedToThree(player.state.positionNED)
    const aircraftQuat = nedQuatToThree(player.state.attitudeQuat)
    const [ex, ey, ez] = this._pilotEyeBody
    // Eye offset is in NED body frame — same transform as CockpitCamera (no mesh bias).
    this._eyeOffset.set(ey, -ez, -ex).applyQuaternion(aircraftQuat)
    this.cockpitGroup.position.copy(pos).add(this._eyeOffset)
    // Same orientation as CockpitCamera — forward is local −Z, no placeholder mesh bias.
    this.cockpitGroup.quaternion.copy(aircraftQuat)
  }

  update(
    player: PlayerAircraft,
    entityManager: EntityManager,
    dataLink: DataLinkContact[] = [],
    cockpitViewActive = true,
  ): void {
    this.cockpitGroup.visible = this.visible && cockpitViewActive
    if (!this.cockpitGroup.visible) return

    this.syncTransform(player)

    const state = player.state

    // Animate the 3D stick + throttle from the pilot's smoothed control axes.
    if (this.detailedCockpit) {
      const axes = player.controlAxes
      this.detailedCockpit.setControls(axes.pitch, axes.roll, state.throttle)
    }

    this.glassHUD.update(
      state, player.spec, player.radar.state, player.rwr.state,
      player.hms.state.cursorAzDeg, player.hms.state.cursorElDeg,
    )

    const gunRounds = player.gun.getRoundsRemaining()
    const selectedWeapon = player.getSelectedWeaponName()

    this.mfdLeft?.update(
      state, player.radar.state, player.rwr.state,
      state.loadedStores, gunRounds, selectedWeapon,
      player.cmds.flareCount, player.cmds.chaffCount,
      dataLink, player.targetingPod.state, entityManager.getGroundTargets(),
    )
    this.mfdRight?.update(
      state, player.radar.state, player.rwr.state,
      state.loadedStores, gunRounds, selectedWeapon,
      player.cmds.flareCount, player.cmds.chaffCount,
      dataLink, player.targetingPod.state, entityManager.getGroundTargets(),
    )
  }

  dispose(): void {
    this.glassHUD.dispose()
    this.mfdLeft?.dispose()
    this.mfdRight?.dispose()
    this.scene.remove(this.cockpitGroup)
  }
}
