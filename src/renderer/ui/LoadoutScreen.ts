import type { AircraftSpec } from '../types/aircraft'
import type { LoadedStore } from '../types/weapons'
import type { MultiplayerConfig } from '../network/MultiplayerTypes'
import { MultiplayerClient } from '../network/MultiplayerClient'
import { AIRCRAFT_ROSTER } from '../data/aircraft/catalog'
import { getAircraftById } from '../data/aircraft/catalog'
import { AIM9M }   from '../data/weapons/aim9m'
import { AIM120B } from '../data/weapons/aim120b'
import { R73 }  from '../data/weapons/r73'
import { R77 }  from '../data/weapons/r77'
import { msToKts } from '../utils/Units'

const WEAPON_OPTIONS: Record<string, { label: string; count: number }> = {
  'aim9m':   { label: 'AIM-9M Sidewinder', count: 1 },
  'aim120b': { label: 'AIM-120B AMRAAM',   count: 1 },
  'r73':     { label: 'R-73 Archer',        count: 1 },
  'r77':     { label: 'R-77 Adder',         count: 1 },
  'none':    { label: '(Empty)',             count: 0 }
}

export class LoadoutScreen {
  private el: HTMLDivElement
  private selectedSpec: AircraftSpec = AIRCRAFT_ROSTER[0]!
  private onLaunch: (
    spec: AircraftSpec,
    stores: LoadedStore[],
    multiplayer: MultiplayerConfig,
    multiplayerClient: MultiplayerClient | null
  ) => void
  private multiplayerMode: MultiplayerConfig['mode'] = 'single'
  private joinHost = '127.0.0.1'
  private hostLanIp = '127.0.0.1'
  private lanPort = 45454
  private lobbyClient: MultiplayerClient | null = null
  private lobbyConnected = false
  private lobbyError = ''
  private unsubscribeLobbyRoster: (() => void) | null = null
  private unsubscribeLobbyEvents: (() => void) | null = null
  private hostEvents: Array<{ message: string; timestamp: number }> = []
  private selectedWeaponByHardpoint = new Map<string, string>()
  private lobbyStatusMessage = 'Not connected to lobby.'
  private lobbyStatusTone: 'ok' | 'warn' | 'error' = 'warn'
  private launchError = ''
  private preserveLobbyClientOnDispose = false

  constructor(
    _container: HTMLElement,
    onLaunch: (
      spec: AircraftSpec,
      stores: LoadedStore[],
      multiplayer: MultiplayerConfig,
      multiplayerClient: MultiplayerClient | null
    ) => void
  ) {
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
    const mp = this.getMultiplayerBridge()
    if (mp?.onLobbyEvent) {
      this.unsubscribeLobbyEvents = mp.onLobbyEvent(evt => {
        this.hostEvents.unshift(evt)
        if (this.hostEvents.length > 12) this.hostEvents.length = 12
        this.render()
      })
    }
    void this.initLanInfo()
    this.render()
  }

  private async initLanInfo(): Promise<void> {
    const mp = this.getMultiplayerBridge()
    if (!mp) return
    try {
      const res = await mp.getLanIp()
      this.hostLanIp = res.ip
      this.render()
    } catch {
      // ignore and keep localhost fallback
    }
  }

  private render(): void {
    this.el.innerHTML = ''

    const versionBadge = document.createElement('div')
    versionBadge.textContent = `v${window.fsim?.version ?? 'dev'}`
    versionBadge.style.cssText = 'position:absolute;top:10px;right:14px;font-size:11px;color:#66bb88;letter-spacing:1px'
    this.el.appendChild(versionBadge)

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
      sel.innerHTML = `<option value="none">(Auto / Empty)</option>`

      // Only show compatible weapons
      for (const [id, info] of Object.entries(WEAPON_OPTIONS)) {
        if (id === 'none') continue
        const wSpec = id === 'aim9m' ? AIM9M : id === 'aim120b' ? AIM120B : id === 'r73' ? R73 : R77
        if (!hp.compatibleTypes.includes(wSpec.category)) continue
        const opt = document.createElement('option')
        opt.value = id
        opt.textContent = info.label
        sel.appendChild(opt)
      }
      const priorWeapon = this.selectedWeaponByHardpoint.get(hp.id)
      if (priorWeapon && [...sel.options].some(opt => opt.value === priorWeapon)) sel.value = priorWeapon
      sel.onchange = () => this.selectedWeaponByHardpoint.set(hp.id, sel.value)

      selects.push({ hpId: hp.id, sel })
      row.appendChild(lbl)
      row.appendChild(sel)
      hpSection.appendChild(row)
    }
    this.el.appendChild(hpSection)

