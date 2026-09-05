import type { ControlInputs } from '../types/aircraft'

/**
 * A hands-off control frame, with any subset overridden.
 *
 * Every producer of {@link ControlInputs} that is not the pilot's own hands —
 * each AI behaviour, each physics test — used to spell out all two dozen fields
 * inline, so adding one field meant editing sixteen call sites and the compiler
 * was the only thing keeping them in step. Build from here instead and set only
 * what the caller actually commands.
 */
export function neutralControls(overrides: Partial<ControlInputs> = {}): ControlInputs {
  return {
    pitch: 0,
    roll: 0,
    yaw: 0,
    throttle: 0,
    fireGun: false,
    fireMissile: false,
    cycleMissile: false,
    dispenseFlare: false,
    dispenseChaff: false,
    toggleGear: false,
    cycleFlaps: false,
    brakeHeld: false,
    speedBrakeToggle: false,
    radarAirGroundToggle: false,
    radarSelectNext: false,
    radarLockTarget: false,
    radarUnlock: false,
    ejectRequested: false,
    tgpToggle: false,
    tgpLock: false,
    tgpUnlock: false,
    wingmanEngage: false,
    wingmanCover: false,
    wingmanRTB: false,
    wingmanRejoin: false,
    lookBack: false,
    padlockToggle: false,
    ...overrides,
  }
}
