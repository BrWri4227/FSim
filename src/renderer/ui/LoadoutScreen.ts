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
  private onLaunch: (spec: AircraftSpec, stores: LoadedStore[], multiplayer: MultiplayerConfig) => void
  private multiplayerMode: MultiplayerConfig['mode'] = 'single'
  private joinHost = '127.0.0.1'
  private hostLanIp = '127.0.0.1'
  private lanPort = 45454
  private lobbyClient: MultiplayerClient | null = null
  private lobbyConnected = false
  private lobbyError = ''
  private unsubscribeLobbyRoster: (() => void) | null = null
  private selectedWeaponByHardpoint = new Map<string, string>()

  constructor(_container: HTMLElement, onLaunch: (spec: AircraftSpec, stores: LoadedStore[], multiplayer: MultiplayerConfig) => void) {
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
    void this.initLanInfo()
    this.render()
  }

  private async initLanInfo(): Promise<void> {
    try {
      const res = await window.fsim.multiplayer.getLanIp()
      this.hostLanIp = res.ip
      this.render()
    } catch {
      // ignore and keep localhost fallback
    }
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

    const modeRow = document.createElement('div')
    modeRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0'
    const modeSel = document.createElement('select')
    modeSel.style.cssText = 'background:#0a150a;color:#00ff88;border:1px solid #226644;font:11px monospace'
    modeSel.innerHTML = `
      <option value="single">Single Player</option>
      <option value="host">Host LAN Session</option>
      <option value="join">Join LAN Session</option>
    `
    modeSel.value = this.multiplayerMode
    modeSel.onchange = () => {
      this.multiplayerMode = modeSel.value as MultiplayerConfig['mode']
      this.lobbyError = ''
      this.render()
    }
    modeRow.appendChild(modeSel)
    mpSection.appendChild(modeRow)

    if (this.multiplayerMode === 'host') {
      const info = document.createElement('div')
      info.style.cssText = 'font-size:11px;color:#88bb88'
      info.textContent = `Share with LAN peers: ${this.hostLanIp}:${this.lanPort}`
      mpSection.appendChild(info)
    }

    if (this.multiplayerMode === 'join') {
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
    }

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

    if (this.multiplayerMode !== 'single') {
      const controlsRow = document.createElement('div')
      controlsRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin:8px 0'
      const joinBtn = document.createElement('button')
      joinBtn.textContent = this.lobbyConnected ? 'LEAVE LOBBY' : 'JOIN LOBBY'
      joinBtn.style.cssText = 'padding:6px 12px;font:bold 12px monospace;background:#0a2a0a;color:#00ff88;border:1px solid #00ff88;cursor:pointer'
      joinBtn.onclick = () => {
        if (this.lobbyConnected) {
          void this.leaveLobby()
        } else {
          void this.joinLobby()
        }
      }
      controlsRow.appendChild(joinBtn)

      const status = document.createElement('span')
      status.style.cssText = 'font-size:11px;color:#88bb88'
      status.textContent = this.lobbyConnected ? 'Connected to lobby' : 'Not connected to lobby'
      controlsRow.appendChild(status)
      mpSection.appendChild(controlsRow)

      if (this.lobbyError) {
        const err = document.createElement('div')
        err.style.cssText = 'font-size:11px;color:#ff6666;margin-bottom:6px'
        err.textContent = this.lobbyError
        mpSection.appendChild(err)
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
    }
    this.el.appendChild(mpSection)

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
      const multiplayer: MultiplayerConfig = {
        mode: this.multiplayerMode,
        host: this.multiplayerMode === 'join' ? this.joinHost : this.hostLanIp,
        port: this.lanPort,
      }
      this.onLaunch(this.selectedSpec, stores, multiplayer)
      this.dispose()
    }
    this.el.appendChild(btn)
  }

  private async joinLobby(): Promise<void> {
    this.lobbyError = ''
    if (this.multiplayerMode === 'single') {
      this.lobbyError = 'Switch to Host or Join mode first.'
      this.render()
      return
    }
    await this.leaveLobby(false)
    try {
      if (this.multiplayerMode === 'host') {
        const hostInfo = await window.fsim.multiplayer.startHost(this.lanPort)
        this.hostLanIp = hostInfo.hostIp
      }
      const connectHost = this.multiplayerMode === 'host' ? '127.0.0.1' : this.joinHost
      const client = new MultiplayerClient({ aircraftId: this.selectedSpec.id })
      await client.connect({
        mode: this.multiplayerMode,
        host: connectHost,
        port: this.lanPort,
      })
      this.lobbyClient = client
      this.lobbyConnected = true
      this.unsubscribeLobbyRoster = client.onRosterChanged(() => this.render())
    } catch (err) {
      this.lobbyClient = null
      this.lobbyConnected = false
      this.lobbyError = err instanceof Error ? err.message : 'Failed to join lobby.'
    }
    this.render()
  }

  private async leaveLobby(stopHostIfHosting = true): Promise<void> {
    this.unsubscribeLobbyRoster?.()
    this.unsubscribeLobbyRoster = null
    this.lobbyClient?.disconnect()
    this.lobbyClient = null
    this.lobbyConnected = false
    if (stopHostIfHosting && this.multiplayerMode === 'host') {
      try {
        await window.fsim.multiplayer.stopHost()
      } catch {
        // ignore
      }
    }
  }

  private getLobbyRows(): string[] {
    if (!this.lobbyConnected || !this.lobbyClient) return ['(join lobby to view players)']
    const rows: string[] = []
    const localSpec = getAircraftById(this.selectedSpec.id)
    const localName = localSpec?.displayName ?? this.selectedSpec.id.toUpperCase()
    rows.push(`YOU - ${localName}`)
    for (const peer of this.lobbyClient.getRemoteSnapshots()) {
      const spec = getAircraftById(peer.profile.aircraftId)
      const aircraftName = spec?.displayName ?? peer.profile.aircraftId.toUpperCase()
      rows.push(`${peer.playerId} - ${aircraftName}`)
    }
    return rows.length > 0 ? rows : ['(no players yet)']
  }

  dispose(): void {
    void this.leaveLobby(false)
    document.body.removeChild(this.el)
  }
}