    const mpSection = document.createElement('div')
    mpSection.style.cssText = 'border:1px solid #226644;padding:12px;max-width:900px;width:100%'
    mpSection.innerHTML = '<div style="margin-bottom:8px;color:#aaffcc">LAN MULTIPLAYER</div>'

    const info = document.createElement('div')
    info.style.cssText = 'font-size:11px;color:#88bb88'
    info.textContent = `Host/share IP: ${this.hostLanIp}`
    mpSection.appendChild(info)

    const joinRow = document.createElement('div')
    joinRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0'
    const hostInput = document.createElement('input')
    hostInput.type = 'text'
    hostInput.value = this.joinHost
    hostInput.placeholder = 'Host IP (e.g. 192.168.1.25)'
    hostInput.style.cssText = 'width:220px;background:#0a150a;color:#00ff88;border:1px solid #226644;font:11px monospace;padding:4px'
    hostInput.oninput = () => { this.joinHost = hostInput.value.trim() || '127.0.0.1' }
    joinRow.appendChild(hostInput)
    mpSection.appendChild(joinRow)

    const portRow = document.createElement('div')
    portRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0'
    const portLabel = document.createElement('span')
    portLabel.textContent = 'Port'
    portLabel.style.cssText = 'font-size:11px;color:#88bb88;min-width:34px'
    const portInput = document.createElement('input')
    portInput.type = 'number'
    portInput.min = '1024'
    portInput.max = '65535'
    portInput.value = String(this.lanPort)
    portInput.style.cssText = 'width:100px;background:#0a150a;color:#00ff88;border:1px solid #226644;font:11px monospace;padding:4px'
    portInput.oninput = () => {
      const parsed = Number(portInput.value)
      if (Number.isFinite(parsed) && parsed >= 1024 && parsed <= 65535) this.lanPort = Math.floor(parsed)
    }
    portRow.appendChild(portLabel)
    portRow.appendChild(portInput)
    mpSection.appendChild(portRow)

    const controlsRow = document.createElement('div')
    controlsRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin:8px 0;flex-wrap:wrap'
    const hostBtn = document.createElement('button')
    hostBtn.textContent = this.lobbyConnected && this.multiplayerMode === 'host' ? 'HOSTING (CLICK TO LEAVE)' : 'HOST LOBBY'
    hostBtn.style.cssText = 'padding:6px 12px;font:bold 12px monospace;background:#0a2a0a;color:#00ff88;border:1px solid #00ff88;cursor:pointer'
    hostBtn.onclick = () => {
      if (this.lobbyConnected && this.multiplayerMode === 'host') {
        void this.leaveLobby()
      } else {
        void this.joinLobby('host')
      }
    }
    controlsRow.appendChild(hostBtn)

    const joinBtn = document.createElement('button')
    joinBtn.textContent = this.lobbyConnected && this.multiplayerMode === 'join' ? 'JOINED (CLICK TO LEAVE)' : 'JOIN LOBBY'
    joinBtn.style.cssText = 'padding:6px 12px;font:bold 12px monospace;background:#0a2a0a;color:#00ff88;border:1px solid #00ff88;cursor:pointer'
    joinBtn.onclick = () => {
      if (this.lobbyConnected && this.multiplayerMode === 'join') {
        void this.leaveLobby()
      } else {
        void this.joinLobby('join')
      }
    }
    controlsRow.appendChild(joinBtn)
    mpSection.appendChild(controlsRow)

