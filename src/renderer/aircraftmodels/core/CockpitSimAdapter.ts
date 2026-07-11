import * as THREE from 'three'

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** Pilot eye — matches DetailedCockpit / FA18Cockpit floor-origin coordinates. */
const EYE = new THREE.Vector3(0, 1.25, 0.42)

const STICK_PITCH_RANGE = 0.22
const STICK_ROLL_RANGE = 0.24
const THROTTLE_RANGE = 0.5
const THROTTLE_PIVOT = new THREE.Vector3(-0.53, 0.72, 0.2)

/** MFD screen offset toward the pilot (+Z) inside each tilted bezel group. */
const MFD_FACE_Z = 0.036

/** Display group names inside DetailedCockpit → bindable MFD faces. */
const MFD_BIND: Record<string, [string, string]> = {
  f15c: ['RadarScope', '__aux_right__'],
  f16c: ['LeftMFD', 'RightMFD'],
  f22: ['LeftMFD', 'RightMFD'],
  f35a: ['__panoramic__', '__panoramic__'],
  mig29: ['RadarDisplay', '__aux_right__'],
  su27: ['RadarDisplay', '__aux_right__'],
  su35: ['LeftMFD', 'RightMFD'],
  su57: ['LeftLargeDisplay', 'RightLargeDisplay'],
}

export type AnimatedCockpit = THREE.Group & {
  setControls(pitch: number, roll: number, throttle: number): void
}

/**
 * Adapts a DetailedCockpit (v3) for FSim: eye-origin shift, pilot-facing MFD
 * planes, hidden interior glass/HUD combiner, and animated stick + throttle.
 */
export function prepareCockpitForSim(aircraftId: string, cockpit: THREE.Group): AnimatedCockpit {
  hideFirstPersonOverlays(cockpit)
  applyInteriorEmissive(cockpit)

  const stickShaft = cockpit.getObjectByName('ControlStickShaft')
  const sideStick = stickShaft != null && Math.abs(stickShaft.position.x) > 0.1
  const stickBase = sideStick
    ? new THREE.Vector3(0.28, 0.34, -0.2)
    : new THREE.Vector3(0.18, 0.34, -0.2)

  const stickPivot = buildPivot(cockpit, stickBase, ['ControlStickShaft', 'ControlStickGrip'])
  const throttlePivot = buildPivot(cockpit, THROTTLE_PIVOT.clone(), ['ThrottleLever', 'ThrottleGrip'])

  bindMfdScreens(cockpit, aircraftId)

  const root = new THREE.Group()
  root.name = 'cockpit_root'
  for (const child of [...cockpit.children]) root.add(child)
  cockpit.add(root)
  root.position.copy(EYE).multiplyScalar(-1)

  let animPitch = 0
  let animRoll = 0
  let animThrottle = 0.3

  const animated = cockpit as AnimatedCockpit
  animated.setControls = (pitch: number, roll: number, throttle: number): void => {
    const k = 0.25
    animPitch += (clamp(pitch, -1, 1) - animPitch) * k
    animRoll += (clamp(roll, -1, 1) - animRoll) * k
    animThrottle += (clamp(throttle, 0, 1) - animThrottle) * k

    if (stickPivot) {
      stickPivot.rotation.x = animPitch * STICK_PITCH_RANGE
      stickPivot.rotation.z = -animRoll * STICK_ROLL_RANGE
    }
    if (throttlePivot) {
      throttlePivot.rotation.x = (0.5 - animThrottle) * THROTTLE_RANGE
    }
  }

  return animated
}

/** Hide geometry that blocks or duplicates the sim HUD / exterior view. */
function hideFirstPersonOverlays(cockpit: THREE.Group): void {
  for (const name of ['CanopyGlass', 'HUDCombinerGlass']) {
    const obj = cockpit.getObjectByName(name)
    if (obj) obj.visible = false
  }
}

/** Subtle self-light on dark cockpit surfaces (screens/HUD glass already emissive). */
function applyInteriorEmissive(cockpit: THREE.Group): void {
  cockpit.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue
      if (mat.emissiveIntensity > 0.1) continue
      if (mat.transparent && mat.opacity < 0.5) continue
      mat.emissive.copy(mat.color).multiplyScalar(0.07)
      mat.emissiveIntensity = 1
    }
  })
}

