import { MissionSelectScreen } from './ui/MissionSelectScreen'
import { LoadoutScreen } from './ui/LoadoutScreen'
import { MainMenuScreen } from './ui/MainMenuScreen'
import { MultiplayerLobbyScreen } from './ui/MultiplayerLobbyScreen'
import { FlightSession, type LobbyRestoreBundle, type FlightOptions } from './FlightSession'
import { DebriefScreen } from './ui/DebriefScreen'
import type { MultiplayerConfig } from './network/MultiplayerTypes'
import type { MultiplayerClient } from './network/MultiplayerClient'
import type { AircraftSpec, WeaponCategory } from './types/aircraft'
import type { LoadedStore } from './types/weapons'
import type { FlightResult, ScenarioDescriptor } from './types/mission'
import { DEFAULT_SCENARIO, DOGFIGHT } from './mission/scenarios'
import { loadSettings, recordSortie } from './persistence'
import { EMPTY_SORTIE_STATS } from './mission/SortieStats'
import { buildPreset, type LoadoutPreset } from './data/hardpoints/presets'
import { MISSILE_SPECS, getStoreDragPenalty } from './data/weapons/catalog'

/** Turn a preset into the loaded stores the flight session expects. */
function storesForPreset(spec: AircraftSpec, preset: LoadoutPreset): LoadedStore[] {
  const out: LoadedStore[] = []
  for (const [hardpointId, weaponId] of Object.entries(buildPreset(spec, preset))) {
    const missile = MISSILE_SPECS[weaponId]
    if (!missile) continue
    out.push({
      hardpointId,
      weaponId,
      category: missile.category as WeaponCategory,
      massKg: missile.massKg,
      dragPenalty: getStoreDragPenalty(missile),
      remainingRounds: 1,
    })
  }
  return out
}

/**
 * Flight options for a LAN sortie. Time of day and weather come from the
 * scenario, never the player: neither is replicated, so two pilots on different
 * settings would be flying measurably different air.
 */
function flightOptionsFromSettings(): FlightOptions {
  const saved = loadSettings()
  return {
    glocEnabled: saved.glocEnabled,
    autoRudder: saved.autoRudder,
    invertPitch: saved.invertPitch,
    timeOfDay: DOGFIGHT.timeOfDay ?? 'DAY',
    weather: DOGFIGHT.weather ?? 'CLEAR',
    masterVolume: saved.masterVolume,
    postFXQuality: saved.postFXQuality,
  }
}

export type { FlightResult } from './types/mission'
export type AppState = 'MAIN_MENU' | 'MISSION_SELECT' | 'LOADOUT' | 'LOBBY' | 'FLIGHT' | 'DEBRIEF'

interface FlightArgs {
  spec: AircraftSpec
  stores: LoadedStore[]
  multiplayer: MultiplayerConfig
  client: MultiplayerClient | null
  options: FlightOptions
}

export class App {
  private state: AppState = 'MAIN_MENU'
  private mainMenuScreen: MainMenuScreen | null = null
  private missionSelectScreen: MissionSelectScreen | null = null
  private loadoutScreen: LoadoutScreen | null = null
  private lobbyScreen: MultiplayerLobbyScreen | null = null
  private flightSession: FlightSession | null = null
  private debriefScreen: DebriefScreen | null = null
  private selectedScenario: ScenarioDescriptor = DEFAULT_SCENARIO
  /** True while the current sortie belongs to a LAN match, so debrief returns to the lobby. */
  private inMultiplayer = false
  /** LAN bundle preserved when leaving flight so debrief → loadout keeps the lobby session. */
  private lobbyRestore: LobbyRestoreBundle | null = null
  /** Last flight parameters — replayed by the pause menu's "Restart Mission". */
  private lastFlightArgs: FlightArgs | null = null
  private uiOverlay: HTMLElement

  constructor() {
    this.uiOverlay = document.getElementById('ui-overlay')!
  }

  start(): void {
    this.enterMainMenu()
  }