    const status = document.createElement('div')
    const statusColor = this.lobbyStatusTone === 'ok' ? '#66ff66' : this.lobbyStatusTone === 'error' ? '#ff6666' : '#88bb88'
    status.style.cssText = `font-size:11px;color:${statusColor};margin-bottom:6px`
    status.textContent = `Lobby Status: ${this.lobbyStatusMessage}`
    mpSection.appendChild(status)

    if (this.lobbyError) {
      const err = document.createElement('div')
      err.style.cssText = 'font-size:11px;color:#ff6666;margin-bottom:6px'
      err.textContent = this.lobbyError
      mpSection.appendChild(err)
    }
    if (this.launchError) {
      const launchErr = document.createElement('div')
      launchErr.style.cssText = 'font-size:11px;color:#ff6666;margin-bottom:6px'
      launchErr.textContent = this.launchError
      mpSection.appendChild(launchErr)
    }

    const listTitle = document.createElement('div')
    listTitle.style.cssText = 'font-size:11px;color:#aaffcc;margin-top:4px'
    listTitle.textContent = 'SESSION PLAYERS'
    mpSection.appendChild(listTitle)

    const list = document.createElement('div')
    list.style.cssText = 'margin-top:4px;font-size:11px;color:#88bb88;max-height:110px;overflow:auto'
    const rows = this.getLobbyRows()
    list.innerHTML = rows.map(r => `<div>${r}</div>`).join('')
    mpSection.appendChild(list)

    if (this.multiplayerMode === 'host') {
      const eventsTitle = document.createElement('div')
      eventsTitle.style.cssText = 'font-size:11px;color:#aaffcc;margin-top:8px'
      eventsTitle.textContent = 'HOST CONNECTION EVENTS'
      mpSection.appendChild(eventsTitle)

      const events = document.createElement('div')
      events.style.cssText = 'margin-top:4px;font-size:11px;color:#88bb88;max-height:110px;overflow:auto'
      const eventRows = this.hostEvents.length > 0
        ? this.hostEvents.map(evt => `${new Date(evt.timestamp).toLocaleTimeString()} - ${evt.message}`)
        : ['(no connection activity yet)']
      events.innerHTML = eventRows.map(r => `<div>${r}</div>`).join('')
      mpSection.appendChild(events)
    }
    this.el.appendChild(mpSection)

