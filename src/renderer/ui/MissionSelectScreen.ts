import type { ScenarioDescriptor } from '../types/mission'
import { SCENARIO_CATALOG, DEFAULT_SCENARIO } from '../mission/scenarios'

export class MissionSelectScreen {
  private el: HTMLDivElement
  private contentEl: HTMLDivElement
  // Highlight a mission with bandits in it. This used to be SCENARIO_CATALOG[1]
  // (Free Flight), so a new pilot who accepted the default launched into empty
  // skies with nothing to shoot and no hint that anything else existed.
  private selectedScenario: ScenarioDescriptor = DEFAULT_SCENARIO

  constructor(
    _container: HTMLElement,
    private onContinue: (scenario: ScenarioDescriptor) => void,
    private onBack: (() => void) | null = null,
  ) {
    this.el = document.createElement('div')
    Object.assign(this.el.style, {
      position: 'fixed', inset: '0',
      background: '#0a0f0a',
      color: '#00ff88', fontFamily: 'monospace',
      overflowY: 'auto', overflowX: 'hidden',
      zIndex: '8000',
    })
    this.contentEl = document.createElement('div')
    Object.assign(this.contentEl.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 'clamp(12px, 2vh, 20px)',
      width: '100%', maxWidth: '960px', minHeight: '100dvh',
      padding: '48px 16px 24px', boxSizing: 'border-box',
      margin: '0 auto',
    })
    this.el.appendChild(this.contentEl)

    const versionBadge = document.createElement('div')
    versionBadge.textContent = `v${window.fsim?.version ?? 'dev'}`
    versionBadge.style.cssText =
      'position:fixed;top:10px;right:14px;font-size:11px;color:#66bb88;letter-spacing:1px;z-index:8001;pointer-events:none'
    this.el.appendChild(versionBadge)

    document.body.appendChild(this.el)
    this.render()
  }

  private render(): void {
    this.contentEl.innerHTML = ''

    const title = document.createElement('h1')
    title.textContent = 'FSIM — SELECT MISSION'
    title.style.cssText =
      'color:#00ff88;letter-spacing:clamp(2px,0.5vw,4px);font-size:clamp(16px,2.5vw,22px);margin:0;text-align:center'
    this.contentEl.appendChild(title)

    if (this.onBack) {
      const back = document.createElement('button')
      back.textContent = '← MAIN MENU'
      back.style.cssText =
        'padding:6px 14px;font:11px monospace;background:#0a150a;color:#88bb88;border:1px solid #226644;cursor:pointer'
      back.onclick = () => this.onBack!()
      this.contentEl.appendChild(back)
    }

    const grid = document.createElement('div')
    grid.style.cssText =
      'display:grid;grid-template-columns:repeat(auto-fill,minmax(min(200px,100%),1fr));gap:12px;width:100%'
    for (const scenario of SCENARIO_CATALOG) {
      const card = document.createElement('div')
      const selected = scenario === this.selectedScenario
      card.style.cssText =
        `border:1px solid ${selected ? '#00ff88' : '#226644'};padding:12px;cursor:pointer;background:${selected ? '#0f2a1a' : '#0a150a'};min-width:180px`
      card.innerHTML = `
        <div style="font-size:15px;font-weight:bold;color:#aaffcc">${scenario.name}</div>
        <div style="font-size:11px;color:#88bb88;margin-top:6px;line-height:1.4">${scenario.description}</div>
      `
      card.onclick = () => {
        this.selectedScenario = scenario
        this.render()
      }
      grid.appendChild(card)
    }
    this.contentEl.appendChild(grid)

    const briefing = document.createElement('div')
    briefing.style.cssText = 'border:1px solid #226644;padding:12px;width:100%;box-sizing:border-box'
    briefing.innerHTML =
      `<div style="margin-bottom:8px;color:#aaffcc">BRIEFING — ${this.selectedScenario.name.toUpperCase()}</div>` +
      `<div style="font-size:11px;color:#88bb88;line-height:1.6">${this.selectedScenario.briefing}</div>`

    if (this.selectedScenario.objectives.length > 0) {
      const objList = this.selectedScenario.objectives
        .map(o => `<div style="margin-top:4px">• ${o.description}</div>`)
        .join('')
      briefing.innerHTML +=
        `<div style="margin-top:10px;color:#aaffcc;font-size:11px">OBJECTIVES</div>` +
        `<div style="font-size:11px;color:#88bb88">${objList}</div>`
    }

    if (this.selectedScenario.timeLimitSec) {
      const mins = Math.floor(this.selectedScenario.timeLimitSec / 60)
      briefing.innerHTML +=
        `<div style="margin-top:8px;font-size:11px;color:#ffaa44">Time limit: ${mins} minutes</div>`
    }

    this.contentEl.appendChild(briefing)

    const btn = document.createElement('button')
    btn.textContent = 'CONTINUE TO LOADOUT'
    btn.style.cssText =
      'padding:14px clamp(24px,6vw,48px);font:bold clamp(14px,2vw,16px) monospace;background:#0a2a0a;color:#00ff88;border:2px solid #00ff88;cursor:pointer;letter-spacing:3px;margin-bottom:8px'
    btn.onclick = () => this.onContinue(this.selectedScenario)
    this.contentEl.appendChild(btn)
  }

  dispose(): void {
    document.body.removeChild(this.el)
  }
}
