import { LoadoutScreen } from './ui/LoadoutScreen'
import { FlightSession, type LobbyRestoreBundle } from './FlightSession'
import { DebriefScreen } from './ui/DebriefScreen'
import type { MultiplayerConfig } from './network/MultiplayerTypes'
import type { MultiplayerClient } from './network/MultiplayerClient'
import type { AircraftSpec } from './types/aircraft'
import type { LoadedStore } from './types/weapons'

export type AppState = 'LOADOUT' | 'FLIGHT' | 'DEBRIEF'

export interface FlightResult {
  kills: number
  deaths: number
  flightTimeSec: number
  aircraftName: string
}

export class App {
  private state: AppState = 'LOADOUT'
  private loadoutScreen: LoadoutScreen | null = null
  private flightSession: FlightSession | null = null
  private debriefScreen: DebriefScreen | null = null
  /** LAN bundle preserved when leaving flight so debrief → loadout keeps the lobby session. */
  private lobbyRestore: LobbyRestoreBundle | null = null
  private uiOverlay: HTMLElement

  constructor() {
    this.uiOverlay = document.getElementById('ui-overlay')!
  }

  start(): void {
    this.enterLoadout()
  }

  private enterLoadout(): void {
    this.state = 'LOADOUT'
    this.flightSession?.dispose()
    this.flightSession = null
    this.debriefScreen?.dispose()
    this.debriefScreen = null

    const restore = this.lobbyRestore
    this.lobbyRestore = null

    this.loadoutScreen = new LoadoutScreen(
      this.uiOverlay,
      (spec, stores, multiplayer, client, glocEnabled) => {
        this.enterFlight(spec, stores, multiplayer, client, glocEnabled)
      },
      restore ?? undefined
    )
  }

  private enterFlight(
    spec: AircraftSpec,
    stores: LoadedStore[],
    multiplayer: MultiplayerConfig,
    multiplayerClient: MultiplayerClient | null,
    glocEnabled: boolean
  ): void {
    this.state = 'FLIGHT'
    this.loadoutScreen?.dispose()
    this.loadoutScreen = null

    this.flightSession = new FlightSession(spec, stores, multiplayer, multiplayerClient, (result) => {
      this.enterDebrief(result)
    }, glocEnabled)
    this.flightSession.start()
  }

  private enterDebrief(result: FlightResult): void {
    this.state = 'DEBRIEF'
    const bundle = this.flightSession?.dispose({ preserveMultiplayer: true })
    this.flightSession = null

    this.lobbyRestore = bundle?.client.isConnected() ? bundle : null

    this.debriefScreen = new DebriefScreen(this.uiOverlay, result, () => {
      this.enterLoadout()
    }, {
      primaryButtonLabel: this.lobbyRestore ? 'RETURN TO LOBBY' : 'RETURN TO LOADOUT',
    })
  }
}
