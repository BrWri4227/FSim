/**
 * Team partitioning — the load-bearing half of friendly fire.
 *
 * [PlayerAircraft.update] hands one array to the gun, the missile system, the
 * radar and the RWR, so whatever `getHostiles()` returns is exactly what the
 * player can track, lock and shoot. A bug here means either shooting your own
 * wingman or being unable to shoot the enemy, and neither would be obvious
 * from a typecheck.
 */
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { EntityManager } from './EntityManager'
import { PlayerAircraft } from './PlayerAircraft'
import { F16C } from '../data/aircraft/f16c'
import { MIG29 } from '../data/aircraft/mig29'
import type { NetPlayerState } from '../network/MultiplayerTypes'

function netState(pos: [number, number, number]): NetPlayerState {
  return {
    positionNED: pos,
    velocityNED: [200, 0, 0],
    attitudeQuat: [1, 0, 0, 0],
    throttle: 0.6,
    ejected: false,
    structuralFailure: false,
    radar: { mode: 'RWS', sttTargetId: null },
    missiles: [],
    countermeasures: null,
  }
}

function makeManager(): EntityManager {
  const scene = new THREE.Scene()
  const player = new PlayerAircraft(F16C, [], scene, true, false)
  return new EntityManager(scene, player)
}

describe('EntityManager team partitioning', () => {
  it('defaults the local pilot to BLUE', () => {
    expect(makeManager().getLocalTeam()).toBe('BLUE')
  })

  it('puts the opposing side in hostiles and our own side in friendlies', () => {
    const em = makeManager()
    em.setLocalTeam('BLUE')
    em.upsertRemotePlayer('peer_1', F16C, netState([1000, 0, -5000]), 'Ally', 'BLUE')
    em.upsertRemotePlayer('peer_2', MIG29, netState([2000, 0, -5000]), 'Bandit', 'RED')

    expect(em.getHostiles().map(a => a.entityId)).toEqual(['peer_2'])
    expect(em.getFriendlies().map(a => a.entityId)).toEqual(['peer_1'])
  })

  it('keeps teammates visible even though they are untargetable', () => {
    // Filtering a teammate out of the hostile list also removes them from the
    // radar and the HUD's enemy pass. getFriendlies is what puts them back, and
    // a team you cannot see is not a team.
    const em = makeManager()
    em.upsertRemotePlayer('peer_1', F16C, netState([1000, 0, -5000]), 'Ally', 'BLUE')
    expect(em.getHostiles()).toHaveLength(0)
    expect(em.getFriendlies()).toHaveLength(1)
    expect(em.getAllAircraft()).toHaveLength(1)
  })

  it('re-partitions when a peer switches sides', () => {
    const em = makeManager()
    em.upsertRemotePlayer('peer_1', MIG29, netState([1000, 0, -5000]), 'Switcher', 'RED')
    expect(em.getHostiles()).toHaveLength(1)

    // Same peer, new side. The cached partitions must not survive this, or the
    // pilot stays lockable until something unrelated invalidates them.
    em.upsertRemotePlayer('peer_1', MIG29, netState([1100, 0, -5000]), 'Switcher', 'BLUE')
    expect(em.getHostiles()).toHaveLength(0)
    expect(em.getFriendlies()).toHaveLength(1)
  })

  it('re-partitions when the local pilot switches sides', () => {
    const em = makeManager()
    em.upsertRemotePlayer('peer_1', MIG29, netState([1000, 0, -5000]), 'Other', 'RED')
    expect(em.getHostiles()).toHaveLength(1)

    em.setLocalTeam('RED')
    expect(em.getHostiles()).toHaveLength(0)
    expect(em.getFriendlies()).toHaveLength(1)
  })

  it('treats a peer that declared no team as BLUE', () => {
    // Older clients send no team. Both receivers must reach the same answer, or
    // one of them can shoot a pilot the other cannot.
    const em = makeManager()
    em.setLocalTeam('BLUE')
    em.upsertRemotePlayer('peer_1', F16C, netState([1000, 0, -5000]), 'Legacy')
    expect(em.getFriendlies().map(a => a.entityId)).toEqual(['peer_1'])
    expect(em.getHostiles()).toHaveLength(0)
  })

  it('keeps AI hostile regardless of our side', () => {
    const em = makeManager()
    em.spawnEnemy(MIG29, [], 'FLY_STRAIGHT', [5000, 0, -5000], [200, 0, 0])
    expect(em.getHostiles()).toHaveLength(1)
    em.setLocalTeam('RED')
    expect(em.getHostiles()).toHaveLength(1)
  })

  it('reports a remote player team by id, and null for AI', () => {
    const em = makeManager()
    em.upsertRemotePlayer('peer_1', MIG29, netState([1000, 0, -5000]), 'Bandit', 'RED')
    const ai = em.spawnEnemy(MIG29, [], 'FLY_STRAIGHT', [5000, 0, -5000], [200, 0, 0])
    expect(em.teamOf('peer_1')).toBe('RED')
    expect(em.teamOf(ai.entityId)).toBeNull()
  })

  it('drops a departed peer from both partitions', () => {
    const em = makeManager()
    em.upsertRemotePlayer('peer_1', MIG29, netState([1000, 0, -5000]), 'Bandit', 'RED')
    em.upsertRemotePlayer('peer_2', F16C, netState([2000, 0, -5000]), 'Ally', 'BLUE')
    em.removeRemotePlayer('peer_1')
    expect(em.getHostiles()).toHaveLength(0)
    expect(em.getFriendlies()).toHaveLength(1)
  })
})
