import type { AircraftState } from '../types/aircraft'
import type { EntityManager } from '../entities/EntityManager'
import type { PlayerAircraft } from '../entities/PlayerAircraft'
import type { Aircraft } from '../entities/Aircraft'
import { mToFt } from '../utils/Units'
import { sustainedTurnRateRefDegS } from '../data/aircraft/turnPerformance'
import { F16C } from '../data/aircraft/f16c'
import { F22 } from '../data/aircraft/f22'
import { MIG29 } from '../data/aircraft/mig29'
import { SU57 } from '../data/aircraft/su57'
import type * as THREE from 'three'
import { R73 } from '../data/weapons/r73'
import { getStoreDragPenalty } from '../data/weapons/catalog'
import { v3sub, RAD2DEG, quatRotateVec, quatConjugate } from '../utils/MathUtils'
import { getWeather, setWeather, resetWeather, type TurbulenceLevel } from '../physics/WeatherState'
import { GROUND_TARGET_SPECS } from '../data/groundTargets/catalog'

const ENEMY_SPECS = { 'F-16C': F16C, 'F-22A': F22, 'MiG-29': MIG29, 'Su-57': SU57 } as const
const BEHAVIORS   = ['FOLLOW_BEHIND', 'FOLLOW_IN_FRONT', 'FLY_STRAIGHT', 'TURN_CONSTANTLY', 'BVR_ENGAGE', 'AVOIDANCE'] as const

export class DebugOverlay {
  private panel: HTMLDivElement
  private telemetry: HTMLPreElement
  private weaponLabel: HTMLDivElement
  private enemyRwrStatus: HTMLDivElement
  private visible = false

