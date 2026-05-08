import type { AircraftSpec } from '../types/aircraft'
import type { LoadedStore } from '../types/weapons'
import { F16C }  from '../data/aircraft/f16c'
import { F15C }  from '../data/aircraft/f15c'
import { FA18C } from '../data/aircraft/fa18c'
import { MIG29 } from '../data/aircraft/mig29'
import { SU27 }  from '../data/aircraft/su27'
import { SU35 }  from '../data/aircraft/su35'
import { AIM9M }   from '../data/weapons/aim9m'
import { AIM120B } from '../data/weapons/aim120b'
import { R73 }  from '../data/weapons/r73'
import { R77 }  from '../data/weapons/r77'
import { msToKts } from '../utils/Units'

const AIRCRAFT_ROSTER: AircraftSpec[] = [F16C, F15C, FA18C, MIG29, SU27, SU35]

const WEAPON_OPTIONS: Record<string, { label: string; count: number }> = {
  'aim9m':   { label: 'AIM-9M Sidewinder', count: 1 },
  'aim120b': { label: 'AIM-120B AMRAAM',   count: 1 },
  'r73':     { label: 'R-73 Archer',        count: 1 },
  'r77':     { label: 'R-77 Adder',         count: 1 },
  'none':    { label: '(Empty)',             count: 0 }
}

export class LoadoutScreen {
  private el: HTMLDivElement
  private selectedSpec: AircraftSpec = F16C
  private onLaunch: (spec: AircraftSpec, stores: LoadedStore[]) => void

  constructor(_container: HTMLElement, onLaunch: (spec: AircraftSpec, stores: LoadedStore[]) => void) {
    this.onLaunch = onLaunch
    this.el = document.createElement('div')
    Object.assign(this.el.style, {
      position: 'fixed', inset: '0',
      background: '#0a0f0a',
      color: '#00ff88', fontFamily: 'monospace',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', zIndex: '8000', gap: '20px'
    })
    document.body.appendChild(this.el)
    this.render()
  }

  private render(): void {
    this.el.innerHTML = ''

    const title = document.createElement('h1')
    title.textContent = 'FSIM — SELECT AIRCRAFT'
    title.style.cssText = 'color:#00ff88;letter-spacing:4px;font-size:22px;margin:0'
    this.el.appendChild(title)

    // Aircraft cards
    const grid = document.createElement('div')
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:900px'
    for (const spec of AIRCRAFT_ROSTER) {
      const card = document.createElement('div')
      const selected = spec === this.selectedSpec
      card.style.cssText = `border:1px solid ${selected ? '#00ff88' : '#226644'};padding:12px;cursor:pointer;background:${selected ? '#0f2a1a' : '#0a150a'};min-width:140px`
      card.innerHTML = `
        <div style="font-size:15px;font-weight:bold;color:${spec.nation === 'USA' ? '#4488ff' : '#ff4444'}">${spec.displayName}</div>
        <div style="font-size:11px;color:#88bb88;margin-top:4px">
          Nation: ${spec.nation}<br>
          Max G: +${spec.maxGPositive}<br>
          Max AoA: ${spec.maxAoADeg}°
        </div>
      `
      card.onclick = () => { this.selectedSpec = spec; this.render() }
      grid.appendChild(card)
    }
    this.el.appendChild(grid)

    // Hardpoints
    const hpSection = document.createElement('div')
    hpSection.style.cssText = 'border:1px solid #226644;padding:12px;max-width:900px;width:100%'
    hpSection.innerHTML = '<div style="margin-bottom:8px;color:#aaffcc">HARDPOINTS</div>'

    const selects: Array<{ hpId: string; sel: HTMLSelectElement }> = []
    for (const hp of this.selectedSpec.hardpoints) {
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0'

      const lbl = document.createElement('span')
      lbl.textContent = hp.id.padEnd(4, ' ')
      lbl.style.width = '40px'

      const sel = document.createElement('select')
      sel.style.cssText = 'background:#0a150a;color:#00ff88;border:1px solid #226644;font:11px monospace'
      sel.innerHTML = `<option value="none">(Empty)</option>`

      // Only show compatible weapons
      for (const [id, info] of Object.entries(WEAPON_OPTIONS)) {
        if (id === 'none') continue
        const wSpec = id === 'aim9m' ? AIM9M : id === 'aim120b' ? AIM120B : id === 'r73' ? R73 : R77
        if (!hp.compatibleTypes.includes(wSpec.category)) continue
        // Nation filter
        if ((wSpec.category === 'IR_MISSILE' || wSpec.category === 'ARH_MISSILE') &&
            ((id.startsWith('aim') && this.selectedSpec.nation !== 'USA') ||
             (id.startsWith('r') && this.selectedSpec.nation !== 'RUS'))) continue
        const opt = document.createElement('option')
        opt.value = id
        opt.textContent = info.label
        sel.appendChild(opt)
      }

      selects.push({ hpId: hp.id, sel })
      row.appendChild(lbl)
      row.appendChild(sel)
      hpSection.appendChild(row)
    }
    this.el.appendChild(hpSection)

    // Launch button
    const btn = document.createElement('button')
    btn.textContent = 'LAUNCH MISSION'
    btn.style.cssText = 'padding:14px 48px;font:bold 16px monospace;background:#0a2a0a;color:#00ff88;border:2px solid #00ff88;cursor:pointer;letter-spacing:3px'
    btn.onclick = () => {
      const stores: LoadedStore[] = selects
        .filter(s => s.sel.value !== 'none')
        .map(s => {
          const wSpec = s.sel.value === 'aim9m' ? AIM9M : s.sel.value === 'aim120b' ? AIM120B : s.sel.value === 'r73' ? R73 : R77
          return {
            hardpointId: s.hpId,
            weaponId: s.sel.value,
            category: wSpec.category as import('../types/aircraft').WeaponCategory,
            massKg: wSpec.massKg,
            dragPenalty: 0.002,
            remainingRounds: 1
          }
        })
      this.onLaunch(this.selectedSpec, stores)
      this.dispose()
    }
    this.el.appendChild(btn)
  }

  dispose(): void {
    document.body.removeChild(this.el)
  }
}
