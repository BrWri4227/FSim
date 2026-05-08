import type { AircraftState } from '../types/aircraft'
import type { EntityManager } from '../entities/EntityManager'
import type { PlayerAircraft } from '../entities/PlayerAircraft'
import { mToFt } from '../utils/Units'
import { F16C } from '../data/aircraft/f16c'
import { MIG29 } from '../data/aircraft/mig29'
import type * as THREE from 'three'

const ENEMY_SPECS = { 'F-16C': F16C, 'MiG-29': MIG29 } as const
const BEHAVIORS   = ['FOLLOW_BEHIND', 'FOLLOW_IN_FRONT', 'FLY_STRAIGHT', 'TURN_CONSTANTLY'] as const

export class DebugOverlay {
  private panel: HTMLDivElement
  private telemetry: HTMLPreElement
  private visible = false

  constructor(
    private player: PlayerAircraft,
    private entityManager: EntityManager,
    private scene: THREE.Scene
  ) {
    this.panel     = document.createElement('div')
    this.telemetry = document.createElement('pre')
    this.buildPanel()
    document.body.appendChild(this.panel)
  }

  private buildPanel(): void {
    const p = this.panel
    p.id = 'debug-overlay'
    Object.assign(p.style, {
      position: 'fixed', top: '0', right: '0',
      background: 'rgba(0,0,0,0.8)', color: '#0f0',
      fontFamily: 'monospace', fontSize: '12px',
      padding: '10px', width: '260px', zIndex: '9999',
      display: 'none', userSelect: 'none',
      maxHeight: '100vh', overflowY: 'auto'
    })

    // --- Spawn controls ---
    const spawnSection = this.makeSection('SPAWN ENEMY')

    const behaviorSel = document.createElement('select')
    BEHAVIORS.forEach(b => {
      const opt = document.createElement('option')
      opt.value = opt.textContent = b
      behaviorSel.appendChild(opt)
    })
    behaviorSel.style.width = '100%'
    spawnSection.appendChild(behaviorSel)

    const acSel = document.createElement('select')
    Object.keys(ENEMY_SPECS).forEach(k => {
      const opt = document.createElement('option')
      opt.value = opt.textContent = k
      acSel.appendChild(opt)
    })
    acSel.style.width = '100%'
    spawnSection.appendChild(acSel)

    const spawnBtn = this.makeButton('Spawn Enemy', () => {
      const behavior = behaviorSel.value as typeof BEHAVIORS[number]
      const spec     = ENEMY_SPECS[acSel.value as keyof typeof ENEMY_SPECS]!
      const ps       = this.player.state.positionNED
      const spawnPos: [number,number,number] = [ps[0] - 2000, ps[1], ps[2]]
      const spawnVel: [number,number,number] = [200, 0, 0]
      this.entityManager.spawnEnemy(spec, [
        { hardpointId: 'W1', weaponId: 'r73', category: 'IR_MISSILE' as const, massKg: 105, dragPenalty: 0.002, remainingRounds: 1 },
        { hardpointId: 'E1', weaponId: 'r73', category: 'IR_MISSILE' as const, massKg: 105, dragPenalty: 0.002, remainingRounds: 1 }
      ], behavior, spawnPos, spawnVel)
    })
    spawnSection.appendChild(spawnBtn)

    const missileBtn = this.makeButton('Spawn Missile at Player', () => {
      // Launch a missile from a spawned enemy at the player
      const enemies = this.entityManager.getEnemies()
      if (enemies.length === 0) {
        console.warn('[Debug] Spawn an enemy first')
        return
      }
      // AI aircraft don't have a missile system — note in console
      console.log('[Debug] Missile-at-player: spawn an enemy and let their AI fire')
    })
    spawnSection.appendChild(missileBtn)
    p.appendChild(spawnSection)

    // --- Player controls ---
    const playerSection = this.makeSection('PLAYER CONTROLS')

    const invincChk = document.createElement('input')
    invincChk.type = 'checkbox'
    invincChk.onchange = () => { this.player.state.invincible = invincChk.checked }
    const invincLabel = document.createElement('label')
    invincLabel.textContent = ' Invincibility'
    invincLabel.prepend(invincChk)
    playerSection.appendChild(invincLabel)
    playerSection.appendChild(document.createElement('br'))

    playerSection.appendChild(this.makeButton('Reload Weapons', () => this.player.reloadWeapons()))
    playerSection.appendChild(this.makeButton('Reset Position', () => this.player.resetPosition()))
    p.appendChild(playerSection)

    // --- Telemetry ---
    const telSection = this.makeSection('TELEMETRY')
    this.telemetry.style.margin = '0'
    telSection.appendChild(this.telemetry)
    p.appendChild(telSection)

    // --- Visual toggles ---
    const visSection = this.makeSection('VISUALS')
    const visToggles = [
      ['showVelocity', 'Velocity Vector'],
      ['showSeekerCone', 'Missile Seeker Cone'],
      ['showRadarCone', 'Radar Cone']
    ] as const

    for (const [key, label] of visToggles) {
      const chk = document.createElement('input')
      chk.type = 'checkbox'
      chk.onchange = () => {
        ;(window as any)[key] = chk.checked
      }
      const lbl = document.createElement('label')
      lbl.textContent = ' ' + label
      lbl.prepend(chk)
      visSection.appendChild(lbl)
      visSection.appendChild(document.createElement('br'))
    }
    p.appendChild(visSection)
  }

  private makeSection(title: string): HTMLDivElement {
    const sec = document.createElement('div')
    sec.style.marginBottom = '8px'
    const h = document.createElement('div')
    h.textContent = `── ${title} ──`
    h.style.color = '#aaffaa'
    h.style.marginBottom = '4px'
    sec.appendChild(h)
    return sec
  }

  private makeButton(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.textContent = label
    btn.style.cssText = 'display:block;width:100%;margin:2px 0;background:#1a3a1a;color:#0f0;border:1px solid #0f0;cursor:pointer;font:11px monospace;padding:3px'
    btn.onclick = onClick
    return btn
  }

  toggle(): void {
    this.visible = !this.visible
    this.panel.style.display = this.visible ? 'block' : 'none'
  }

  update(state: AircraftState): void {
    if (!this.visible) return
    const kts = Math.round(state.iasKts)
    const ft  = Math.round(mToFt(state.altitudeM))
    this.telemetry.textContent =
      `IAS:   ${kts} kt\n` +
      `AoA:   ${state.alphaDeg.toFixed(1)}°\n` +
      `G:     ${state.gCurrent.toFixed(1)} (max ${state.gMax.toFixed(1)})\n` +
      `Mach:  ${state.mach.toFixed(2)}\n` +
      `Alt:   ${ft} ft\n` +
      `Hdg:   ${Math.round(state.headingDeg).toString().padStart(3,'0')}°\n` +
      `Pitch: ${state.pitchDeg.toFixed(1)}°\n` +
      `Roll:  ${state.rollDeg.toFixed(1)}°`
  }

  dispose(): void {
    document.body.removeChild(this.panel)
  }
}
