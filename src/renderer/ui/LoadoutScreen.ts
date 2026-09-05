import type { AircraftSpec } from '../types/aircraft'
import type { LoadedStore } from '../types/weapons'
import type { MultiplayerConfig } from '../network/MultiplayerTypes'
import { MultiplayerClient } from '../network/MultiplayerClient'
import { AIRCRAFT_ROSTER } from '../data/aircraft/catalog'
import { getAircraftById } from '../data/aircraft/catalog'
import { MISSILE_SPECS, getStoreDragPenalty } from '../data/weapons/catalog'
import { deriveAircraftIdentity, BAR_LABELS } from '../data/aircraft/identity'
import { LOADOUT_PRESETS, buildPreset, summariseStores, type LoadoutPreset } from '../data/hardpoints/presets'
import { renderControlsReference } from '../input/controlsReference'
import { loadSettings, saveSettings, loadoutFor, saveLoadoutFor } from '../persistence'
import { TIME_OF_DAY, TIME_OF_DAY_PRESETS, type TimeOfDayPreset } from '../scene/TimeOfDay'
import { WEATHER_PRESETS, WEATHER_PRESET_LABELS, type WeatherPreset } from '../physics/WeatherPresets'
import { POSTFX_QUALITIES, POSTFX_QUALITY_LABELS, type PostFXQuality } from '../postfx/PostFXManager'

import type { FlightOptions } from '../FlightSession'
import type { ScenarioDescriptor } from '../types/mission'

type LaunchCallback = (
  spec: AircraftSpec,
  stores: LoadedStore[],
  multiplayer: MultiplayerConfig,
  multiplayerClient: MultiplayerClient | null,
  options: FlightOptions,
) => void

const WEAPON_OPTIONS: Record<string, { label: string; count: number }> = {
  'aim9x':   { label: 'AIM-9X Sidewinder', count: 1 },
  'aim120b': { label: 'AIM-120B AMRAAM',   count: 1 },
  'r73':     { label: 'R-73 Archer',        count: 1 },
  'r77':     { label: 'R-77 Adder',         count: 1 },
  'none':    { label: '(Empty)',             count: 0 }
}

export class LoadoutScreen {
  private el: HTMLDivElement
  private contentEl: HTMLDivElement
  private selectedSpec: AircraftSpec = AIRCRAFT_ROSTER[0]!
  private onLaunch: LaunchCallback
  private glocEnabled = true
  private autoRudder = true
  private invertPitch = false
  private timeOfDay: TimeOfDayPreset = 'DAY'
  private weatherPreset: WeatherPreset = 'CLEAR'
  private masterVolume = 0.8
  private postFXQuality: PostFXQuality = 'HIGH'
  private selectedWeaponByHardpoint = new Map<string, string>()
  /** Which collapsed sections the pilot opened, kept across re-renders. */
  private expandedSections = new Set<string>()
  /** Highlighted preset, or null once the pilot edits an individual station. */
  private selectedPreset: LoadoutPreset | null = null
  /** Keeps the per-station block open across re-renders once the pilot opens it. */
  private stationsExpanded = false
  private launchError = ''
  private scenario: ScenarioDescriptor
  private onBack: (() => void) | null

  constructor(
    _container: HTMLElement,
    onLaunch: LaunchCallback,
    options?: {
      scenario?: ScenarioDescriptor
      onBack?: () => void
    }
  ) {
    this.onLaunch = onLaunch
    this.scenario = options?.scenario ?? {
      id: 'free_flight',
      name: 'Free Flight',
      description: '',
      briefing: '',
      playerSpawn: {},
      enemies: [],
      wingmen: [],
      groundTargets: [],
      objectives: [],
      winConditions: [],
      loseConditions: [],
    }
    this.onBack = options?.onBack ?? null

    // Restore persisted preferences, then apply per-scenario environment defaults.
    const saved = loadSettings()
    this.glocEnabled = saved.glocEnabled
    this.autoRudder = saved.autoRudder
    this.invertPitch = saved.invertPitch
    this.masterVolume = saved.masterVolume
    this.postFXQuality = saved.postFXQuality
    const savedSpec = saved.lastAircraftId ? getAircraftById(saved.lastAircraftId) : null
    if (savedSpec) this.selectedSpec = savedSpec
    this.timeOfDay = this.scenario.timeOfDay ?? saved.lastTimeOfDay
    this.weatherPreset = this.scenario.weather ?? saved.lastWeatherPreset
    this.loadSavedLoadout()

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
    versionBadge.style.cssText = 'position:fixed;top:10px;right:14px;font-size:11px;color:#66bb88;letter-spacing:1px;z-index:8001;pointer-events:none'
    this.el.appendChild(versionBadge)

    document.body.appendChild(this.el)
    this.render()
  }

