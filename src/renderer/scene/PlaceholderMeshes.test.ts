import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createPlaceholderAircraftMesh, createNozzlePoints } from './PlaceholderMeshes'

/** Expected functional thruster anchors per aircraft type. */
const ENGINE_NOZZLES: Record<string, number> = {
  f15c: 2,
  f16c: 1,
  fa18c: 2,
  fa18e: 2,
  f22: 2,
  f35a: 1,
  mig29: 2,
  su27: 2,
  su35: 2,
  su57: 2,
}

function meshBounds(mesh: THREE.Group) {
  const box = new THREE.Box3().setFromObject(mesh)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  return { center, size, box }
}

/** Decorative exhaust bells (not the invisible thruster anchors). */
function visualExhaustMeshes(mesh: THREE.Group): THREE.Object3D[] {
  const out: THREE.Object3D[] = []
  mesh.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return
    if (obj.name === 'nozzle' || /^nozzle-\d+$/.test(obj.name)) return
    if (/nozzle|exhaust/i.test(obj.name) && !/intake|petal|interior/i.test(obj.name)) {
      out.push(obj)
    }
  })
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

function worldPos(obj: THREE.Object3D): THREE.Vector3 {
  obj.updateWorldMatrix(true, false)
  const p = new THREE.Vector3()
  obj.getWorldPosition(p)
  return p
}

describe('aircraft mesh centering and nozzles', () => {
  for (const [id, expectedNozzles] of Object.entries(ENGINE_NOZZLES)) {
    it(`${id}: ${expectedNozzles} nozzle anchor(s), laterally centered`, () => {
      const mesh = createPlaceholderAircraftMesh(id, 'USA')
      const nozzles = createNozzlePoints(mesh)
      const visuals = visualExhaustMeshes(mesh)

      expect(nozzles).toHaveLength(expectedNozzles)
      if (visuals.length > 0) expect(visuals).toHaveLength(expectedNozzles)
      expect(nozzles[0]).not.toBe(mesh)

      const { center } = meshBounds(mesh)
      // After builder Ry(+90°): mesh-local +Z (starboard) maps to world +X.
      expect(Math.abs(center.x)).toBeLessThan(0.15)

      if (expectedNozzles === 2) {
        const [a, b] = nozzles
        expect(Math.abs(a!.position.z + b!.position.z)).toBeLessThan(0.02)
        expect(Math.abs(a!.position.y - b!.position.y)).toBeLessThan(0.02)
        expect(Math.abs(a!.position.x - b!.position.x)).toBeLessThan(0.02)
        expect(Math.abs(Math.abs(a!.position.z) - Math.abs(b!.position.z))).toBeLessThan(0.02)
      } else {
        expect(Math.abs(nozzles[0]!.position.z)).toBeLessThan(0.05)
      }

      if (visuals.length === expectedNozzles) {
        // Thruster anchors should sit on the visual exhaust mesh centers.
        const anchorWorld = nozzles.map(worldPos).sort((a, b) => a.x - b.x)
        const visualWorld = visuals.map(worldPos).sort((a, b) => a.x - b.x)
        for (let i = 0; i < expectedNozzles; i++) {
          expect(anchorWorld[i]!.distanceTo(visualWorld[i]!)).toBeLessThan(0.05)
        }
      }
    })
  }
})
