import * as THREE from 'three'
import type { Vec3, Quat, StateVec } from '../types/common'

export const DEG2RAD = Math.PI / 180
export const RAD2DEG = 180 / Math.PI

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function wrapAngle180(deg: number): number {
  let d = deg % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

export function wrapAngle360(deg: number): number {
  return ((deg % 360) + 360) % 360
}

// Vec3 operations (NED tuples)
export function v3add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

export function v3sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function v3scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s]
}

export function v3dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function v3cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ]
}

export function v3len(a: Vec3): number {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2])
}

export function v3norm(a: Vec3): Vec3 {
  const l = v3len(a)
  if (l < 1e-12) return [0, 0, 0]
  return [a[0] / l, a[1] / l, a[2] / l]
}

export function v3dist(a: Vec3, b: Vec3): number {
  return v3len(v3sub(a, b))
}

// Rotate a vector by quaternion
export function quatRotateVec(q: Quat, v: Vec3): Vec3 {
  const [qw, qx, qy, qz] = q
  const [vx, vy, vz] = v
  // q * v * q^-1 using cross-product formula
  const tx = 2 * (qy * vz - qz * vy)
  const ty = 2 * (qz * vx - qx * vz)
  const tz = 2 * (qx * vy - qy * vx)
  return [
    vx + qw * tx + qy * tz - qz * ty,
    vy + qw * ty + qz * tx - qx * tz,
    vz + qw * tz + qx * ty - qy * tx
  ]
}

export function quatConjugate(q: Quat): Quat {
  return [q[0], -q[1], -q[2], -q[3]]
}

export function quatNorm(q: Quat): Quat {
  const l = Math.sqrt(q[0] ** 2 + q[1] ** 2 + q[2] ** 2 + q[3] ** 2)
  if (l < 1e-12) return [1, 0, 0, 0]
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]
}

export function quatMul(a: Quat, b: Quat): Quat {
  const [aw, ax, ay, az] = a
  const [bw, bx, by, bz] = b
  return [
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw
  ]
}

// Quaternion from Euler angles (ZYX: yaw-pitch-roll in radians)
export function quatFromEulerZYX(yawRad: number, pitchRad: number, rollRad: number): Quat {
  const cy = Math.cos(yawRad * 0.5), sy = Math.sin(yawRad * 0.5)
  const cp = Math.cos(pitchRad * 0.5), sp = Math.sin(pitchRad * 0.5)
  const cr = Math.cos(rollRad * 0.5), sr = Math.sin(rollRad * 0.5)
  return [
    cr * cp * cy + sr * sp * sy,
    sr * cp * cy - cr * sp * sy,
    cr * sp * cy + sr * cp * sy,
    cr * cp * sy - sr * sp * cy
  ]
}

// Extract Euler angles from quaternion (ZYX convention), returns [yaw, pitch, roll] in radians
export function eulerFromQuat(q: Quat): [number, number, number] {
  const [w, x, y, z] = q
  const sinp = 2 * (w * y - z * x)
  const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp)
  const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))
  const roll = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y))
  return [yaw, pitch, roll]
}

// NED to Three.js world (Y-up, right-hand)
// NED: x=North, y=East, z=Down
// Three.js: x=East, y=Up, z=South
export function nedToThree(pos: Vec3): THREE.Vector3 {
  return new THREE.Vector3(pos[1], -pos[2], -pos[0])
}

export function nedVelToThreeDir(vel: Vec3): THREE.Vector3 {
  return new THREE.Vector3(vel[1], -vel[2], -vel[0])
}

// Convert NED quaternion to Three.js quaternion.
//
// Coordinate mappings (nedToThree):
//   NED +X (North/forward) → Three.js -Z
//   NED +Y (East/right)    → Three.js +X
//   NED +Z (Down)          → Three.js -Y
//
// The correct transform is a similarity: q_three = q_M * q_ned * q_M⁻¹
// where q_M = [w=0.5, x=0.5, y=0.5, z=-0.5] encodes the basis change.
//
// Sanity check: identity NED attitude → identity Three.js quaternion
// (camera default forward −Z already equals Three.js North).
export function nedQuatToThree(q: Quat): THREE.Quaternion {
  // q_M in Three.js (x,y,z,w) order
  const qM    = new THREE.Quaternion( 0.5,  0.5, -0.5, 0.5)
  const qMInv = new THREE.Quaternion(-0.5, -0.5,  0.5, 0.5)   // conjugate of unit quat
  const qN    = new THREE.Quaternion(q[1], q[2],  q[3], q[0]) // wxyz → xyzw
  return qM.clone().multiply(qN).multiply(qMInv)
}

export function stateVecToArrays(sv: StateVec): { pos: Vec3; vel: Vec3; q: Quat; omega: Vec3 } {
  return {
    pos: [sv[0], sv[1], sv[2]],
    vel: [sv[3], sv[4], sv[5]],
    q: [sv[6], sv[7], sv[8], sv[9]],
    omega: [sv[10], sv[11], sv[12]]
  }
}

export function arraysToStateVec(pos: Vec3, vel: Vec3, q: Quat, omega: Vec3): StateVec {
  return [pos[0], pos[1], pos[2], vel[3-3], vel[4-3], vel[5-3],
    q[0], q[1], q[2], q[3], omega[0], omega[1], omega[2]] as StateVec
}

export function makeStateVec(pos: Vec3, vel: Vec3, q: Quat, omega: Vec3): StateVec {
  return [
    pos[0], pos[1], pos[2],
    vel[0], vel[1], vel[2],
    q[0], q[1], q[2], q[3],
    omega[0], omega[1], omega[2]
  ]
}
