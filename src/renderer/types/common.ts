// [x, y, z] in NED frame (North-East-Down) meters
export type Vec3 = [number, number, number]

// Quaternion [w, x, y, z]
export type Quat = [number, number, number, number]

// 13-element state vector for RK4: [px,py,pz, vx,vy,vz, qw,qx,qy,qz, p,q,r]
export type StateVec = [
  number, number, number,
  number, number, number,
  number, number, number, number,
  number, number, number
]

export interface AtmosphericFactors {
  densityKgM3: number
  temperatureK: number
  pressurePa: number
  speedOfSoundMS: number
  dynamicPressurePa: number
}