function buildPivot(
  parent: THREE.Group,
  base: THREE.Vector3,
  names: string[],
): THREE.Group | undefined {
  const nameSet = new Set(names)
  const parts = parent.children.filter(c => nameSet.has(c.name))
  if (parts.length === 0) return undefined

  const pivot = new THREE.Group()
  pivot.name = 'controlPivot'
  pivot.position.copy(base)
  for (const part of parts) {
    parent.remove(part)
    part.position.sub(base)
    pivot.add(part)
  }
  parent.add(pivot)
  return pivot
}

function bindMfdScreens(cockpit: THREE.Group, aircraftId: string): void {
  const bind = MFD_BIND[aircraftId]
  if (!bind) return

  const [leftKey, rightKey] = bind

  if (leftKey === '__panoramic__') {
    splitPanoramicMfd(cockpit)
    return
  }

  const leftMesh = bindDisplayGroup(cockpit, leftKey, 'mfd_left')

  if (rightKey === '__aux_right__') {
    addAuxRightMfd(cockpit, leftMesh)
    return
  }

  bindDisplayGroup(cockpit, rightKey, 'mfd_right')
}

function bindDisplayGroup(
  cockpit: THREE.Group,
  groupName: string,
  bindName: string,
): THREE.Mesh | null {
  const group = cockpit.getObjectByName(groupName)
  if (!group) return null

  const plane = group.children.find(
    c => c instanceof THREE.Mesh && c.geometry instanceof THREE.PlaneGeometry,
  ) as THREE.Mesh | undefined
  if (!plane) return null

  return reorientMfdPlane(plane, bindName)
}

/**
 * DetailedCockpit MFD planes sit at negative Z with rotation.y = PI (facing away).
 * Rebuild facing +Z so MFDRenderer canvas textures read upright for the pilot.
 */
function reorientMfdPlane(mesh: THREE.Mesh, bindName: string): THREE.Mesh {
  const parent = mesh.parent as THREE.Object3D
  const params = (mesh.geometry as THREE.PlaneGeometry).parameters
  const w = params.width
  const h = params.height

  parent.remove(mesh)
  mesh.geometry.dispose()
  if (mesh.material instanceof THREE.Material) mesh.material.dispose()

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color: 0x001a0d, side: THREE.DoubleSide }),
  )
  screen.name = bindName
  screen.position.set(0, 0, MFD_FACE_Z)
  parent.add(screen)
  return screen
}

function splitPanoramicMfd(cockpit: THREE.Group): void {
  const group = cockpit.getObjectByName('PanoramicCockpitDisplay')
  if (!group) return

  const plane = group.children.find(
    c => c instanceof THREE.Mesh && c.geometry instanceof THREE.PlaneGeometry,
  ) as THREE.Mesh | undefined
  if (!plane) return

  const params = (plane.geometry as THREE.PlaneGeometry).parameters
  const w = params.width
  const h = params.height
  const hw = w * 0.49

  group.remove(plane)
  plane.geometry.dispose()
  if (plane.material instanceof THREE.Material) plane.material.dispose()

  const mat = () => new THREE.MeshBasicMaterial({ color: 0x001a0d, side: THREE.DoubleSide })

  const left = new THREE.Mesh(new THREE.PlaneGeometry(hw, h), mat())
  left.name = 'mfd_left'
  left.position.set(-w * 0.255, 0, MFD_FACE_Z)
  group.add(left)

  const right = new THREE.Mesh(new THREE.PlaneGeometry(hw, h), mat())
  right.name = 'mfd_right'
  right.position.set(w * 0.255, 0, MFD_FACE_Z)
  group.add(right)
}

function addAuxRightMfd(cockpit: THREE.Group, leftMesh: THREE.Mesh | null): void {
  const mfdGroup = leftMesh?.parent as THREE.Group | null
  const rotX = mfdGroup?.rotation.x ?? -0.11

  const right = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.22),
    new THREE.MeshBasicMaterial({ color: 0x001a0d, side: THREE.DoubleSide }),
  )
  right.name = 'mfd_right'
  right.position.set(0.32, 0.75, -1.02)
  right.rotation.x = rotX
  cockpit.add(right)
}