    // Launch button
    const btn = document.createElement('button')
    btn.textContent = 'LAUNCH MISSION'
    btn.style.cssText = 'padding:14px 48px;font:bold 16px monospace;background:#0a2a0a;color:#00ff88;border:2px solid #00ff88;cursor:pointer;letter-spacing:3px'
    btn.onclick = () => {
      this.launchError = ''
      try {
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
        const multiplayer: MultiplayerConfig = this.lobbyConnected
          ? {
              mode: this.multiplayerMode,
              host: this.multiplayerMode === 'join' ? this.joinHost : this.hostLanIp,
              port: this.lanPort,
            }
          : { mode: 'single', host: '127.0.0.1', port: this.lanPort }
        const handoffClient = this.lobbyConnected ? this.lobbyClient : null
        if (handoffClient) {
          this.preserveLobbyClientOnDispose = true
          this.unsubscribeLobbyRoster?.()
          this.unsubscribeLobbyRoster = null
          this.lobbyClient = null
          this.lobbyConnected = false
        }
        this.onLaunch(this.selectedSpec, stores, multiplayer, handoffClient)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        this.launchError = `Launch failed: ${msg}`
        console.error('Launch failed', err)
        this.render()
      }
    }
    this.el.appendChild(btn)
  }

  private async joinLobby(mode: 'host' | 'join'): Promise<void> {
    this.multiplayerMode = mode
    this.lobbyError = ''
    this.lobbyStatusTone = 'warn'
    this.lobbyStatusMessage = mode === 'host' ? 'Creating lobby...' : 'Joining lobby...'
    this.render()
    const mp = this.getMultiplayerBridge()
    if (!mp) {
      this.lobbyError = 'Multiplayer bridge unavailable in this runtime.'
      this.lobbyStatusTone = 'error'
      this.lobbyStatusMessage = 'Lobby unavailable in this runtime.'
      this.render()
      return
    }
    await this.leaveLobby(false)
    try {
      if (mode === 'host') {
        const hostInfo = await mp.startHost(this.lanPort)
        this.hostLanIp = hostInfo.hostIp
      }
      const connectHost = mode === 'host' ? '127.0.0.1' : this.joinHost
      const client = new MultiplayerClient({ aircraftId: this.selectedSpec.id })
      await client.connect({
        mode,
        host: connectHost,
        port: this.lanPort,
      })
      this.lobbyClient = client
      this.lobbyConnected = true
      this.unsubscribeLobbyRoster = client.onRosterChanged(() => this.render())
      this.lobbyStatusTone = 'ok'
      this.lobbyStatusMessage = mode === 'host'
        ? `Lobby created successfully at ${this.hostLanIp}:${this.lanPort}`
        : `Joined lobby at ${this.joinHost}:${this.lanPort}`
    } catch (err) {
      this.lobbyClient = null
      this.lobbyConnected = false
      this.lobbyError = err instanceof Error ? err.message : 'Failed to join lobby.'
      this.lobbyStatusTone = 'error'
      this.lobbyStatusMessage = mode === 'host' ? 'Failed to create lobby.' : 'Failed to join lobby.'
    }
    this.render()
  }

  private async leaveLobby(stopHostIfHosting = true): Promise<void> {
    const mp = this.getMultiplayerBridge()
    this.unsubscribeLobbyRoster?.()
    this.unsubscribeLobbyRoster = null
    this.lobbyClient?.disconnect()
    this.lobbyClient = null
    this.lobbyConnected = false
    this.lobbyStatusTone = 'warn'
    this.lobbyStatusMessage = 'Not connected to lobby.'
    this.lobbyError = ''
    if (stopHostIfHosting && this.multiplayerMode === 'host' && mp) {
      try {
        await mp.stopHost()
      } catch {
        // ignore
      }
    }
  }

  private getLobbyRows(): string[] {
    if (!this.lobbyConnected || !this.lobbyClient) return ['(host or join a lobby to view players)']
    const rows: string[] = []
    const localSpec = getAircraftById(this.selectedSpec.id)
    const localName = localSpec?.displayName ?? this.selectedSpec.id.toUpperCase()
    rows.push(`YOU - ${localName} - IN LOBBY`)
    for (const peer of this.lobbyClient.getRemoteSnapshots()) {
      const spec = getAircraftById(peer.profile.aircraftId)
      const aircraftName = spec?.displayName ?? peer.profile.aircraftId.toUpperCase()
      const status = peer.state ? 'IN FLIGHT' : 'IN LOBBY'
      rows.push(`${peer.playerId} - ${aircraftName} - ${status}`)
    }
    return rows.length > 0 ? rows : ['(no players yet)']
  }

  private getMultiplayerBridge():
    | {
        startHost: (port: number) => Promise<{ ok: true; hostIp: string; port: number }>
        stopHost: () => Promise<{ ok: true }>
        getLanIp: () => Promise<{ ip: string }>
        onLobbyEvent: (cb: (evt: { message: string; timestamp: number }) => void) => () => void
      }
    | null {
    return (window as unknown as { fsim?: { multiplayer?: LoadoutScreen['getMultiplayerBridge'] extends () => infer T ? T : never } }).fsim?.multiplayer ?? null
  }

  dispose(): void {
    this.unsubscribeLobbyEvents?.()
    this.unsubscribeLobbyEvents = null
    if (!this.preserveLobbyClientOnDispose) {
      void this.leaveLobby(false)
    }
    document.body.removeChild(this.el)
  }
}