  /**
   * Populate the per-hardpoint weapon map from the persisted loadout for the
   * selected aircraft, falling back to the Balanced preset.
   *
   * The fallback matters: every station used to default to "(Auto / Empty)", so
   * a pilot who never opened the hardpoint list launched with nothing but the
   * gun and no indication anything was wrong.
   */
  private loadSavedLoadout(): void {
    this.selectedWeaponByHardpoint.clear()
    const stored = loadoutFor(this.selectedSpec.id)
    const entries = Object.entries(stored)
    if (entries.length === 0) {
      this.selectedPreset = 'BALANCED'
      for (const [hpId, weaponId] of Object.entries(buildPreset(this.selectedSpec, 'BALANCED'))) {
        this.selectedWeaponByHardpoint.set(hpId, weaponId)
      }
      return
    }
    this.selectedPreset = null
    for (const [hpId, weaponId] of entries) {
      this.selectedWeaponByHardpoint.set(hpId, weaponId)
    }
  }

  /**
   * Tuck a built section behind a disclosure.
   *
   * The launch button used to sit below six full-height panels plus the entire
   * controls table, so a new pilot's first act was scrolling. Aircraft and
   * loadout stay open; everything else is one click away and remembers whether
   * the pilot opened it.
   */
  private appendCollapsed(section: HTMLElement): void {
    const heading = section.firstElementChild
    const label = heading?.textContent?.trim() ?? 'MORE'
    heading?.remove()

    const details = document.createElement('details')
    details.open = this.expandedSections.has(label)
    details.style.cssText = 'border:1px solid #226644;width:100%;box-sizing:border-box'
    details.ontoggle = () => {
      if (details.open) this.expandedSections.add(label)
      else this.expandedSections.delete(label)
    }
    const summary = document.createElement('summary')
    summary.textContent = label
    summary.style.cssText =
      'padding:10px 12px;color:#aaffcc;font-size:11px;letter-spacing:2px;cursor:pointer'
    details.appendChild(summary)
    section.style.border = 'none'
    details.appendChild(section)
    this.contentEl.appendChild(details)
  }

  private render(): void {
    this.contentEl.innerHTML = ''

    const title = document.createElement('h1')
    title.textContent = 'FSIM — SELECT AIRCRAFT'
    title.style.cssText = 'color:#00ff88;letter-spacing:clamp(2px,0.5vw,4px);font-size:clamp(16px,2.5vw,22px);margin:0;text-align:center'
    this.contentEl.appendChild(title)

    const missionBanner = document.createElement('div')
    missionBanner.style.cssText =
      'border:1px solid #226644;padding:10px 12px;width:100%;box-sizing:border-box;text-align:center'
    missionBanner.innerHTML =
      `<div style="font-size:11px;color:#aaffcc;letter-spacing:1px">MISSION</div>` +
      `<div style="font-size:14px;color:#00ff88;margin-top:4px">${this.scenario.name}</div>`
    this.contentEl.appendChild(missionBanner)

    if (this.onBack) {
      const backBtn = document.createElement('button')
      backBtn.textContent = '← CHANGE MISSION'
      backBtn.style.cssText =
        'padding:8px 16px;font:11px monospace;background:#0a150a;color:#88bb88;border:1px solid #226644;cursor:pointer;letter-spacing:1px'
      backBtn.onclick = () => this.onBack!()
      this.contentEl.appendChild(backBtn)
    }

    // Aircraft cards
    const grid = document.createElement('div')
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(min(190px,100%),1fr));gap:12px;width:100%'
    for (const spec of AIRCRAFT_ROSTER) {
      const card = document.createElement('div')
      const selected = spec === this.selectedSpec
      card.style.cssText = `border:1px solid ${selected ? '#00ff88' : '#226644'};padding:12px;cursor:pointer;background:${selected ? '#0f2a1a' : '#0a150a'};min-width:140px`
      // Role and comparative bars, not raw numbers: every airframe on the roster
      // is +9.0 G and 26–28° AoA, so the old card said nothing that would help
      // anyone choose. The bars come from the same specs the sim flies.
      const identity = deriveAircraftIdentity(spec)
      const bars = BAR_LABELS.map(([key, label]) => {
        const pct = Math.round(identity.bars[key] * 100)
        return (
          `<div style="display:flex;align-items:center;gap:5px;margin-top:2px">` +
          `<span style="color:#66aa88;width:46px;font-size:9px;letter-spacing:0.5px">${label}</span>` +
          `<span style="flex:1;height:4px;background:#16301f;display:block">` +
          `<span style="display:block;height:4px;width:${pct}%;background:${selected ? '#00ff88' : '#3d8f66'}"></span>` +
          `</span></div>`
        )
      }).join('')
      card.innerHTML = `
        <div style="font-size:15px;font-weight:bold;color:${spec.nation === 'USA' ? '#4488ff' : '#ff4444'}">${spec.displayName}</div>
        <div style="font-size:10px;color:#aaffcc;letter-spacing:1px;margin-top:3px">${identity.role.toUpperCase()}</div>
        <div style="margin-top:7px">${bars}</div>
        <div style="font-size:10px;color:#88bb88;margin-top:8px;line-height:1.45">${identity.blurb}</div>
      `
      card.onclick = () => {
        this.selectedSpec = spec
        this.loadSavedLoadout()
        this.render()
      }
      grid.appendChild(card)
    }
    this.contentEl.appendChild(grid)

