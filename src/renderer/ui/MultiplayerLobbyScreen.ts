import type { AircraftSpec } from '../types/aircraft'
import type { MultiplayerConfig, Team } from '../network/MultiplayerTypes'
import {
  DEFAULT_TEAM,
  MAX_SESSION_PORT,
  MIN_SESSION_PORT,
  TEAMS,
  isValidSessionPort,
} from '../network/MultiplayerTypes'
import { MultiplayerClient } from '../network/MultiplayerClient'
import { AIRCRAFT_ROSTER, getAircraftById } from '../data/aircraft/catalog'
import { deriveAircraftIdentity } from '../data/aircraft/identity'
import { LOADOUT_PRESETS, buildPreset, summariseStores, type LoadoutPreset } from '../data/hardpoints/presets'
import { loadSettings, saveSettings, MAX_SAVED_SERVERS, type SavedServer } from '../persistence'
import { MAX_CALLSIGN_LENGTH, sanitizeCallsign } from '../../shared/network/validation'
import { DOGFIGHT } from '../mission/scenarios'

export interface LobbyLaunchArgs {
  spec: AircraftSpec
  preset: LoadoutPreset
  team: Team
  config: MultiplayerConfig
  client: MultiplayerClient
}

export interface MultiplayerLobbyCallbacks {
  onLaunch: (args: LobbyLaunchArgs) => void
  onBack: () => void
}

type Bridge = {
  startHost: (port: number) => Promise<{ ok: true; hostIp: string; port: number }>
  stopHost: () => Promise<{ ok: true }>
  getLanIp: () => Promise<{ ip: string }>
  onLobbyEvent: (cb: (evt: { message: string; timestamp: number }) => void) => () => void
}

const TEAM_ACCENT: Record<Team, string> = { BLUE: '#4d9dff', RED: '#ff6666' }

/**
 * Electron wraps anything thrown inside an `ipcMain.handle` as
 * "Error invoking remote method 'mp:start-host': Error: <real message>".
 * The player only needs the real message.
 */
function stripIpcPrefix(message: string): string {
  return message.replace(/^Error invoking remote method '[^']*':\s*(?:Error:\s*)?/, '')
}

/**
 * Host-driven lobby.
 *
 * Replaces a setup flow where the mode was a per-player choice made on a screen
 * *before* the one containing host/join, nobody had a ready state, and everyone
 * launched whenever they felt like it. The host now owns the rules; players own
 * their aircraft; and the roster shows both sides at a glance.
 *
 * The scenario is fixed to Dogfight because it is the only one that makes sense
 * over a LAN: every other scenario spawns AI independently and unreplicated on
 * each client, so each player would fight a private copy of the same bandits.
 */
export class MultiplayerLobbyScreen {
  private el: HTMLDivElement
  private contentEl: HTMLDivElement

  private client: MultiplayerClient | null = null
  private connected = false
  private mode: 'host' | 'join' = 'host'
  private joinHost: string
  private hostLanIp = '127.0.0.1'
  private port: number
  /** Set while the port field holds something unusable; shown under the row. */
  private portError = ''
  private savedServers: SavedServer[]
  private statusMessage = 'Not connected.'
  private statusTone: 'ok' | 'warn' | 'error' = 'warn'
  private errorMessage = ''

  private spec: AircraftSpec
  private preset: LoadoutPreset
  private team: Team
  private callsign: string
  private ready = false

  private unsubscribeRoster: (() => void) | null = null
  private unsubscribeEvents: (() => void) | null = null
  private hostEvents: Array<{ message: string; timestamp: number }> = []
  private preserveClientOnDispose = false