  /** Tear down every screen. Each enter* method calls this before building its own. */
  private clearScreens(): void {
    this.mainMenuScreen?.dispose()
    this.mainMenuScreen = null
    this.missionSelectScreen?.dispose()
    this.missionSelectScreen = null
    this.loadoutScreen?.dispose()
    this.loadoutScreen = null
    this.lobbyScreen?.dispose()
    this.lobbyScreen = null
    this.debriefScreen?.dispose()
    this.debriefScreen = null
  }

  private enterMainMenu(): void {
    this.state = 'MAIN_MENU'
    this.clearScreens()
    this.flightSession?.dispose()
    this.flightSession = null
    this.lobbyRestore = null
    this.inMultiplayer = false

    this.mainMenuScreen = new MainMenuScreen({
      onSinglePlayer: () => this.enterMissionSelect(),
      onMultiplayer: () => this.enterLobby(),
    })
  }

  /**
   * LAN lobby. The scenario is fixed to Dogfight: every other scenario spawns AI
   * independently and unreplicated on each client, so choosing one for a LAN
   * session gave each player a private copy of the same bandits.
   */
  private enterLobby(initialError: string | null = null): void {
    this.state = 'LOBBY'
    this.clearScreens()
    this.flightSession?.dispose()
    this.flightSession = null
    this.selectedScenario = DOGFIGHT

    const restore = this.lobbyRestore
    this.lobbyRestore = null

    this.lobbyScreen = new MultiplayerLobbyScreen(
      {
        onLaunch: args => {
          this.inMultiplayer = true
          this.enterFlight({
            spec: args.spec,
            stores: storesForPreset(args.spec, args.preset),
            multiplayer: args.config,
            client: args.client,
            options: flightOptionsFromSettings(),
          })
        },
        onBack: () => this.enterMainMenu(),
      },
      restore ? { client: restore.client, config: restore.config } : null,
      initialError,
    )
  }

  private enterMissionSelect(): void {
    this.state = 'MISSION_SELECT'
    this.clearScreens()
    this.flightSession?.dispose()
    this.flightSession = null
    this.lobbyRestore = null
    this.inMultiplayer = false

    this.missionSelectScreen = new MissionSelectScreen(this.uiOverlay, scenario => {
      this.selectedScenario = scenario
      this.enterLoadout()
    }, () => this.enterMainMenu())
  }

  private enterLoadout(): void {
    this.state = 'LOADOUT'
    this.clearScreens()
    this.flightSession?.dispose()
    this.flightSession = null

    this.loadoutScreen = new LoadoutScreen(
      this.uiOverlay,
      (spec, stores, multiplayer, client, options) => {
        this.enterFlight({ spec, stores, multiplayer, client, options })
      },
      {
        scenario: this.selectedScenario,
        onBack: () => this.enterMissionSelect(),
      }
    )
  }

  private enterFlight(args: FlightArgs): void {
    this.state = 'FLIGHT'
    this.clearScreens()
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
      () => this.restartFlight(),
      // A sortie that was supposed to be multiplayer but could not reach the
      // session goes back to the lobby saying why, rather than silently
      // becoming a solo flight in an empty sky.
      message => {
        this.flightSession?.dispose()
        this.flightSession = null
        this.enterLobby(message)
      }
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
    // A LAN sortie goes back to the lobby with the socket intact — that is what
    // makes REMATCH a single click instead of a re-handshake.
    const backToLobby = this.lobbyRestore !== null && this.inMultiplayer

    // The pilot has already read the end-of-match board; a personal debrief on
    // top of it would put a second click in front of the next match. The sortie
    // is still recorded above either way.
    if (result.fromMatchEnd && backToLobby) {
      this.enterLobby()
      return
    }

    this.debriefScreen = new DebriefScreen(this.uiOverlay, result, () => {
      if (backToLobby) this.enterLobby()
      else this.enterLoadout()
    }, {
      primaryButtonLabel: backToLobby ? 'RETURN TO LOBBY' : 'RETURN TO LOADOUT',
    })
  }
}