    // Hardpoints
    const hpSection = document.createElement('div')
    hpSection.style.cssText = 'border:1px solid #226644;padding:12px;width:100%;box-sizing:border-box'
    hpSection.innerHTML = '<div style="margin-bottom:8px;color:#aaffcc">LOADOUT</div>'

    // One click for a whole load. The per-pylon selects are still below, but
    // nobody has to read nine station codes to get airborne any more.
    const presetRow = document.createElement('div')
    presetRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px'
    for (const preset of LOADOUT_PRESETS) {
      const btn = document.createElement('button')
      const active = this.selectedPreset === preset.id
      btn.textContent = preset.label
      btn.title = preset.hint
      btn.style.cssText =
        `padding:6px 14px;font:bold 11px monospace;background:${active ? '#0f2a1a' : '#0a150a'};` +
        `color:${active ? '#00ff88' : '#88bb88'};border:1px solid ${active ? '#00ff88' : '#226644'};` +
        'cursor:pointer;letter-spacing:1px'
      btn.onclick = () => {
        this.selectedPreset = preset.id
        this.selectedWeaponByHardpoint.clear()
        for (const [hpId, weaponId] of Object.entries(buildPreset(this.selectedSpec, preset.id))) {
          this.selectedWeaponByHardpoint.set(hpId, weaponId)
        }
        this.render()
      }
      presetRow.appendChild(btn)
    }
    hpSection.appendChild(presetRow)

    const hint = document.createElement('div')
    hint.style.cssText = 'font-size:10px;color:#446644;margin-bottom:8px'
    hint.textContent =
      LOADOUT_PRESETS.find(p => p.id === this.selectedPreset)?.hint ??
      'Custom load — pick each station below.'
    hpSection.appendChild(hint)

    // What the load costs. Stores mass and drag are already modelled per-store,
    // so the BVR/Dogfight trade is a real performance difference, not flavour.
    const summaryEl = document.createElement('div')
    summaryEl.style.cssText = 'font-size:11px;color:#88bb88;margin-bottom:10px'
    hpSection.appendChild(summaryEl)

    // Station-by-station editing is still here for anyone who wants it, just no
    // longer the first thing between a new pilot and the launch button.
    const stationDetails = document.createElement('details')
    stationDetails.open = this.stationsExpanded
    stationDetails.ontoggle = () => { this.stationsExpanded = stationDetails.open }
    const stationSummary = document.createElement('summary')
    stationSummary.textContent = 'Per-station detail'
    stationSummary.style.cssText = 'font-size:11px;color:#88bb88;cursor:pointer;margin-bottom:6px'
    stationDetails.appendChild(stationSummary)