  constructor(
    private cb: MultiplayerLobbyCallbacks,
    restore?: { client: MultiplayerClient; config: MultiplayerConfig } | null,
    /** Why the previous attempt ended, e.g. a sortie that lost its session. */
    initialError: string | null = null,
  ) {
    const saved = loadSettings()
    this.spec = (saved.lastAircraftId ? getAircraftById(saved.lastAircraftId) : null) ?? AIRCRAFT_ROSTER[0]!
    this.preset = saved.lastLoadoutPreset
    this.team = saved.lastTeam
    this.callsign = saved.callsign
    // Concurrent sessions on one box are separate processes on separate ports,
    // so the port is how a player picks between them. It has to survive a
    // restart rather than resetting to the default on every visit.
    this.port = saved.lastSessionPort
    this.joinHost = saved.lastJoinHost
    this.savedServers = saved.savedServers
    if (initialError) {
      this.errorMessage = initialError
      this.statusTone = 'error'
    }

    this.el = document.createElement('div')
    Object.assign(this.el.style, {
      position: 'fixed', inset: '0',
      background: '#0a0f0a', color: '#00ff88', fontFamily: 'monospace',
      overflowY: 'auto', overflowX: 'hidden', zIndex: '8000',
    })
    this.contentEl = document.createElement('div')
    Object.assign(this.contentEl.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: '14px', width: '100%', maxWidth: '900px', minHeight: '100dvh',
      padding: '40px 16px 24px', boxSizing: 'border-box', margin: '0 auto',
    })
    this.el.appendChild(this.contentEl)
    document.body.appendChild(this.el)

    const bridge = this.bridge()
    if (bridge?.onLobbyEvent) {
      this.unsubscribeEvents = bridge.onLobbyEvent(evt => {
        this.hostEvents.unshift(evt)
        if (this.hostEvents.length > 10) this.hostEvents.length = 10
        this.render()
      })
    }

    if (restore?.client.isConnected()) {
      this.adoptClient(restore.client, restore.config.mode === 'join' ? 'join' : 'host')
      this.port = restore.config.port
      if (restore.config.mode === 'join') this.joinHost = restore.config.host
      else this.hostLanIp = restore.config.host
      restore.client.returnToLobby()
    }

