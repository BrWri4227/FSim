import type { AircraftState } from '../types/aircraft'
import type { EntityManager } from '../entities/EntityManager'
import type { PlayerAircraft } from '../entities/PlayerAircraft'
import { mToFt } from '../utils/Units'
import { F16C } from '../data/aircraft/f16c'
import { MIG29 } from '../data/aircraft/mig29'
import type * as THREE from 'three'
import { R73 } from '../data/weapons/r73'
import { getStoreDragPenalty } from '../data/weapons/catalog'

const ENEMY_SPECS = { 'F-16C': F16C, 'MiG-29': MIG29 } as const
const BEHAVIORS   = ['FOLLOW_BEHIND', 'FOLLOW_IN_FRONT', 'FLY_STRAIGHT', 'TURN_CONSTANTLY'] as const

export class DebugOverlay {
  private panel: HTMLDivElement
  private telemetry: HTMLPreElement
  private weaponLabel: HTMLDivElement
  private visible = false

  constructor(
    private player: PlayerAircraft,
    private entityManager: EntityManager,
    private scene: THREE.Scene
  ) {
    this.panel       = document.createElement('div')
    this.telemetry   = document.createElement('pre')
    this.weaponLabel = document.createElement('div')
    this.buildPanel()
    document.body.appendChild(this.panel)
  }