  constructor(
    private player: PlayerAircraft,
    private entityManager: EntityManager,
    private scene: THREE.Scene
  ) {
    this.panel           = document.createElement('div')
    this.telemetry       = document.createElement('pre')
    this.weaponLabel     = document.createElement('div')
    this.enemyRwrStatus  = document.createElement('div')
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

    const wingmanBtn = this.makeButton('★ Spawn Wingman (off left wing)', () => {
      const ps = this.player.state.positionNED
      const vel = this.player.state.velocityNED
      const spd = Math.hypot(vel[0], vel[1]) || 250
      const fwdN = vel[0] / spd, fwdE = vel[1] / spd
      // Left wing is rotated 90° CCW from forward in horizontal plane
      const leftN = -fwdE
      const leftE = fwdN
      const spawnPos: [number, number, number] = [
        ps[0] + leftN * 200 - fwdN * 80,
        ps[1] + leftE * 200 - fwdE * 80,
        ps[2],
      ]
      const spawnVel: [number, number, number] = [vel[0], vel[1], 0]
      // Match the player's own aircraft type so the wingman has matching capabilities.
      this.entityManager.spawnWingman(this.player.spec, [], spawnPos, spawnVel)
    })
    spawnSection.appendChild(wingmanBtn)

    // Ground target spawner
    const gtSel = document.createElement('select')
    Object.assign(gtSel.style, this.selectStyle())
    Object.values(GROUND_TARGET_SPECS).forEach(spec => {
      const opt = document.createElement('option')
      opt.value = spec.id
      opt.textContent = spec.displayName
      gtSel.appendChild(opt)
    })
    spawnSection.appendChild(gtSel)
    spawnSection.appendChild(this.makeButton('▼ Spawn Ground Target (3 km below)', () => {
      const ps = this.player.state.positionNED
      const vel = this.player.state.velocityNED
      const spd = Math.hypot(vel[0], vel[1]) || 250
      const uN = vel[0] / spd, uE = vel[1] / spd
      const dropDistM = 3000
      const spec = GROUND_TARGET_SPECS[gtSel.value]!
      const pos: [number, number, number] = [
        ps[0] + uN * dropDistM,
        ps[1] + uE * dropDistM,
        0,  // ground
      ]
      this.entityManager.spawnGroundTarget(spec, pos, Math.atan2(uE, uN) * RAD2DEG)
    }))

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
    playerSection.appendChild(this.makeButton('+ Load A/G stores (AGM-65 ×2, Mk-82 ×4)', () => {
      this.player.loadAirToGroundStores()
      this.updateWeaponLabel()
    }))
    playerSection.appendChild(this.makeButton('◎ Toggle TGP / FLIR', () => {
      this.player.targetingPod.toggle()
    }))
    playerSection.appendChild(this.makeButton('◉ TGP: Auto-lock closest ground target', () => {
      this.player.targetingPod.lockClosest(
        this.player.state.positionNED,
        this.player.state.attitudeQuat,
        this.entityManager.getGroundTargets(),
        90,  // wide cone for debug ease — pod doesn't need to be precisely pointed
      )
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
      chk.onchange = () => { (window as unknown as Record<string, unknown>)[key] = chk.checked }
      const lbl = document.createElement('label')
      Object.assign(lbl.style, { cursor: 'pointer' })
      lbl.textContent = ' ' + label
      lbl.prepend(chk)
      visSection.appendChild(lbl)
      visSection.appendChild(document.createElement('br'))
    }
    p.appendChild(visSection)

    // ── WEATHER ───────────────────────────────────────────────────────────────
    const wxSection = this.makeSection('WEATHER')

    const wxRow = (label: string, child: HTMLElement) => {
      const row = document.createElement('div')
      Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' })
      const lbl = document.createElement('span')
      lbl.textContent = label
      Object.assign(lbl.style, { color: '#9c9', fontSize: '11px', minWidth: '70px' })
      row.appendChild(lbl)
      row.appendChild(child)
      return row
    }

    const wx = getWeather()

    // Surface wind direction (FROM degrees)
    const dirSlider = document.createElement('input')
    dirSlider.type = 'range'; dirSlider.min = '0'; dirSlider.max = '359'; dirSlider.step = '5'
    dirSlider.value = String(wx.surfaceWindFromDeg)
    Object.assign(dirSlider.style, { flex: '1', cursor: 'pointer', accentColor: '#0f0' })
    const dirLabel = document.createElement('span')
    Object.assign(dirLabel.style, { color: '#0ff', fontSize: '11px', minWidth: '36px' })
    dirLabel.textContent = `${wx.surfaceWindFromDeg}°`
    dirSlider.oninput = () => {
      const v = parseInt(dirSlider.value, 10)
      dirLabel.textContent = `${v}°`
      setWeather({ surfaceWindFromDeg: v, upperWindFromDeg: v })
    }
    const dirRow = document.createElement('div')
    Object.assign(dirRow.style, { display: 'flex', gap: '4px' })
    dirRow.appendChild(dirSlider); dirRow.appendChild(dirLabel)
    wxSection.appendChild(wxRow('Wind FROM', dirRow))

    // Wind speed (m/s — surface; upper auto-set to 1.5×)
    const spdSlider = document.createElement('input')
    spdSlider.type = 'range'; spdSlider.min = '0'; spdSlider.max = '40'; spdSlider.step = '1'
    spdSlider.value = String(wx.surfaceWindMS)
    Object.assign(spdSlider.style, { flex: '1', cursor: 'pointer', accentColor: '#0f0' })
    const spdLabel = document.createElement('span')
    Object.assign(spdLabel.style, { color: '#0ff', fontSize: '11px', minWidth: '52px' })
    spdLabel.textContent = `${wx.surfaceWindMS} m/s`
    spdSlider.oninput = () => {
      const v = parseInt(spdSlider.value, 10)
      spdLabel.textContent = `${v} m/s`
      setWeather({ surfaceWindMS: v, upperWindMS: v * 1.5 })
    }
    const spdRow = document.createElement('div')
    Object.assign(spdRow.style, { display: 'flex', gap: '4px' })
    spdRow.appendChild(spdSlider); spdRow.appendChild(spdLabel)
    wxSection.appendChild(wxRow('Wind speed', spdRow))

    // Turbulence
    const turbSel = document.createElement('select')
    Object.assign(turbSel.style, this.selectStyle())
    ;(['CALM', 'LIGHT', 'MODERATE', 'SEVERE'] as TurbulenceLevel[]).forEach(t => {
      const opt = document.createElement('option')
      opt.value = opt.textContent = t
      if (t === wx.turbulence) opt.selected = true
      turbSel.appendChild(opt)
    })
    turbSel.onchange = () => setWeather({ turbulence: turbSel.value as TurbulenceLevel })
    wxSection.appendChild(wxRow('Turbulence', turbSel))

    wxSection.appendChild(this.makeButton('↺ Reset weather', () => {
      resetWeather()
      const w = getWeather()
      dirSlider.value = String(w.surfaceWindFromDeg); dirLabel.textContent = `${w.surfaceWindFromDeg}°`
      spdSlider.value = String(w.surfaceWindMS); spdLabel.textContent = `${w.surfaceWindMS} m/s`
      turbSel.value = w.turbulence
    }))
    p.appendChild(wxSection)

    const radarSim = this.makeSection('ENEMY RADAR / RWR SIM')
    Object.assign(this.enemyRwrStatus.style, {
      fontSize: '10px',
      lineHeight: '1.45',
      color: '#ffaaaa',
      marginBottom: '6px',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    })
    radarSim.appendChild(this.enemyRwrStatus)

    radarSim.appendChild(this.makeButton('✕ Clear simulated threats', () => {
      this.player.rwr.clearDebugInjectedThreats()
    }))

    radarSim.appendChild(this.makeButton('▸ Sim hostile SEARCH (new contact)', () => {
      const az = this.bodyAzimuthTowardNearestBanditDeg()
      this.player.rwr.injectDebugEnemySearch(az)
    }))
    radarSim.appendChild(this.makeButton('▸ Sim hostile TRACK', () => {
      this.player.rwr.injectDebugEnemyTrack(this.bodyAzimuthTowardNearestBanditDeg())
    }))
    radarSim.appendChild(this.makeButton('▸ Sim hostile radar LOCK (STT)', () => {
      this.player.rwr.injectDebugEnemyRadarLock(this.bodyAzimuthTowardNearestBanditDeg())
    }))
    radarSim.appendChild(this.makeButton('▸ Sim missile launch (EW + voice only)', () => {
      this.player.rwr.injectDebugEnemyMissileIndication(this.bodyAzimuthTowardNearestBanditDeg())
    }))
    radarSim.appendChild(this.makeButton('▸ Spawn inbound missile (physics)', () => {
      this.entityManager.launchMissileAtPlayer()
    }))
    p.appendChild(radarSim)

    void this.scene  // silence unused warning
  }

  // ── Live telemetry update ─────────────────────────────────────────────────

  update(state: AircraftState): void {
    if (!this.visible) return
    const kts = Math.round(state.iasKts)
    const ft  = Math.round(mToFt(state.altitudeM))
    const trSign = state.headingRateDegPerSec >= 0 ? '+' : ''
    let trLine = `TrnRt: ${trSign}${state.headingRateDegPerSec.toFixed(1)}°/s`
    const refTurn = sustainedTurnRateRefDegS(this.player.spec.id)
    if (refTurn) trLine += ` (ref ${refTurn.min}–${refTurn.max})`
    const sinkLine = state.lastTouchdownSinkMS !== null && state.lastTouchdownSinkMS !== undefined
      ? `\nTD sink: ${state.lastTouchdownSinkMS.toFixed(1)} m/s${state.gearCollapsed ? ' [GEAR FAIL]' : ''}`
      : ''
    this.telemetry.textContent =
      `IAS:   ${kts} kt\n` +
      `AoA:   ${state.alphaDeg.toFixed(1)}°\n` +
      `G:     ${state.gCurrent.toFixed(1)} (max ${state.gMax.toFixed(1)})\n` +
      `Mach:  ${state.mach.toFixed(2)}\n` +
      `Alt:   ${ft} ft\n` +
      `${trLine}\n` +
      `Hdg:   ${Math.round(state.headingDeg).toString().padStart(3,'0')}°\n` +
      `Pitch: ${state.pitchDeg.toFixed(1)}°\n` +
      `Roll:  ${state.rollDeg.toFixed(1)}°` +
      sinkLine
    this.updateWeaponLabel()
    this.updateEnemyRwrSimStatus()
  }

  toggle(): void {
    this.visible = !this.visible
    this.panel.style.display = this.visible ? 'block' : 'none'
    // Release pointer lock so the system cursor is visible and buttons are clickable
    if (this.visible) {
      document.exitPointerLock()
      this.updateWeaponLabel()
      this.updateEnemyRwrSimStatus()
    }
  }

  dispose(): void {
    this.panel.remove()
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private updateWeaponLabel(): void {
    this.weaponLabel.textContent = this.player.getSelectedWeaponName()
  }

  private nearestEnemy(): Aircraft | null {
    const enemies = this.entityManager.getEnemies()
    if (enemies.length === 0) return null
    const p = this.player.state.positionNED
    let best: Aircraft = enemies[0]!
    let bestD = Infinity
    for (const e of enemies) {
      const d = Math.hypot(
        e.state.positionNED[0] - p[0],
        e.state.positionNED[1] - p[1],
        e.state.positionNED[2] - p[2]
      )
      if (d < bestD) {
        bestD = d
        best = e
      }
    }
    return best
  }

  private bodyAzimuthTowardNearestBanditDeg(): number {
    const e = this.nearestEnemy()
    const own = this.player.state
    if (!e) {
      return Math.round((Math.random() * 260 - 130) * 10) / 10
    }
    const toEnemy = v3sub(e.state.positionNED, own.positionNED)
    const bodyVec = quatRotateVec(quatConjugate(own.attitudeQuat), toEnemy)
    return Math.atan2(bodyVec[1], bodyVec[0]) * RAD2DEG
  }

  private updateEnemyRwrSimStatus(): void {
    const rwr = this.player.rwr.state
    const inj = this.player.rwr.getDebugInjectedThreatCount()
    this.enemyRwrStatus.textContent =
      `Simulated symbols stored: ${inj}\n` +
      `RWR symbols this frame: ${rwr.threats.length}`
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