    const selects: Array<{ hpId: string; sel: HTMLSelectElement }> = []
    const refreshSummary = (): void => {
      const selection: Record<string, string> = {}
      for (const s of selects) selection[s.hpId] = s.sel.value
      const { count, massKg, dragPenalty } = summariseStores(selection)
      summaryEl.textContent =
        `${count} store${count === 1 ? '' : 's'}   ${Math.round(massKg)} kg   ` +
        `drag +${dragPenalty.toFixed(4)}`
    }

    for (const hp of this.selectedSpec.hardpoints) {
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0;flex-wrap:wrap'

      const lbl = document.createElement('span')
      lbl.textContent = hp.id.padEnd(4, ' ')
      lbl.style.width = '40px'

      const sel = document.createElement('select')
      sel.style.cssText = 'flex:1;min-width:0;max-width:100%;background:#0a150a;color:#00ff88;border:1px solid #226644;font:11px monospace'
      sel.innerHTML = `<option value="none">(Auto / Empty)</option>`

      // Only show compatible weapons
      for (const [id, info] of Object.entries(WEAPON_OPTIONS)) {
        if (id === 'none') continue
        const wSpec = MISSILE_SPECS[id]
        if (!wSpec) continue
        if (!hp.compatibleTypes.includes(wSpec.category)) continue
        const opt = document.createElement('option')
        opt.value = id
        opt.textContent = info.label
        sel.appendChild(opt)
      }
      const priorWeapon = this.selectedWeaponByHardpoint.get(hp.id)
      if (priorWeapon && Array.from(sel.options).some(opt => opt.value === priorWeapon)) sel.value = priorWeapon
      sel.onchange = () => {
        this.selectedWeaponByHardpoint.set(hp.id, sel.value)
        // Editing a station means this is no longer any of the presets.
        this.selectedPreset = null
        hint.textContent = 'Custom load — pick each station below.'
        for (const b of Array.from(presetRow.children) as HTMLButtonElement[]) {
          b.style.background = '#0a150a'
          b.style.color = '#88bb88'
          b.style.borderColor = '#226644'
        }
        refreshSummary()
      }

      selects.push({ hpId: hp.id, sel })
      row.appendChild(lbl)
      row.appendChild(sel)
      stationDetails.appendChild(row)
    }
    hpSection.appendChild(stationDetails)
    refreshSummary()
    this.contentEl.appendChild(hpSection)

    // ── Environment ─────────────────────────────────────────────────────────
    const envSection = document.createElement('div')
    envSection.style.cssText = 'border:1px solid #226644;padding:12px;width:100%;box-sizing:border-box'
    envSection.innerHTML = '<div style="margin-bottom:8px;color:#aaffcc">ENVIRONMENT</div>'

    const mkSelectRow = (
      parent: HTMLElement,
      label: string,
      values: readonly string[],
      labelFor: (v: string) => string,
      current: string,
      onChange: (v: string) => void,
      disabled = false,
    ): void => {
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0'
      const lbl = document.createElement('span')
      lbl.textContent = label
      lbl.style.cssText = 'font-size:11px;color:#88bb88;min-width:96px'
      const sel = document.createElement('select')
      sel.style.cssText = 'flex:1;min-width:0;max-width:260px;background:#0a150a;color:#00ff88;border:1px solid #226644;font:11px monospace'
      for (const v of values) {
        const opt = document.createElement('option')
        opt.value = v
        opt.textContent = labelFor(v)
        sel.appendChild(opt)
      }
      sel.value = current
      sel.disabled = disabled
      if (disabled) sel.style.opacity = '0.5'
      sel.onchange = () => onChange(sel.value)
      row.appendChild(lbl)
      row.appendChild(sel)
      parent.appendChild(row)
    }

    const mkSliderRow = (
      parent: HTMLElement,
      label: string,
      current: number,
      onChange: (v: number) => void,
    ): void => {
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0'
      const lbl = document.createElement('span')
      lbl.textContent = label
      lbl.style.cssText = 'font-size:11px;color:#88bb88;min-width:96px'
      const slider = document.createElement('input')
      slider.type = 'range'
      slider.min = '0'
      slider.max = '100'
      slider.step = '1'
      slider.value = String(Math.round(current * 100))
      slider.style.cssText = 'flex:1;min-width:0;max-width:210px;accent-color:#00ff88'
      const readout = document.createElement('span')
      readout.textContent = `${Math.round(current * 100)}%`
      readout.style.cssText = 'font-size:11px;color:#00ff88;min-width:38px;text-align:right'
      slider.oninput = () => {
        const v = Number(slider.value) / 100
        readout.textContent = `${slider.value}%`
        onChange(v)
      }
      row.appendChild(lbl)
      row.appendChild(slider)
      row.appendChild(readout)
      parent.appendChild(row)
    }

