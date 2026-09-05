export type MultiplayerMode = 'single' | 'host' | 'join'

/**
 * The port both halves of the project agree on.
 *
 * The lobby and the head-less server used to default to different numbers
 * (45454 and 8080), so a player following docs/dedicated-server.md and a player
 * using the in-app host never met. Concurrent sessions on one box are separate
 * processes on separate ports, so this is only the starting point — the player
 * edits it, and the choice is persisted.
 */
export const DEFAULT_SESSION_PORT = 45454

/** Ports a player may type. Below 1024 needs privileges no game should ask for. */
export const MIN_SESSION_PORT = 1024
export const MAX_SESSION_PORT = 65535

/**
 * Bumped whenever the wire format changes in a way an older build cannot read.
 *
 * A dedicated server on a Pi can run for months while clients update around it.
 * The server does not refuse a mismatch outright — it refuses one it cannot
 * understand, and says so, rather than accepting the join and letting the
 * player fly in a session where nothing lines up.
 */
export const PROTOCOL_VERSION = 1

export function isValidSessionPort(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_SESSION_PORT &&
    value <= MAX_SESSION_PORT
  )
}

export interface MultiplayerConfig {
  mode: MultiplayerMode
  host: string
  port: number
}

export type DamageZone = 'ENGINE' | 'WING_LEFT' | 'WING_RIGHT' | 'FUSELAGE' | 'TAIL' | 'COCKPIT'

export type RadarMode = 'OFF' | 'RWS' | 'TWS' | 'STT' | 'GMTI'

/**
 * Which side a pilot is on. Deliberately independent of the aircraft's nation:
 * a friends session should be able to put any two people on the same side
 * without dictating what they fly.
 */
export type Team = 'BLUE' | 'RED'

export const TEAMS: readonly Team[] = ['BLUE', 'RED']

/** Receivers default to this when a peer sends no team (older build). */
export const DEFAULT_TEAM: Team = 'BLUE'

export function isTeam(v: unknown): v is Team {
  return v === 'BLUE' || v === 'RED'
}

export function opposingTeam(team: Team): Team {
  return team === 'BLUE' ? 'RED' : 'BLUE'
}

/**
 * What a server says about itself to anyone who asks, without joining.
 *
 * Concurrent sessions on one box are separate processes on separate ports, so
 * `name` is what tells "Dogfight A" on 45454 from "Dogfight B" on 45455.
 */
export interface ServerInfo {
  name: string
  description: string | null
  players: number
  maxPlayers: number
  /** Whether a password is needed to join. The password itself is never sent. */
  requiresPassword: boolean
  protocolVersion: number
  match: MatchState
  config: MatchConfig
}

/** Why a join was refused. Each maps to a specific line in the lobby. */
export type JoinRejectionReason = 'full' | 'bad-password' | 'version'

export interface NetPlayerProfile {
  aircraftId: string
  /**
   * Display name shown to every other client. Optional so a client on an older
   * build still validates; receivers fall back to the peer id.
   */
  callsign?: string
  /**
   * Side this pilot is fighting for. Optional for the same reason as callsign —
   * a peer that omits it is treated as [DEFAULT_TEAM].
   */
  team?: Team
  /**
   * Lobby ready state. Lives on the profile rather than in its own message
   * because it changes at the same cadence as the callsign and the team, and
   * the roster broadcast already carries all three.
   */
  ready?: boolean
}

/** What the host sets before a match starts. */
export interface MatchConfig {
  mode: 'TDM' | 'FFA'
  /** Team kills that end the match. */
  scoreLimit: number
  /** Wall-clock cap. Whoever leads when it expires wins. */
  timeLimitSec: number
}

export type MatchPhase = 'LOBBY' | 'LIVE' | 'ENDED'

export interface TeamScores {
  BLUE: number
  RED: number
}

export interface MatchState {
  phase: MatchPhase
  /** Server clock at the moment the match went LIVE; 0 while in the lobby. */
  startedAtMs: number
  teamScores: TeamScores
  /** Set only in ENDED. Null means a draw. */
  winner: Team | null
}

/**
 * Short on purpose. A twelve-minute match that ends is worth more than a
 * twenty-five-minute one that fizzles — the point is to reach the board and the
 * rematch button while everyone still wants another go.
 */
export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  mode: 'TDM',
  scoreLimit: 25,
  timeLimitSec: 12 * 60,
}

export function emptyTeamScores(): TeamScores {
  return { BLUE: 0, RED: 0 }
}

export function lobbyMatchState(): MatchState {
  return { phase: 'LOBBY', startedAtMs: 0, teamScores: emptyTeamScores(), winner: null }
}

export interface NetRadarState {
  mode: RadarMode
  sttTargetId: string | null
}

export interface NetMissileState {
  id: string
  positionNED: [number, number, number]
  velocityNED: [number, number, number]
  targetEntityId: string
  active: boolean
}

export interface NetFlareState {
  positionNED: [number, number, number]
  velocityNED: [number, number, number]
  heatSignatureKW: number
  ageSec: number
}

export interface NetChaffState {
  positionNED: [number, number, number]
  velocityNED: [number, number, number]
  rcsM2: number
  ageSec: number
}

export interface NetCountermeasureState {
  flares: NetFlareState[]
  chaffClouds: NetChaffState[]
}

