import { MissionSelectScreen } from './ui/MissionSelectScreen'
import { LoadoutScreen } from './ui/LoadoutScreen'
import { FlightSession, type LobbyRestoreBundle, type FlightOptions } from './FlightSession'
import { DebriefScreen } from './ui/DebriefScreen'
import type { MultiplayerConfig } from './network/MultiplayerTypes'
import type { MultiplayerClient } from './network/MultiplayerClient'
import type { AircraftSpec } from './types/aircraft'
import type { LoadedStore } from './types/weapons'
import type { FlightResult, ScenarioDescriptor } from './types/mission'
import { DEFAULT_SCENARIO } from './mission/scenarios'
import { recordSortie } from './persistence'
import { EMPTY_SORTIE_STATS } from './mission/SortieStats'

export type { FlightResult } from './types/mission'
export type AppState = 'MISSION_SELECT' | 'LOADOUT' | 'FLIGHT' | 'DEBRIEF'

interface FlightArgs {
  spec: AircraftSpec
  stores: LoadedStore[]
  multiplayer: MultiplayerConfig
  client: MultiplayerClient | null
  options: FlightOptions
}

export class App {
  private state: AppState = 'MISSION_SELECT'
  private missionSelectScreen: MissionSelectScreen | null = null
  private loadoutScreen: LoadoutScreen | null = null
  private flightSession: FlightSession | null = null
  private debriefScreen: DebriefScreen | null = null
  private selectedScenario: ScenarioDescriptor = DEFAULT_SCENARIO
  /** LAN bundle preserved when leaving flight so debrief → loadout keeps the lobby session. */
  private lobbyRestore: LobbyRestoreBundle | null = null
  /** Last flight parameters — replayed by the pause menu's "Restart Mission". */
  private lastFlightArgs: FlightArgs | null = null
  private uiOverlay: HTMLElement

  constructor() {
    this.uiOverlay = document.getElementById('ui-overlay')!
  }

  start(): void {
    this.enterMissionSelect()
  }

  private enterMissionSelect(): void {
    this.state = 'MISSION_SELECT'
    this.loadoutScreen?.dispose()
    this.loadoutScreen = null
    this.flightSession?.dispose()
    this.flightSession = null
    this.debriefScreen?.dispose()
    this.debriefScreen = null
    this.lobbyRestore = null

    this.missionSelectScreen = new MissionSelectScreen(this.uiOverlay, scenario => {
      this.selectedScenario = scenario
      this.enterLoadout()
    })
  }

  private enterLoadout(): void {
    this.state = 'LOADOUT'
    this.missionSelectScreen?.dispose()
    this.missionSelectScreen = null
    this.flightSession?.dispose()
    this.flightSession = null
    this.debriefScreen?.dispose()
    this.debriefScreen = null

    const restore = this.lobbyRestore
    this.lobbyRestore = null

    this.loadoutScreen = new LoadoutScreen(
      this.uiOverlay,
      (spec, stores, multiplayer, client, options) => {
        this.enterFlight({ spec, stores, multiplayer, client, options })
      },
      {
        scenario: this.selectedScenario,
        onBack: () => this.enterMissionSelect(),
        lobbyRestore: restore ?? undefined,
      }
    )
  }

  private enterFlight(args: FlightArgs): void {
    this.state = 'FLIGHT'
    this.loadoutScreen?.dispose()
    this.loadoutScreen = null
    this.flightSession?.dispose()
    this.lastFlightArgs = args

    this.flightSession = new FlightSession(
      args.spec,
      args.stores,
      this.selectedScenario,
      args.multiplayer,
      args.client,
      result => {
        this.enterDebrief(result)
      },
      args.options,
      () => this.restartFlight()
    )
    this.flightSession.start()
  }

  /** Pause-menu "Restart Mission" — tear down and relaunch with the same params. */
  private restartFlight(): void {
    if (!this.lastFlightArgs) return
    this.flightSession?.dispose()
    this.flightSession = null
    // The preserved lobby client (if any) was already consumed; single-player only.
    this.enterFlight({ ...this.lastFlightArgs, client: null })
  }

  private enterDebrief(result: FlightResult): void {
    this.state = 'DEBRIEF'
    const bundle = this.flightSession?.dispose({ preserveMultiplayer: true })
    this.flightSession = null

    recordSortie({
      timestamp: Date.now(),
      missionName: result.missionName,
      aircraftName: result.aircraftName,
      outcome: result.outcome,
      kills: result.kills,
      groundKills: result.groundKills,
      deaths: result.deaths,
      flightTimeSec: result.flightTimeSec,
      landingSinkMS: result.landing?.sinkMS ?? null,
      stats: result.stats ?? EMPTY_SORTIE_STATS,
    })

    this.lobbyRestore = bundle?.client.isConnected() ? bundle : null

    this.debriefScreen = new DebriefScreen(this.uiOverlay, result, () => {
      this.enterLoadout()
    }, {
      primaryButtonLabel: this.lobbyRestore ? 'RETURN TO LOBBY' : 'RETURN TO LOADOUT',
    })
  }
}