    // Time of day and weather are per-client: they change the lighting the
    // scene is built with and the air the flight model integrates, and neither
    // is replicated. Two players on different settings would be flying in
    // measurably different air, so lock them to the scenario in a lobby.
    // Single-player only now, so the pilot owns the conditions outright.
    const envLocked = false
    if (envLocked) {
      // Reset to the scenario's canonical conditions rather than this client's
      // last-used setting — otherwise locking the selects still leaves two
      // players starting in different weather.
      this.timeOfDay = this.scenario.timeOfDay ?? 'DAY'
      this.weatherPreset = this.scenario.weather ?? 'CLEAR'
    }
    mkSelectRow(
      envSection,
      'Time of day', TIME_OF_DAY_PRESETS,
      v => TIME_OF_DAY[v as TimeOfDayPreset].label,
      this.timeOfDay,
      v => { this.timeOfDay = v as TimeOfDayPreset },
      envLocked,
    )
    mkSelectRow(
      envSection,
      'Weather', WEATHER_PRESETS,
      v => WEATHER_PRESET_LABELS[v as WeatherPreset],
      this.weatherPreset,
      v => { this.weatherPreset = v as WeatherPreset },
      envLocked,
    )
    if (envLocked) {
      const envNote = document.createElement('div')
      envNote.textContent = 'Locked in multiplayer — all pilots fly the same conditions.'
      envNote.style.cssText = 'font-size:10px;color:#446644;margin-top:4px'
      envSection.appendChild(envNote)
    }
    this.appendCollapsed(envSection)

    // ── Settings ────────────────────────────────────────────────────────────
    const setSection = document.createElement('div')
    setSection.style.cssText = 'border:1px solid #226644;padding:12px;width:100%;box-sizing:border-box'
    setSection.innerHTML = '<div style="margin-bottom:8px;color:#aaffcc">SETTINGS</div>'

    mkSliderRow(setSection, 'Master volume', this.masterVolume, v => { this.masterVolume = v })
    mkSelectRow(
      setSection,
      'Graphics', POSTFX_QUALITIES,
      v => POSTFX_QUALITY_LABELS[v as PostFXQuality],
      this.postFXQuality,
      v => { this.postFXQuality = v as PostFXQuality },
    )
    this.appendCollapsed(setSection)

    const optSection = document.createElement('div')
    optSection.style.cssText = 'border:1px solid #226644;padding:12px;width:100%;box-sizing:border-box'
    optSection.innerHTML = '<div style="margin-bottom:8px;color:#aaffcc">FLIGHT OPTIONS</div>'

    const glocRow = document.createElement('label')
    glocRow.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:11px'
    const glocChk = document.createElement('input')
    glocChk.type = 'checkbox'
    glocChk.checked = this.glocEnabled
    glocChk.style.cssText = 'cursor:pointer;accent-color:#00ff88'
    glocChk.onchange = () => { this.glocEnabled = glocChk.checked }
    const glocLbl = document.createElement('span')
    glocLbl.textContent = 'G-LOC blackout'
    glocLbl.style.color = '#88bb88'
    const glocHint = document.createElement('span')
    glocHint.textContent = '— sustained high-G greys out your vision and can knock you out; off for new pilots'
    glocHint.style.cssText = 'color:#446644;font-size:10px'
    glocRow.appendChild(glocChk)
    glocRow.appendChild(glocLbl)
    glocRow.appendChild(glocHint)
    optSection.appendChild(glocRow)

    const rudderRow = document.createElement('label')
    rudderRow.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:11px;margin-top:6px'
    const rudderChk = document.createElement('input')
    rudderChk.type = 'checkbox'
    rudderChk.checked = this.autoRudder
    rudderChk.style.cssText = 'cursor:pointer;accent-color:#00ff88'
    rudderChk.onchange = () => { this.autoRudder = rudderChk.checked }
    const rudderLbl = document.createElement('span')
    rudderLbl.textContent = 'Auto Rudder (turn coordinator)'
    rudderLbl.style.color = '#88bb88'
    const rudderHint = document.createElement('span')
    rudderHint.textContent = '— keeps sideslip near zero; disable for full manual coordination'
    rudderHint.style.cssText = 'color:#446644;font-size:10px'
    rudderRow.appendChild(rudderChk)
    rudderRow.appendChild(rudderLbl)
    rudderRow.appendChild(rudderHint)
    optSection.appendChild(rudderRow)

