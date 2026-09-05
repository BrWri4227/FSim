/**
 * Rules about what a freshly spawned combatant may do immediately.
 *
 * Everything hostile in a scenario is created at t=0 with its weapons cold and
 * its cooldowns at zero, which meant the first frame of a mission could contain
 * a missile launch. A player who had not yet looked at the radar — or finished
 * reading the briefing off the screen — was already defending. That is a spawn
 * artifact rather than a tactic, and it applies equally to a BVR fighter and to
 * a SAM site, so the delay lives here rather than in either of them.
 */

/**
 * Grace period before a freshly spawned hostile may take its first missile shot.
 *
 * Long enough for the player to orient, get a radar picture and register the
 * launch warning; short enough that the opening of a mission still feels
 * contested rather than safe.
 */
export const SPAWN_FIRE_DELAY_SEC = 6