    void this.initLanIp()
    this.render()
  }

  // ── Connection ─────────────────────────────────────────────────────────────

  private bridge(): Bridge | null {
    return (window as unknown as { fsim?: { multiplayer?: Bridge } }).fsim?.multiplayer ?? null
  }

  private async initLanIp(): Promise<void> {
    const bridge = this.bridge()
    if (!bridge) return
    try {
      this.hostLanIp = (await bridge.getLanIp()).ip
      this.render()
    } catch {
      // Keep the localhost fallback.
    }
  }

  private adoptClient(client: MultiplayerClient, mode: 'host' | 'join'): void {
    this.client = client
    this.connected = true
    this.mode = mode
    this.unsubscribeRoster = client.onRosterChanged(() => this.render())
    this.statusTone = 'ok'
    this.statusMessage = mode === 'host'
      ? `Hosting at ${this.hostLanIp}:${this.port}`
      : `Joined ${this.joinHost}:${this.port}`
  }

  private async connect(mode: 'host' | 'join'): Promise<void> {
    this.mode = mode
    this.errorMessage = ''
    this.statusTone = 'warn'
    this.statusMessage = mode === 'host' ? 'Creating lobby…' : 'Joining…'
    this.render()

    const bridge = this.bridge()
    if (!bridge) {
      // `window.fsim` comes from the preload script. Missing means either the
      // plain-Vite renderer server (vite.renderer.config.ts, no Electron at
      // all) or a preload that failed to load — check the main-process console.
      this.errorMessage =
        'The desktop bridge is not loaded, so multiplayer is unavailable. ' +
        'Run the Electron build (npm run dev), not the renderer-only dev server.'
      this.statusTone = 'error'
      this.statusMessage = 'Unavailable.'
      this.render()
      return
    }

    saveSettings({ lastSessionPort: this.port, lastJoinHost: this.joinHost })

    await this.disconnect(false)
    try {
      if (mode === 'host') this.hostLanIp = (await bridge.startHost(this.port)).hostIp
      const client = new MultiplayerClient({
        aircraftId: this.spec.id,
        callsign: sanitizeCallsign(this.callsign),
        team: this.team,
        ready: false,
      })
      await client.connect({
        mode,
        host: mode === 'host' ? '127.0.0.1' : this.joinHost,
        port: this.port,
      })
      this.adoptClient(client, mode)
    } catch (err) {
      this.client = null
      this.connected = false
      this.errorMessage = err instanceof Error ? stripIpcPrefix(err.message) : 'Could not connect.'
      this.statusTone = 'error'
      this.statusMessage = mode === 'host' ? 'Failed to create lobby.' : 'Failed to join.'
    }
    this.render()
  }

  private async disconnect(stopHost = true): Promise<void> {
    this.unsubscribeRoster?.()
    this.unsubscribeRoster = null
    this.client?.disconnect()
    this.client = null
    this.connected = false
    this.ready = false
    this.statusTone = 'warn'
    this.statusMessage = 'Not connected.'
    this.errorMessage = ''
    if (stopHost && this.mode === 'host') {
      try { await this.bridge()?.stopHost() } catch { /* already down */ }
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // ── Saved addresses ────────────────────────────────────────────────────────

  private persistSavedServers(): void {
    // saveSettings shallow-merges, so the array goes in whole.
    saveSettings({ savedServers: this.savedServers })
  }

  private saveCurrentAddress(): void {
    const host = this.joinHost.trim()
    if (host === '' || !isValidSessionPort(this.port)) return
    // The same address twice is a no-op rather than a duplicate row.
    if (this.savedServers.some(e => e.host === host && e.port === this.port)) return
    if (this.savedServers.length >= MAX_SAVED_SERVERS) return
    this.savedServers = [...this.savedServers, { label: '', host, port: this.port }]
    this.persistSavedServers()
    this.render()
  }

  private removeSavedServer(index: number): void {
    this.savedServers = this.savedServers.filter((_, i) => i !== index)
    this.persistSavedServers()
    this.render()
  }

  /**
   * The player's own bookmarks for the sessions they run. Nothing discovers
   * these and nothing is contacted until they ask — it is a list of addresses
   * they typed, not a directory.
   */
  private savedServersRow(): HTMLDivElement {
    const wrap = document.createElement('div')
    wrap.style.cssText = 'margin-bottom:8px'

    const head = document.createElement('div')
    head.style.cssText =
      'display:flex;align-items:center;gap:8px;font-size:10px;color:#66886e;margin-bottom:4px'
    const label = document.createElement('span')
    label.textContent = 'SAVED ADDRESSES'
    head.appendChild(label)
    if (!this.connected) {
      const add = document.createElement('button')
      add.textContent = '+ SAVE CURRENT'
      add.style.cssText =
        'padding:2px 8px;font:10px monospace;background:#0a150a;color:#88bb88;' +
        'border:1px solid #226644;cursor:pointer'
      add.onclick = () => this.saveCurrentAddress()
      head.appendChild(add)
    }
    wrap.appendChild(head)

    if (this.savedServers.length === 0) {
      const empty = document.createElement('div')
      empty.textContent = 'None saved. Type an address, then press SAVE CURRENT.'
      empty.style.cssText = 'font-size:10px;color:#446644'
      wrap.appendChild(empty)
      return wrap
    }

    for (const [index, entry] of this.savedServers.entries()) {
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:2px 0'

      const pick = document.createElement('button')
      pick.textContent = entry.label
        ? `${entry.label} — ${entry.host}:${entry.port}`
        : `${entry.host}:${entry.port}`
      pick.disabled = this.connected
      pick.style.cssText =
        'flex:1;text-align:left;padding:3px 6px;font:10px monospace;background:#0a150a;' +
        `color:${this.connected ? '#446644' : '#aaffcc'};border:1px solid #226644;` +
        `cursor:${this.connected ? 'default' : 'pointer'}`
      pick.onclick = () => {
        this.joinHost = entry.host
        this.port = entry.port
        this.portError = ''
        this.render()
      }
      row.appendChild(pick)

      const del = document.createElement('button')
      del.textContent = 'X'
      del.title = 'Remove'
      del.style.cssText =
        'padding:3px 7px;font:10px monospace;background:#0a150a;color:#886666;' +
        'border:1px solid #443333;cursor:pointer'
      del.onclick = () => this.removeSavedServer(index)
      row.appendChild(del)

      wrap.appendChild(row)
    }
    return wrap
  }

  private render(): void {
    this.contentEl.innerHTML = ''

    const title = document.createElement('h1')
    title.textContent = 'MULTIPLAYER LOBBY'
    title.style.cssText =
      'color:#00ff88;letter-spacing:4px;font-size:clamp(16px,2.5vw,22px);margin:0;text-align:center'
    this.contentEl.appendChild(title)

    const back = document.createElement('button')
    back.textContent = '← BACK'
    back.style.cssText =
      'padding:6px 14px;font:11px monospace;background:#0a150a;color:#88bb88;border:1px solid #226644;cursor:pointer'
    back.onclick = () => { void this.disconnect().then(() => this.cb.onBack()) }
    this.contentEl.appendChild(back)

    this.contentEl.appendChild(this.connectionPanel())
    if (this.connected && this.client) {
      this.contentEl.appendChild(this.rosterPanel(this.client))
      this.contentEl.appendChild(this.pilotPanel(this.client))
      this.contentEl.appendChild(this.rulesPanel(this.client))
      this.contentEl.appendChild(this.launchPanel(this.client))
    }
  }

  private panel(heading: string): HTMLDivElement {
    const box = document.createElement('div')
    box.style.cssText = 'border:1px solid #226644;padding:12px;width:100%;box-sizing:border-box'
    const h = document.createElement('div')
    h.textContent = heading
    h.style.cssText = 'color:#aaffcc;font-size:11px;letter-spacing:2px;margin-bottom:8px'
    box.appendChild(h)
    return box
  }

  private connectionPanel(): HTMLDivElement {
    const box = this.panel('CONNECTION')

    const ipLine = document.createElement('div')
    ipLine.textContent = `Your LAN address: ${this.hostLanIp}`
    ipLine.style.cssText = 'font-size:11px;color:#88bb88;margin-bottom:6px'
    box.appendChild(ipLine)

    const row = document.createElement('div')
    row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px'

    const hostInput = document.createElement('input')
    hostInput.type = 'text'
    hostInput.value = this.joinHost
    hostInput.placeholder = 'Host address to join'
    hostInput.disabled = this.connected
    hostInput.style.cssText =
      'flex:1;min-width:180px;max-width:300px;background:#0a150a;color:#00ff88;' +
      'border:1px solid #226644;font:11px monospace;padding:4px'
    hostInput.oninput = () => { this.joinHost = hostInput.value.trim() || '127.0.0.1' }
    row.appendChild(hostInput)

    // Mutated in place by the port field's handler rather than re-rendered: a
    // re-render rebuilds the input and steals focus mid-keystroke.
    const portErrorEl = document.createElement('div')
    portErrorEl.textContent = this.portError
    portErrorEl.style.cssText = 'font-size:10px;color:#ffaa66;margin-bottom:6px;min-height:12px'

    const portInput = document.createElement('input')
    portInput.type = 'number'
    portInput.min = '1024'
    portInput.max = '65535'
    portInput.value = String(this.port)
    portInput.disabled = this.connected
    portInput.style.cssText =
      'width:90px;background:#0a150a;color:#00ff88;border:1px solid #226644;font:11px monospace;padding:4px'
    portInput.oninput = () => {
      const parsed = Math.floor(Number(portInput.value))
      if (isValidSessionPort(parsed)) {
        this.port = parsed
        this.portError = ''
      } else {
        // Say why, instead of silently reverting to the last good value and
        // leaving the player staring at a number the game will not use.
        this.portError =
          `Port must be a whole number from ${MIN_SESSION_PORT} to ${MAX_SESSION_PORT}. ` +
          `Still using ${this.port}.`
      }
      portErrorEl.textContent = this.portError
    }
    row.appendChild(portInput)
    box.appendChild(row)
    box.appendChild(portErrorEl)
    box.appendChild(this.savedServersRow())

    const buttons = document.createElement('div')
    buttons.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap'
    if (this.connected) {
      buttons.appendChild(this.actionButton('DISCONNECT', () => {
        void this.disconnect().then(() => this.render())
      }))
    } else {
      buttons.appendChild(this.actionButton('HOST', () => void this.connect('host'), true))
      buttons.appendChild(this.actionButton('JOIN', () => void this.connect('join')))
    }
    box.appendChild(buttons)

    const status = document.createElement('div')
    const color = this.statusTone === 'ok' ? '#66ff66' : this.statusTone === 'error' ? '#ff6666' : '#88bb88'
    status.textContent = this.statusMessage
    status.style.cssText = `font-size:11px;color:${color};margin-top:8px`
    box.appendChild(status)

    if (this.errorMessage) {
      const err = document.createElement('div')
      err.textContent = this.errorMessage
      err.style.cssText = 'font-size:11px;color:#ff6666;margin-top:4px'
      box.appendChild(err)
    }

    if (this.connected && this.mode === 'host' && this.hostEvents.length > 0) {
      const log = document.createElement('div')
      log.style.cssText = 'margin-top:8px;font-size:10px;color:#66886e;max-height:80px;overflow:auto'
      log.innerHTML = this.hostEvents
        .map(e => `<div>${new Date(e.timestamp).toLocaleTimeString()} — ${e.message}</div>`)
        .join('')
      box.appendChild(log)
    }

    return box
  }

  private rosterPanel(client: MultiplayerClient): HTMLDivElement {
    const box = this.panel('PILOTS')

    const columns = document.createElement('div')
    columns.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px'
    for (const team of TEAMS) {
      const col = document.createElement('div')
      col.style.cssText = `border:1px solid ${TEAM_ACCENT[team]}44;padding:8px`
      const head = document.createElement('div')
      head.textContent = team
      head.style.cssText = `color:${TEAM_ACCENT[team]};font-size:11px;letter-spacing:2px;margin-bottom:6px`
      col.appendChild(head)

      for (const row of this.rosterRows(client)) {
        if (row.team !== team) continue
        const line = document.createElement('div')
        line.style.cssText =
          `font-size:11px;margin:3px 0;color:${row.isLocal ? '#00ff44' : '#cceecc'};` +
          'display:flex;justify-content:space-between;gap:8px'
        line.innerHTML =
          `<span>${row.name}${row.isHost ? ' ★' : ''} — ${row.aircraft}</span>` +
          `<span style="color:${row.ready ? '#00ff44' : '#886644'}">${row.ready ? 'READY' : '…'}</span>`
        col.appendChild(line)
      }
      columns.appendChild(col)
    }
    box.appendChild(columns)

    const note = document.createElement('div')
    note.textContent = '★ host · friendly fire is off — you cannot lock or hit your own side'
    note.style.cssText = 'font-size:10px;color:#446644;margin-top:8px'
    box.appendChild(note)
    return box
  }

  private rosterRows(client: MultiplayerClient): Array<{
    name: string; aircraft: string; team: Team; ready: boolean; isLocal: boolean; isHost: boolean
  }> {
    const localId = client.getLocalPlayerId()
    const hostId = client.getHostId()
    const rows = [{
      name: sanitizeCallsign(this.callsign) || 'You',
      aircraft: this.spec.displayName,
      team: this.team,
      ready: this.ready,
      isLocal: true,
      isHost: localId !== null && localId === hostId,
    }]
    for (const peer of client.getRemoteSnapshots()) {
      const spec = getAircraftById(peer.profile.aircraftId)
      rows.push({
        name: peer.profile.callsign ?? peer.playerId,
        aircraft: spec?.displayName ?? peer.profile.aircraftId.toUpperCase(),
        team: peer.profile.team ?? DEFAULT_TEAM,
        ready: peer.profile.ready === true,
        isLocal: false,
        isHost: peer.playerId === hostId,
      })
    }
    return rows
  }

  private pilotPanel(client: MultiplayerClient): HTMLDivElement {
    const box = this.panel('YOUR AIRCRAFT')

    const csRow = document.createElement('div')
    csRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px'
    const csLbl = document.createElement('span')
    csLbl.textContent = 'Callsign'
    csLbl.style.cssText = 'font-size:11px;color:#88bb88;min-width:70px'
    const csInput = document.createElement('input')
    csInput.type = 'text'
    csInput.maxLength = MAX_CALLSIGN_LENGTH
    csInput.value = this.callsign
    csInput.placeholder = 'shown to other pilots'
    csInput.style.cssText =
      'flex:1;min-width:0;max-width:240px;background:#0a150a;color:#00ff88;' +
      'border:1px solid #226644;font:11px monospace;padding:3px 5px'
    csInput.oninput = () => { this.callsign = csInput.value }
    // On blur, not per keystroke — every update broadcasts to the whole lobby.
    csInput.onchange = () => {
      const clean = sanitizeCallsign(this.callsign)
      this.callsign = clean
      csInput.value = clean
      saveSettings({ callsign: clean })
      client.updateProfile({ callsign: clean })
      this.render()
    }
    csRow.appendChild(csLbl)
    csRow.appendChild(csInput)
    box.appendChild(csRow)

    const teamRow = document.createElement('div')
    teamRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px'
    const teamLbl = document.createElement('span')
    teamLbl.textContent = 'Side'
    teamLbl.style.cssText = 'font-size:11px;color:#88bb88;min-width:70px'
    teamRow.appendChild(teamLbl)
    for (const team of TEAMS) {
      const active = this.team === team
      teamRow.appendChild(this.toggleButton(team, active, TEAM_ACCENT[team], () => {
        this.team = team
        saveSettings({ lastTeam: team })
        client.updateProfile({ team })
        this.render()
      }))
    }
    box.appendChild(teamRow)

    const grid = document.createElement('div')
    grid.style.cssText =
      'display:grid;grid-template-columns:repeat(auto-fill,minmax(min(150px,100%),1fr));gap:8px;margin-bottom:8px'
    for (const spec of AIRCRAFT_ROSTER) {
      const selected = spec === this.spec
      const card = document.createElement('div')
      card.style.cssText =
        `border:1px solid ${selected ? '#00ff88' : '#226644'};padding:8px;cursor:pointer;` +
        `background:${selected ? '#0f2a1a' : '#0a150a'}`
      card.innerHTML =
        `<div style="font-size:12px;font-weight:bold;color:${spec.nation === 'USA' ? '#4488ff' : '#ff4444'}">${spec.displayName}</div>` +
        `<div style="font-size:9px;color:#aaffcc;letter-spacing:1px;margin-top:2px">${deriveAircraftIdentity(spec).role.toUpperCase()}</div>`
      card.onclick = () => {
        this.spec = spec
        saveSettings({ lastAircraftId: spec.id })
        client.updateProfile({ aircraftId: spec.id })
        this.render()
      }
      grid.appendChild(card)
    }
    box.appendChild(grid)

    const presetRow = document.createElement('div')
    presetRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center'
    for (const preset of LOADOUT_PRESETS) {
      presetRow.appendChild(this.toggleButton(preset.label, this.preset === preset.id, '#00ff88', () => {
        this.preset = preset.id
        saveSettings({ lastLoadoutPreset: preset.id })
        this.render()
      }))
    }
    box.appendChild(presetRow)

    const summary = summariseStores(buildPreset(this.spec, this.preset))
    const summaryEl = document.createElement('div')
    summaryEl.textContent =
      `${summary.count} stores   ${Math.round(summary.massKg)} kg   ` +
      (LOADOUT_PRESETS.find(p => p.id === this.preset)?.hint ?? '')
    summaryEl.style.cssText = 'font-size:10px;color:#88bb88;margin-top:6px'
    box.appendChild(summaryEl)

    return box
  }

  private rulesPanel(client: MultiplayerClient): HTMLDivElement {
    const isHost = client.isHost()
    const config = client.getMatchConfig()
    const box = this.panel(isHost ? 'MATCH RULES — you are the host' : 'MATCH RULES — set by the host')

    const numberRow = (label: string, value: number, min: number, max: number, commit: (v: number) => void): void => {
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:3px 0'
      const lbl = document.createElement('span')
      lbl.textContent = label
      lbl.style.cssText = 'font-size:11px;color:#88bb88;min-width:120px'
      const input = document.createElement('input')
      input.type = 'number'
      input.min = String(min)
      input.max = String(max)
      input.value = String(value)
      input.disabled = !isHost
      input.style.cssText =
        'width:90px;background:#0a150a;color:#00ff88;border:1px solid #226644;' +
        `font:11px monospace;padding:3px;${isHost ? '' : 'opacity:0.55'}`
      input.onchange = () => {
        const parsed = Number(input.value)
        if (Number.isFinite(parsed)) commit(Math.max(min, Math.min(max, Math.round(parsed))))
      }
      row.appendChild(lbl)
      row.appendChild(input)
      box.appendChild(row)
    }

    numberRow('Score limit', config.scoreLimit, 1, 500, v => client.setMatchConfig({ ...config, scoreLimit: v }))
    numberRow('Time limit (min)', Math.round(config.timeLimitSec / 60), 0, 120, v =>
      client.setMatchConfig({ ...config, timeLimitSec: v * 60 }))

    return box
  }

  private launchPanel(client: MultiplayerClient): HTMLDivElement {
    const box = this.panel('LAUNCH')
    const rows = this.rosterRows(client)
    const allReady = rows.every(r => r.ready)
    const isHost = client.isHost()
    const phase = client.getMatchState().phase

    const readyBtn = this.actionButton(this.ready ? 'READY ✓' : 'READY UP', () => {
      this.ready = !this.ready
      client.updateProfile({ ready: this.ready })
      this.render()
    }, this.ready)
    box.appendChild(readyBtn)

    if (isHost) {
      const startBtn = this.actionButton(
        phase === 'LIVE' ? 'MATCH LIVE' : allReady ? 'START MATCH' : 'START ANYWAY',
        () => { client.startMatch(); this.render() },
        allReady && phase !== 'LIVE',
      )
      startBtn.style.marginLeft = '8px'
      box.appendChild(startBtn)
    }

    const status = document.createElement('div')
    status.style.cssText = 'font-size:11px;color:#88bb88;margin-top:8px'
    status.textContent =
      phase === 'LIVE'
        ? 'Match is live — launch when you are ready to fly.'
        : isHost
          ? allReady ? 'Everyone is ready.' : 'Waiting for pilots to ready up.'
          : 'Waiting for the host to start the match.'
    box.appendChild(status)

    const launch = document.createElement('button')
    launch.textContent = 'LAUNCH MISSION'
    launch.style.cssText =
      'padding:14px clamp(24px,6vw,48px);font:bold clamp(14px,2vw,16px) monospace;background:#0a2a0a;' +
      'color:#00ff88;border:2px solid #00ff88;cursor:pointer;letter-spacing:3px;margin-top:12px;display:block'
    launch.onclick = () => {
      saveSettings({
        lastAircraftId: this.spec.id,
        lastScenarioId: DOGFIGHT.id,
        lastTeam: this.team,
        lastLoadoutPreset: this.preset,
        callsign: sanitizeCallsign(this.callsign),
      })
      // The session takes ownership of the socket, so this screen must not
      // tear it down on the way out.
      this.preserveClientOnDispose = true
      this.cb.onLaunch({
        spec: this.spec,
        preset: this.preset,
        team: this.team,
        config: {
          mode: this.mode,
          host: this.mode === 'host' ? this.hostLanIp : this.joinHost,
          port: this.port,
        },
        client,
      })
    }
    box.appendChild(launch)

    return box
  }

  private actionButton(label: string, onClick: () => void, accent = false): HTMLButtonElement {
    const b = document.createElement('button')
    b.textContent = label
    b.style.cssText =
      `padding:8px 18px;font:bold 12px monospace;background:${accent ? '#0f2a1a' : '#0a150a'};` +
      `color:${accent ? '#00ff88' : '#88bb88'};border:1px solid ${accent ? '#00ff88' : '#226644'};` +
      'cursor:pointer;letter-spacing:2px'
    b.onclick = onClick
    return b
  }

  private toggleButton(label: string, active: boolean, accent: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.textContent = label
    b.style.cssText =
      `padding:5px 14px;font:bold 11px monospace;background:${active ? '#0f2a1a' : '#0a150a'};` +
      `color:${active ? accent : '#66886e'};border:1px solid ${active ? accent : '#226644'};` +
      'cursor:pointer;letter-spacing:1px'
    b.onclick = onClick
    return b
  }

  dispose(): void {
    this.unsubscribeEvents?.()
    this.unsubscribeEvents = null
    this.unsubscribeRoster?.()
    this.unsubscribeRoster = null
    if (!this.preserveClientOnDispose) void this.disconnect(false)
    this.el.remove()
  }
}