    const invertRow = document.createElement('label')
    invertRow.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:11px;margin-top:6px'
    const invertChk = document.createElement('input')
    invertChk.type = 'checkbox'
    invertChk.checked = this.invertPitch
    invertChk.style.cssText = 'cursor:pointer;accent-color:#00ff88'
    invertChk.onchange = () => { this.invertPitch = invertChk.checked }
    const invertLbl = document.createElement('span')
    invertLbl.textContent = 'Invert pitch'
    invertLbl.style.color = '#88bb88'
    const invertHint = document.createElement('span')
    invertHint.textContent = '— default is sim-style: W pitches down, S pitches up'
    invertHint.style.cssText = 'color:#446644;font-size:10px'
    invertRow.appendChild(invertChk)
    invertRow.appendChild(invertLbl)
    invertRow.appendChild(invertHint)
    optSection.appendChild(invertRow)

    this.appendCollapsed(optSection)


    // Controls reference
    const ctrlSection = document.createElement('div')
    ctrlSection.style.cssText = 'border:1px solid #226644;padding:12px;width:100%;box-sizing:border-box'
    ctrlSection.innerHTML = '<div style="margin-bottom:8px;color:#aaffcc">CONTROLS</div>'
    ctrlSection.appendChild(renderControlsReference())
    this.appendCollapsed(ctrlSection)

    // Launch button
    const btn = document.createElement('button')
    btn.textContent = 'LAUNCH MISSION'
    btn.style.cssText = 'padding:14px clamp(24px,6vw,48px);font:bold clamp(14px,2vw,16px) monospace;background:#0a2a0a;color:#00ff88;border:2px solid #00ff88;cursor:pointer;letter-spacing:3px;margin-bottom:8px'
    btn.onclick = () => {
      this.launchError = ''
      try {
        const stores: LoadedStore[] = selects
          .filter(s => s.sel.value !== 'none')
          .map(s => {
            const wSpec = MISSILE_SPECS[s.sel.value]
            if (!wSpec) throw new Error(`Unknown weapon selected: ${s.sel.value}`)
            return {
              hardpointId: s.hpId,
              weaponId: s.sel.value,
              category: wSpec.category as import('../types/aircraft').WeaponCategory,
              massKg: wSpec.massKg,
              dragPenalty: getStoreDragPenalty(wSpec),
              remainingRounds: 1
            }
          })
        // This screen is the single-player path; LAN launches come from the lobby.
        const multiplayer: MultiplayerConfig = { mode: 'single', host: '127.0.0.1', port: 45454 }
        const selection: Record<string, string> = {}
        for (const s of selects) selection[s.hpId] = s.sel.value
        saveLoadoutFor(this.selectedSpec.id, selection)
        saveSettings({
          lastAircraftId: this.selectedSpec.id,
          lastScenarioId: this.scenario.id,
          glocEnabled: this.glocEnabled,
          autoRudder: this.autoRudder,
          invertPitch: this.invertPitch,
          lastTimeOfDay: this.timeOfDay,
          lastWeatherPreset: this.weatherPreset,
          masterVolume: this.masterVolume,
          postFXQuality: this.postFXQuality,

        })

        const options: FlightOptions = {
          glocEnabled: this.glocEnabled,
          autoRudder: this.autoRudder,
          invertPitch: this.invertPitch,
          timeOfDay: this.timeOfDay,
          weather: this.weatherPreset,
          masterVolume: this.masterVolume,
          postFXQuality: this.postFXQuality,
        }
        this.onLaunch(this.selectedSpec, stores, multiplayer, null, options)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        this.launchError = `Launch failed: ${msg}`
        console.error('Launch failed', err)
        this.render()
      }
    }
    this.contentEl.appendChild(btn)
  }

  /**
   * Match rules and the START button.
   *
   * Only the host sees the controls — the server ignores these messages from
   * anyone else, so showing them to every player would just be a lie. Everyone
   * sees the *rules*, because they need to know what they are playing.
   */

  dispose(): void {
    document.body.removeChild(this.el)
  }
}
