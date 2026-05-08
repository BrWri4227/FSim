import { LoadoutScreen } from './ui/LoadoutScreen'
import { FlightSession } from './FlightSession'
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

    this.loadoutScreen = new LoadoutScreen(this.uiOverlay, (spec, stores, multiplayer, client) => {
      this.enterFlight(spec, stores, multiplayer, client)
    })
  }

  private enterFlight(
    spec: AircraftSpec,
    stores: LoadedStore[],
    multiplayer: MultiplayerConfig,
    multiplayerClient: MultiplayerClient | null
  ): void {
    this.state = 'FLIGHT'
    this.loadoutScreen?.dispose()
    this.loadoutScreen = null

    this.flightSession = new FlightSession(spec, stores, multiplayer, multiplayerClient, (result) => {
      this.enterDebrief(result)
    })
    this.flightSession.start()
  }

  private enterDebrief(result: FlightResult): void {
    this.state = 'DEBRIEF'
    this.flightSession?.dispose()
    this.flightSession = null

    this.debriefScreen = new DebriefScreen(this.uiOverlay, result, () => {
      this.enterLoadout()
    })
  }
}