  private buildPanel(): void {
    const p = this.panel
    p.id = 'debug-overlay'
    Object.assign(p.style, {
      position: 'fixed', top: '0', right: '0',
      background: 'rgba(0,0,0,0.88)', color: '#0f0',
      fontFamily: 'monospace', fontSize: '12px',
      padding: '10px', width: '270px', zIndex: '9999',
      display: 'none',
      maxHeight: '100vh', overflowY: 'auto',
      boxShadow: '0 0 12px rgba(0,255,0,0.3)'
    })

    // ── SPAWN ENEMY ──────────────────────────────────────────────────────────
    const spawnSection = this.makeSection('SPAWN ENEMY')

    // Behaviour selector
    const behaviorSel = document.createElement('select')
    Object.assign(behaviorSel.style, this.selectStyle())
    BEHAVIORS.forEach(b => {
      const opt = document.createElement('option')
      opt.value = opt.textContent = b
      behaviorSel.appendChild(opt)
    })
    spawnSection.appendChild(behaviorSel)

    // Aircraft type selector
    const acSel = document.createElement('select')
    Object.assign(acSel.style, this.selectStyle())
    Object.keys(ENEMY_SPECS).forEach(k => {
      const opt = document.createElement('option')
      opt.value = opt.textContent = k
      acSel.appendChild(opt)
    })
    spawnSection.appendChild(acSel)

    // Spawn distance slider (500–20000 m)
    const distRow = document.createElement('div')
    Object.assign(distRow.style, { display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' })

    const distSlider = document.createElement('input')
    distSlider.type = 'range'
    distSlider.min = '500'; distSlider.max = '20000'; distSlider.step = '500'; distSlider.value = '3000'
    Object.assign(distSlider.style, { flex: '1', cursor: 'pointer', accentColor: '#0f0' })

    const distLabel = document.createElement('span')
    distLabel.textContent = '3.0 km'
    Object.assign(distLabel.style, { color: '#0ff', fontSize: '11px', whiteSpace: 'nowrap', minWidth: '42px' })

    distSlider.oninput = () => {
      distLabel.textContent = `${(parseFloat(distSlider.value) / 1000).toFixed(1)} km`
    }

    distRow.appendChild(distSlider)
    distRow.appendChild(distLabel)
    spawnSection.appendChild(distRow)

    const spawnBtn = this.makeButton('▶ Spawn Enemy (head-on)', () => {
      const behavior = behaviorSel.value as typeof BEHAVIORS[number]
      const spec     = ENEMY_SPECS[acSel.value as keyof typeof ENEMY_SPECS]!
      const ps  = this.player.state.positionNED
      const vel = this.player.state.velocityNED
      const spawnDistM = parseFloat(distSlider.value)

      // Unit vector along player's current velocity
      const spd   = Math.hypot(vel[0], vel[1], vel[2]) || 250
      const uN    = vel[0] / spd
      const uE    = vel[1] / spd

      // Spawn ahead of the player along their heading, same altitude
      const spawnPos: [number,number,number] = [
        ps[0] + uN * spawnDistM,
        ps[1] + uE * spawnDistM,
        ps[2]
      ]

      // Fly head-on toward the player at ~220 m/s (creates a classic BFM merge)
      const spawnVel: [number,number,number] = [
        -uN * 220,
        -uE * 220,
        0
      ]

      this.entityManager.spawnEnemy(
        spec,
        [
          { hardpointId: 'W1', weaponId: 'r73', category: 'IR_MISSILE' as const, massKg: R73.massKg, dragPenalty: getStoreDragPenalty(R73), remainingRounds: 1 },
          { hardpointId: 'E1', weaponId: 'r73', category: 'IR_MISSILE' as const, massKg: R73.massKg, dragPenalty: getStoreDragPenalty(R73), remainingRounds: 1 }
        ],
        behavior,
        spawnPos,
        spawnVel
      )
    })
    spawnSection.appendChild(spawnBtn)

    const missileBtn = this.makeButton('🚀 Spawn Missile at Player', () => {
      this.entityManager.launchMissileAtPlayer()
    })
    spawnSection.appendChild(missileBtn)
    p.appendChild(spawnSection)

    // ── PLAYER CONTROLS ──────────────────────────────────────────────────────
    const playerSection = this.makeSection('PLAYER CONTROLS')

    // Invincibility toggle
    const invincChk = document.createElement('input')
    invincChk.type = 'checkbox'
    Object.assign(invincChk.style, { cursor: 'pointer' })
    invincChk.onchange = () => { this.player.state.invincible = invincChk.checked }
    const invincLabel = document.createElement('label')
    Object.assign(invincLabel.style, { cursor: 'pointer' })
    invincLabel.textContent = ' Invincibility'
    invincLabel.prepend(invincChk)
    playerSection.appendChild(invincLabel)
    playerSection.appendChild(document.createElement('br'))

    // Weapon cycle — shows selected weapon name and lets you cycle
    const weaponRow = document.createElement('div')
    Object.assign(weaponRow.style, { display: 'flex', gap: '4px', margin: '4px 0', alignItems: 'center' })

    const cycleBtn = document.createElement('button')
    cycleBtn.textContent = '⟳ Cycle Weapon'
    cycleBtn.style.cssText = this.btnStyle() + 'flex:1;'
    cycleBtn.onclick = () => {
      this.player.cycleWeapon()
      this.updateWeaponLabel()
    }

    this.weaponLabel.style.cssText = 'color:#0ff;font-size:11px;white-space:nowrap;padding:0 2px;'
    this.updateWeaponLabel()

    weaponRow.appendChild(cycleBtn)
    weaponRow.appendChild(this.weaponLabel)
    playerSection.appendChild(weaponRow)

    playerSection.appendChild(this.makeButton('↺ Reload Weapons', () => {
      this.player.reloadWeapons()
      this.updateWeaponLabel()
    }))
    playerSection.appendChild(this.makeButton('⊕ Reset Position', () => this.player.resetPosition()))
    p.appendChild(playerSection)

    // ── TELEMETRY ────────────────────────────────────────────────────────────
    const telSection = this.makeSection('TELEMETRY')
    this.telemetry.style.cssText = 'margin:0;font-size:11px;line-height:1.5;'
    telSection.appendChild(this.telemetry)
    p.appendChild(telSection)

    // ── VISUAL TOGGLES ────────────────────────────────────────────────────────
    const visSection = this.makeSection('VISUALS')
    const visToggles = [
      ['showVelocity',    'Velocity Vector'],
      ['showSeekerCone',  'Missile Seeker Cone'],
      ['showRadarCone',   'Radar Cone'],
    ] as const

    for (const [key, label] of visToggles) {
      const chk = document.createElement('input')
      chk.type = 'checkbox'
      Object.assign(chk.style, { cursor: 'pointer' })
      chk.onchange = () => { ;(window as any)[key] = chk.checked }
      const lbl = document.createElement('label')
      Object.assign(lbl.style, { cursor: 'pointer' })
      lbl.textContent = ' ' + label
      lbl.prepend(chk)
      visSection.appendChild(lbl)
      visSection.appendChild(document.createElement('br'))
    }
    p.appendChild(visSection)

    void this.scene  // silence unused warning
  }

  // ── Live telemetry update ─────────────────────────────────────────────────

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
    this.updateWeaponLabel()
  }

  toggle(): void {
    this.visible = !this.visible
    this.panel.style.display = this.visible ? 'block' : 'none'
    // Release pointer lock so the system cursor is visible and buttons are clickable
    if (this.visible) {
      document.exitPointerLock()
      this.updateWeaponLabel()
    }
  }

  dispose(): void {
    document.body.removeChild(this.panel)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private updateWeaponLabel(): void {
    this.weaponLabel.textContent = this.player.getSelectedWeaponName()
  }

  private makeSection(title: string): HTMLDivElement {
    const sec = document.createElement('div')
    sec.style.cssText = 'margin-bottom:10px;'
    const h = document.createElement('div')
    h.textContent = `── ${title} ──`
    h.style.cssText = 'color:#aaffaa;margin-bottom:5px;font-size:11px;letter-spacing:1px;'
    sec.appendChild(h)
    return sec
  }

  private makeButton(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.textContent = label
    btn.style.cssText = this.btnStyle()
    btn.onclick = onClick
    return btn
  }

  private btnStyle(): string {
    return 'display:block;width:100%;margin:3px 0;background:#0a2a0a;color:#0f0;border:1px solid #0f0;cursor:pointer;font:11px monospace;padding:4px 6px;text-align:left;'
  }

  private selectStyle(): Partial<CSSStyleDeclaration> {
    return {
      width: '100%',
      marginBottom: '4px',
      background: '#0a2a0a',
      color: '#0f0',
      border: '1px solid #0f0',
      fontFamily: 'monospace',
      fontSize: '11px',
      cursor: 'pointer',
    }
  }
}