export interface NetPlayerState {
  positionNED: [number, number, number]
  velocityNED: [number, number, number]
  attitudeQuat: [number, number, number, number]
  throttle: number
  ejected: boolean
  structuralFailure: boolean
  radar: NetRadarState
  missiles: NetMissileState[]
  /**
   * `null` means "unchanged since my last snapshot" — the sender omits the
   * countermeasure payload when no flare/chaff was dispensed or expired, and
   * the receiver ages its existing clouds locally. Cuts bandwidth sharply
   * during heavy countermeasure use (a 30-flare salvo is ~150 numbers).
   */
  countermeasures: NetCountermeasureState | null
}

export interface HitEvent {
  sourceId: string
  targetId: string
  zone: DamageZone
  severity: number
  weapon: 'GUN' | 'MISSILE'
}

/** Scoreboard entry. Maintained by the server so every client agrees. */
export interface NetScore {
  kills: number
  deaths: number
}

export type ClientMessage =
  /**
   * "Tell me about yourself." Answered before any join, so the lobby can show a
   * name, a player count and a ping for an address the player typed without
   * taking a slot in the session or committing to it.
   */
  | { type: 'query' }
  | {
      type: 'join'
      profile: NetPlayerProfile
      /** Only when the server asked for one. Absent on an open server. */
      password?: string
      /** Absent from builds predating the check; the server treats that as unknown. */
      protocolVersion?: number
    }
  | { type: 'profile-update'; profile: NetPlayerProfile }
  | { type: 'state'; state: NetPlayerState }
  /** Clears in-flight state on the server so roster shows IN LOBBY again. */
  | { type: 'return-to-lobby' }
  | { type: 'hit'; hit: HitEvent }
  /**
   * "I was shot down." The victim reports its own death because damage is
   * client-authoritative — only the victim knows its damage state crossed the
   * threshold. `killerId` is the victim's best guess at who did it, or null
   * for terrain, a stall or a voluntary eject. The sender never states its own
   * id; the server stamps it, matching the `hit` precedent.
   */
  | { type: 'death'; killerId: string | null }
  /** Host only — the server ignores it from anyone else. */
  | { type: 'set-match-config'; config: MatchConfig }
  /** Host only. Moves the session from LOBBY to LIVE for everybody at once. */
  | { type: 'start-match' }
  /** Host only. Clears the scores and returns everyone to LOBBY. */
  | { type: 'request-rematch' }

export type ServerMessage =
  /** Reply to `query`. The socket closes straight after. */
  | { type: 'server-info'; info: ServerInfo }
  /**
   * The join did not happen, and why. Sent instead of `welcome`, immediately
   * before the close, so the client can say something specific rather than
   * reporting a generic timeout.
   */
  | { type: 'join-rejected'; reason: JoinRejectionReason }
  | {
      type: 'welcome'
      playerId: string
      peers: Array<{
        playerId: string
        profile: NetPlayerProfile
        state: NetPlayerState | null
        score: NetScore
      }>
      /** Late joiners need their own row too, in case of a reconnect. */
      score: NetScore
      /** Whoever the server currently treats as host — the only peer whose rules it takes. */
      hostId: string
      config: MatchConfig
      match: MatchState
    }
  /** Host changed, e.g. because the previous one left. */
  | { type: 'host-changed'; hostId: string }
  | { type: 'match-config'; config: MatchConfig }
  /**
   * Authoritative match state. The server owns this so two clients can never
   * disagree about whether the match is over — the same mistake the
   * single-player scenarios make in a LAN session, where each client evaluates
   * its own win conditions against its own private copy of the world.
   */
  | { type: 'match-state'; match: MatchState }
  | {
      type: 'peer-join'
      playerId: string
      profile: NetPlayerProfile
    }
  | {
      type: 'peer-leave'
      playerId: string
    }
  | {
      type: 'peer-profile-update'
      playerId: string
      profile: NetPlayerProfile
    }
  | {
      type: 'state'
      playerId: string
      profile: NetPlayerProfile
      state: NetPlayerState | null
    }
  | {
      type: 'hit'
      hit: HitEvent
    }
  | {
      type: 'death'
      victimId: string
      /** Null for terrain, a stall, or a kill the victim could not attribute. */
      killerId: string | null
      /** Authoritative post-event totals, so no client has to keep its own tally. */
      victimScore: NetScore
      killerScore: NetScore | null
    }

export function cloneNetPlayerState(s: NetPlayerState): NetPlayerState {
  return {
    positionNED: [...s.positionNED],
    velocityNED: [...s.velocityNED],
    attitudeQuat: [...s.attitudeQuat],
    throttle: s.throttle,
    ejected: s.ejected,
    structuralFailure: s.structuralFailure,
    radar: {
      mode: s.radar.mode,
      sttTargetId: s.radar.sttTargetId,
    },
    missiles: s.missiles.map(m => ({
      id: m.id,
      positionNED: [...m.positionNED],
      velocityNED: [...m.velocityNED],
      targetEntityId: m.targetEntityId,
      active: m.active,
    })),
    countermeasures: s.countermeasures
      ? {
          flares: s.countermeasures.flares.map(f => ({
            positionNED: [...f.positionNED],
            velocityNED: [...f.velocityNED],
            heatSignatureKW: f.heatSignatureKW,
            ageSec: f.ageSec,
          })),
          chaffClouds: s.countermeasures.chaffClouds.map(c => ({
            positionNED: [...c.positionNED],
            velocityNED: [...c.velocityNED],
            rcsM2: c.rcsM2,
            ageSec: c.ageSec,
          })),
        }
      : null,
  }
}
