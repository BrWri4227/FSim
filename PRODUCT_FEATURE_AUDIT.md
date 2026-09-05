# FSim — Product / Game Design / Player Feature Audit

**Version audited:** 0.1.5 · **Branch:** `BW/Feature-Expansion` (`95f7005`)
**Date:** 2026-09-04
**Lens:** experienced flight-combat player · game designer · product owner
**Not in scope:** code quality, architecture, refactors, test coverage.

This audit is about one question:

> What would make a group of friends finish a match and say *"again"*?

It is deliberately different from `FRIENDS_RELEASE_AUDIT.md`, which asked whether the build
*works*. That audit's P0s (missile fuse, one-shot lethality, hit feedback, MP death handling)
have landed. This one asks whether the build, now that it works, is a *game*.

Everything below was read out of the source. Where the conclusion depends on how something
**feels** in motion, it is marked *(needs playtest)*.

---

## 1. PRODUCT ASSESSMENT

**What FSim is today: an unusually good single-player combat flight *sandbox* with a working
LAN free-for-all bolted to the side of it.**

The simulation underneath is not a prototype. It is a 13-state RK4 rigid-body flight model with
per-airframe CL/CD/Cm tables across nine alpha and seven Mach breakpoints, a speed-scheduled
carefree FCS that opens a post-stall gate below ~220 kt (so cobras and J-turns are real
manoeuvres, not glitches), an optional G-LOC physiology model, ten airframes with bespoke
exteriors and cockpits, a missile stack with augmented proportional navigation, aspect-dependent
IR signature, per-flare irradiance scoring inside the seeker gimbal cone, ARH terminal activation
with an SNR threshold, datalink mid-course, and chaff modelled as decaying RCS clouds. The damage
model has six zones that each degrade flight in a specific way — roll authority, pitch authority,
thrust, asymmetric drag, fuel-leak rate, fire. The HUD already draws a stadiametric gun funnel
with a sliding range caret and time-of-flight, a dynamic launch zone with Rmin/Rne/Rmax, a staged
shoot cue, an off-boresight steering line, a per-missile time-to-impact panel, and an RWR.

That is a genuinely strong foundation, and most of it is *player-facing depth*, not hidden
plumbing.

**What prevents it from being a game friends replay:**

The multiplayer layer has a lobby, a headless relay server, interpolated remote aircraft,
server-authoritative kills and deaths, callsigns, a kill feed and a five-second in-flight
respawn — and **no teams, no objective, no score limit, no timer, no match end and no rematch.**
`EntityManager.getEnemies()` returns every AI *plus every remote player*, and IFF is decided by
`spec.nation`. Two friends who both pick the F-16 are painted FRIENDLY by AWACS and are still
mutually shootable; a friend who picks the Su-27 is simply hostile. There is no team select, no
team score, no friendly-fire rule, and nothing that ever declares the session over.

So "playing with friends" currently resolves to "playing *against* friends, forever, until
someone alt-tabs." The word "again" has nothing to attach to, because nothing ever ended.

The second thing holding it back is that the depth is **invisible at the point of choice.** Ten
airframes are modelled at coefficient-table resolution and the selection card tells the player
three numbers — Nation, Max G, Max AoA — which read `9.0` and `26–28°` for almost the whole
roster. The sim knows the F-22 supercruises with an RCS of 0.05 m² and the MiG-29 does not. The
player has no way to find that out without reading `src/renderer/data/aircraft/`.

**Stage:** *Strong friends alpha — a complete single-player combat sandbox, plus an
unstructured LAN deathmatch.* Two focused pieces of work (teams + match structure, and making
aircraft identity legible) move it to *lightweight multiplayer dogfighter you would schedule an
evening around*.

---

## 2. WHO IS THIS GAME FOR?

**Primary: a small group of friends (3–8) who like flight games but do not want a study sim.**

Concretely: people who bounced off DCS because two hours of manuals stood between them and a
dogfight, but who find Battlefield jets too weightless to have a *skill* in. They want the
airframe to feel like it has mass and energy, they want to understand why they died, and they
want to be back in the air in ten seconds.

FSim is already tuned for exactly this person. The carefree FCS means a new pilot cannot depart
the aircraft by pulling too hard; the post-stall gate means an experienced one can still point
the nose at 60° alpha and take a shot. That is a genuine easy-to-learn / hard-to-master axis and
it is already built. G-LOC is a checkbox. Auto-rudder is a checkbox. These are the right calls.

**Secondary: solo players who want a 5-minute intercept between other things.** The Head-On BVR
scenario is a complete, satisfying, three-minute experience today.

**Explicitly not for:** DCS-adjacent study-sim players (there are no startup procedures, no
clickable cockpits, no navigation, and adding them would wreck the primary audience's onboarding),
or players who want a persistent progression game.

Do not chase either. The roster and the flight model are already better than the friends audience
needs; the gap is entirely in *match structure*, not fidelity.

---

## 3. CORE PLAYER FANTASY

> **"I'm flying a fighter that has real weight and real energy, I can see the whole fight
> unfolding around me, and I'm outflying my friends by making better decisions than they do —
> and when I lose, I know exactly why."**

Three load-bearing words:

- **Weight** — the flight model already delivers this. Protect it.
- **See** — situational awareness is the fight. FSim's HUD is close; the camera is not.
- **Know why** — the loop is only replayable if death is legible. Half of that exists (RWR,
  missile TTI, kill feed, hit vignette); the other half (kill cam, "what killed me") does not.

---

## 4. CORE PLAYER JOBS

Ranked by how much of a session they occupy and how much they determine whether the player comes
back.

| # | Job | Currently served? |
|---|---|---|
| 1 | **Fly the jet well** — turn, manage energy, not depart | **Excellent.** FCS, post-stall gate, real aero. |
| 2 | **Find the fight** | **Adequate solo, poor in MP.** AWACS + radar solo; nothing directs you to players. |
| 3 | **Understand who is where** | **Good in the box, poor outside it.** Rich HUD, but 2-state camera. |
| 4 | **Take a shot that feels earned** | **Very good.** Gun funnel + DLZ + staged shoot cue are excellent. |
| 5 | **Survive a shot** | **Very good.** RWR, TTI panel, real flare/chaff modelling. |
| 6 | **Know I hit / killed something** | **Half-built.** You feel damage taken, not damage dealt. |
| 7 | **Get back in fast after dying** | **Good in MP (5 s), absent solo (death ends the sortie).** |
| 8 | **Help a friend** | **Not served at all.** No teams, no shared picture, no pings. |
| 9 | **Know how the match went** | **Not served in MP.** No match end, no MVP, no final board. |
| 10 | **Pick a plane that suits me** | **Not served.** The data exists; the UI hides it. |

Jobs 8, 9 and 10 are the whole gap. Note that they are all cheap relative to what has already
been built — none of them requires touching the flight model, the missile stack or the netcode
transport.

---

## 5. WHAT THE GAME ALREADY DOES WELL

These are strengths to *protect*, not improve. Several recommendations later in this document are
deliberately scoped so they do not disturb them.

**Flight feel is the standout.** The speed-scheduled AoA ceiling in `FCS.ts` is a real design
achievement: the ceiling is the placard AoA when you're fast, it opens to a post-stall gate when
you're slow, pitch authority is floored at 0.15 so the stick is never dead, and there is a hard
backstop 15° past the gate so a tumble stays recoverable. That single function is why a beginner
can't crash by pulling and an expert can still nose-point. Do not "improve" this.

**The gun is better than most games in this space.** A stadiametric funnel that converges on
target wingspan, a sliding range caret so you can see whether you're inside the tier, a
time-of-flight readout, a state-coded pipper, and an attention flash on entering a firing zone.
Landing a burst should feel earned *(needs playtest, but the machinery is correct)*.

**Missile defence is genuinely skilful.** Flares are scored by perceived irradiance
(`heatKW / dist²`) inside the seeker gimbal cone, and seduction is a separate susceptibility roll
against the seeker's `flareRejectionCapability`. That means *pulling the seeker across a hot
flare* actually matters — the AIM-9X at 0.82 rejection is hard to decoy, the R-73 differently so.
Chaff decays from 25 m² to 0.5 m² over six seconds. Defeating a missile here is a skill, not a
button. This is a real depth axis and almost no arcade flight game has it.

**Damage creates decisions already.** Six zones with distinct consequences means "can I still
fight?" has a real answer: engine at 0.7 means fire and 40% thrust and a 5× fuel leak; asymmetric
wing damage means you roll one way better than the other. The "limp home" fantasy is *already
implemented* — it is just never asked for, because no scenario rewards getting home.

**Multiplayer plumbing is further along than the game around it.** Dedicated headless server,
interpolation with a delay buffer and bounded extrapolation, server-authoritative K/D with a
death debounce, callsigns, hit replication, countermeasure replication with a null-means-unchanged
optimisation, and a lobby that survives the debrief so you don't re-handshake between sorties.
The hard part is done. What's missing is *rules*.

**The debrief is well-judged.** Missile Pk, gun hits, decoy defeats, missiles evaded, time to
first kill, max G / Mach / top speed / min AGL, a landing grade, and a running career logbook.
That is exactly the right amount of stats — informative, no analytics bloat. Keep it.

**Restraint on content.** Four air-to-air missiles (two per nation), one gun per nation, six
scenarios. This is correctly scoped. Resist adding more.

---

## 6. BIGGEST PRODUCT GAPS

Ranked by distance between what exists and a fun repeatable friends session.

### Gap 1 — There are no teams, so "with friends" means "against friends"

`getEnemies()` returns `[...this.enemies, ...this.remotePlayers.values()]`. Every remote player
is in the target list of every other player's radar, missiles and gun. The only IFF concept in
the codebase is `AWACS.ts`'s `ac.spec.nation !== playerNation ? 'HOSTILE' : 'FRIENDLY'`, which
classifies the AWACS datalink picture only — it does not stop a missile.

For a friends group this is the single most consequential absence. The two most-requested things
a group of four does — *"you and me versus those two"* and *"let's all fight bots"* — are both
impossible. Section 17 covers the teamplay consequences.

### Gap 2 — Nothing ever ends, so nothing can be repeated

`DOGFIGHT` has `winConditions: []`. The server tracks kills and deaths, and no code path ever
compares them to anything. There is no timer, no score limit, no match-end screen, no MVP, no
rematch button. The only way out is the pause menu's ABORT TO DEBRIEF, which takes *one* player
to a *personal* debrief.

A match that does not end cannot generate the "again" moment. This is why replayability is
currently a function of the players' own social energy rather than the game's.

### Gap 3 — Aircraft identity is modelled but not communicated

Ten airframes differ meaningfully in the sim: the F-22 has 208/312 kN and an RCS table starting
at 0.05 m²; the MiG-29 has 98.8/162.8 kN, 5.0 m², 3500 kg of fuel, and 60 flares to the Raptor's
96. The loadout card shows *Nation, Max G, Max AoA* — and `maxGPositive` is 9.0 on essentially
the whole roster while `maxAoADeg` spans 26–28°. From the UI, every aircraft is the same aircraft
in a different colour.

Choosing a plane should be choosing a playstyle. Right now it is choosing a skin.

### Gap 4 — The path from launcher to a shared fight is long and points the wrong way

Mission Select (whose highlighted default is **Free Flight** — empty skies) → Continue to Loadout
→ a screen containing hardpoints, environment, settings, flight options, LAN host/join, and the
full controls reference → Launch. Host and join are buried two-thirds of the way down the
*aircraft* screen. Every player must independently navigate back and pick Dogfight, and the
warning that they picked wrong appears only *after* they connect.

For a friends session the host should decide the mode once, and everyone else should press Ready.

### Gap 5 — You feel damage taken but not damage dealt

`onHitTaken` drives a red edge vignette plus a `HIT` sound. `setOnTargetHit` feeds sortie stats
and the network — and gives the shooter **nothing**. No hit marker, no sound, no confirmation.
Killing an AI increments `killCount` silently; the kill feed is fed only by multiplayer death
events.

The result: shooting feels less responsive than being shot. That is exactly backwards.

### Gap 6 — There is no co-op, and co-op is what small groups actually need

AI is suppressed entirely in LAN sessions, and the LoadoutScreen warns you about it. So with
three friends online, the options are a 3-way FFA or nothing. A 2v6-bots intercept would produce
a better evening than a 3-way FFA for most groups, and *all* of the machinery — AI behaviours,
scenario spawner, wingman commands — already exists in single-player.

### Gap 7 — The camera cannot follow a fight

Two states, toggled by Tab. Freelook is right-mouse-drag in both. There is no look-behind, no
padlock/target view, no snap-to-bandit, no kill cam, no death cam. In a turning fight the bandit
spends most of its time outside the HUD field of view, where the only aid is a dashed steering
line. This is the largest single source of "I have no idea where he went."

---

## 7. TOP 10 HIGHEST-VALUE IMPROVEMENTS

Ranked by *player value × frequency × replayability ÷ effort*, then sanity-checked against "will
a friend notice this in the first ten minutes?"

| # | Improvement | Player value | Effort | Replayability | Why it ranks here |
|---|---|---|---|---|---|
| 1 | **Teams (2 sides, friendly-fire off, team markers)** | Very High | Medium | High | Unlocks the entire cooperative half of a friends session. Everything else in multiplayer compounds off this. |
| 2 | **Match structure: score limit or timer → match-end board → REMATCH** | Very High | Medium | High | Creates the "again" moment. Without it there is no session shape at all. |
| 3 | **Outgoing hit + kill confirmation (marker, sound, kill feed for AI too)** | High | **Tiny** | Medium | The single cheapest fix in this document. The callback already exists and is already wired; it just doesn't tell the player. |
| 4 | **Aircraft identity: role tag + 5 comparative bars on the selection card** | High | Small | High | Turns a 10-plane roster from cosmetic into ten playstyles. All the data exists in the specs already. |
| 5 | **Host-driven lobby: host picks mode, everyone readies, host starts, one-click rematch** | High | Medium | High | Kills most of the setup friction and makes #2 usable without everyone re-navigating menus. |
| 6 | **Target padlock / look-back camera** | High | Small | Medium | Directly attacks "I lost him." Biggest readability win per hour of work. |
| 7 | **Radar simplification: A/A ↔ A/G toggle, one lock key** | Medium-High | **Tiny** | Low | Removes a genuine trap (cycling through OFF mid-fight). Pure friction removal. |
| 8 | **Co-op PvE: allow AI in LAN + a wave-defence / intercept mode** | High | Medium | Very High | The best answer to low player counts, and it reuses the AI that already exists. |
| 9 | **AI difficulty tiers (aim error, reaction delay, decision quality)** | Medium-High | Small | High | Makes #8 replayable and makes solo practice tunable. Must come from decision quality, never physics bonuses. |
| 10 | **Kill cam / death cam** | Medium-High | Medium | Medium | Answers "what killed me" — the second half of the core fantasy. Also the single biggest generator of table-talk. |

Items 1, 2, 5 and 8 are one coherent piece of work: *give multiplayer a game*. Items 3, 4, 6, 7
are small, independent, and each individually noticeable.

---

## 8. QUICK WINS

High player value, tiny-to-small effort. Do these first — several are under an hour and every one
is noticeable inside the first ten minutes of play.

| Quick win | Effort | What the player notices |
|---|---|---|
| **Hit marker + hit sound on outgoing fire** | Tiny | Guns and missiles suddenly feel connected. `setOnTargetHit` already fires on every hit. |
| **Kill feed line for AI kills, not just MP deaths** | Tiny | Killing a bandit is confirmed instead of silent. |
| **Radar: remove OFF and GMTI from the R cycle; put A/G on its own key** | Tiny | No more accidentally blinding yourself mid-merge. |
| **Mission Select default = a fight, not Free Flight** | Tiny | A new player's first click leads to combat. (`MissionSelectScreen` highlights `SCENARIO_CATALOG[1]`; `App` defaults to `HEAD_ON_BVR`. They disagree.) |
| **Aircraft card: role tag + T/W, turn, sensors, range, stealth bars** | Small | The roster becomes a real choice. Data is already in the specs. |
| **Loadout presets ("Dogfight / Balanced / BVR") above the per-pylon dropdowns** | Small | Nine dropdowns become one click, with the dropdowns still there for anyone who wants them. |
| **Look-back key (hold to snap camera 180°)** | Small | "Check six" becomes possible. |
| **Countermeasure separation (flare and chaff on different keys)** | Tiny | Currently `Z` dispenses both; defending a radar missile burns your flares. |
| **Move Host/Join to the top of the Loadout screen (or its own step)** | Tiny | Friends stop asking "where do I put the IP?" |
| **Show the pre-flight warning about single-player scenarios *before* connecting** | Tiny | Nobody wastes a lobby on a mission with no bandits. |

---

## 9. PLAYER RECOMMENDATIONS

*Written as the person actually flying.*

**What already feels good.** The jet has mass. Pulling into the buffet and feeling the FCS soften
the stick rather than slap it away is the right sensation. The gun funnel with the range caret is
better than most games in this genre give you — you can *see* whether you're inside the tier
instead of guessing. Defeating a missile with a well-timed flare while pulling the seeker across
it is a real skill and it is genuinely satisfying.

**Where I get frustrated.**

*"I lost him."* This is the number-one in-fight problem. Cockpit view has a narrow FOV
(75–80° depending on airframe), external chase view has no target lock, and the only way to
follow a bandit through a scissors is to right-drag the mouse while also flying. The dashed
off-boresight locator is a good instrument but it's a substitute for a camera, not a camera.
**Give me a padlock view and a hold-to-look-back key.**

*"Did I hit him?"* I fire a two-second burst, tracers converge, and nothing happens. No marker,
no thump, no sound. I have to watch the enemy's smoke to infer it. Meanwhile when *I* get hit the
screen flashes red and there's a solid impact sound. The asymmetry makes my own weapons feel
weaker than they are.

*"Why did I die?"* In multiplayer I get a card saying SHOT DOWN BY &lt;callsign&gt; and a 5-second
countdown — good. But I don't know *how*. Missile or guns? From where? Did I miss an RWR tone? A
three-second kill cam from the killer's perspective would answer this and would be the thing we
talk about afterwards.

*"Which plane should I take?"* I have ten and I can't tell them apart. Every card says Max G 9.0.
I default to whatever I flew last time. Tell me the F-22 accelerates and is nearly invisible on
radar, the MiG-29 turns hard but runs out of fuel and flares, the F-15C has reach.

*"Where is everyone?"* After a respawn I'm at 5000 m on a random heading. Solo, AWACS calls out
bandits and radar finds them. In multiplayer there is nothing telling me where the fight is. On a
300 km map that is a lot of empty sky. *(The ±3 km respawn scatter around the origin does keep
players clustered — this is more about **knowing** where they are than **being** near them.)*

*"I want to fly with my friend, not at him."* Right now every player is hostile to every other
player. My friend and I cannot be a two-ship.

*"There's a lot of keyboard."* Radar is on four keys (`R`/`T`/`L`/`U`), the targeting pod on
three (`P`/`O`/`K`), wingmen on four (`1`–`4`), MFDs on two. I use maybe five of those thirteen in
a dogfight. I can't rebind any of them, and there's no sensitivity or curve setting for the stick.

---

## 10. GAME DESIGN RECOMMENDATIONS

### What decision is the player making every 5–20 seconds?

Solo, in Head-On BVR, the answer is genuinely good: *Do I take the AMRAAM shot at Rmax or crank
for a better Rne shot? Do I go cold when the RWR chirps launch, or trust the notch? Do I extend
after the merge or turn back in?* The DLZ, the staged shoot cue and the missile TTI panel all
exist to support exactly those decisions. That is well-designed combat.

In a LAN dogfight, the decision loop degrades to: *fly toward the nearest contact, shoot the
missile, dodge his missile, guns, respawn.* Not because the mechanics changed — they didn't — but
because there is no reason to prefer one enemy over another, no reason to disengage, no reason to
survive, and no reason to be anywhere in particular.

**The fix is not more mechanics. It is stakes.** The same missile fight becomes interesting the
moment (a) some of the aircraft are on your side, (b) the score matters, and (c) the match ends.

### Combat pacing

Estimated single-player session breakdown for Head-On BVR: ~15 s menus, ~30 s closing to the
merge, ~90–150 s of engaged combat, ~10 s debrief, then back through two menu screens. That is a
*good* ratio — roughly 70% interesting. Protect it.

Multiplayer is harder to estimate without a live session *(needs playtest)*, but the structure
suggests: 5 s respawn (good — better than most games in this genre), then an unbounded search
phase with no direction. The 5 s is right. The search is the risk.

### Engagement ranges

Missile ranges are 26 km (AIM-9X) to 50 km (AIM-120B), and the F-22 can carry nine stores. AI
BVR bandits spawn at 15–25 km. This is a wide envelope, and it is fine for the PvE scenarios,
which are *designed* around a BVR approach then a merge.

For PvP with friends it is probably too wide *(needs playtest)*. With nine AMRAAMs and a 50 km
missile, four players in a 300 km box will mostly kill each other before they see each other, and
BVR-only combat between humans is far less fun than a merge. **Recommend: constrain PvP loadouts
to a smaller number of stores (see R12) and consider a mode-level cap on ARH missiles** — the
"Dogfight" mode should mean dogfight. Do not nerf the missiles themselves; the PvE scenarios need
them.

### Skill expression, and where it currently comes from

Ranked by how much of the outcome each one determines today:

1. **Energy management** — strong. The aero tables and the post-stall gate make this real.
2. **Missile defence** — strong. Flare irradiance scoring plus chaff RCS decay make timing matter.
3. **Lead aiming** — strong. The funnel gives you the information but not the shot.
4. **Missile timing** — good. The DLZ and staged shoot cue support it.
5. **Situational awareness** — **weak, and it's a camera problem, not a systems problem.**
6. **Team coordination** — **absent.**

Items 5 and 6 are where design work should go. Items 1–4 are done.

### Counters — the rock/paper/scissors that already exists

There is a real counter structure in the sim that no player is told about:

- IR missile ← flares, aspect (a tail-on target is 4× the signature of head-on), throttle
  (`0.5 + throttle*0.5` on the signature).
- ARH missile ← chaff, notching, and terminal-activation range (10 km for the AIM-120B — inside
  that it's pitbull and doesn't care about your radar).
- Guns ← energy and geometry.
- Radar detection ← RCS (0.05 m² Raptor vs 14 m² Fulcrum beam aspect — a 250× spread).

**Every one of those counters is implemented and none of them is surfaced.** Making them legible
is a design task, not an engineering one, and it is the highest-leverage depth work available:
it adds no complexity, it just reveals complexity that is already paid for.

### Victory conditions

Recommend exactly two, both simple:

- **Team Deathmatch** — first team to N kills (default 25 for a 2v2, scale with players), or a
  time limit with the higher score winning. Match ends, board shows, REMATCH.
- **Co-op Intercept** — successive waves of AI bandits; the team survives or doesn't; the score
  is waves cleared.

Resist adding a third until both are polished.

---

## 11. PRODUCT OWNER RECOMMENDATIONS

### Where the development effort should go, and where it should not

The project has a strong bias — visible throughout the source — toward *simulation depth per
system*. That bias produced the flight model, the seeker model and the damage model, all of which
are assets. Applied to the next phase it would produce more airframes, more weapons and more
avionics, and **none of those would change whether friends play a second match.**

**The highest-ROI work available is not simulation. It is structure and legibility.**

| Investment | Player-facing hours affected | Effort | Verdict |
|---|---|---|---|
| Teams + match rules + rematch | **100% of multiplayer** | Medium | **Do first** |
| Hit/kill confirmation | 100% of combat | Tiny | **Do first** |
| Aircraft identity in the UI | Every launch | Small | **Do first** |
| Camera (padlock, look-back) | 100% of combat | Small | **Do first** |
| Co-op PvE mode | The most likely session shape | Medium | **Do second** |
| AI difficulty tiers | All PvE | Small | **Do second** |
| Controls rebinding + curves | Every session, every player | Medium | **Do second** |
| More airframes (11th, 12th) | Marginal | Medium | **Defer** |
| More weapon variants | Marginal | Small | **Defer** |
| Rearm/refuel logistics | Rare | Medium | **Defer** |
| Clickable cockpit systems | ~0% of dogfight time | Large | **Reject** |
| Progression / unlocks | Negative for a friend group | Medium | **Reject** |

### Playtest feedback quality

A specific product argument for doing match structure first: **you cannot get useful playtest
feedback from an unstructured session.** Without a match end there is no natural moment for
players to compare notes, no score to argue about, and no obvious point at which to ask "want to
change something and go again?" Adding a match-end board converts every session into a feedback
event. That makes it a *tooling* investment as much as a gameplay one.

### Maintenance risk

Teams touch `EntityManager.getEnemies()`, the radar's trackable set, the missile system's target
resolution, the AWACS classification, the HUD's target designator, and the network protocol
(a `team` field on `NetPlayerProfile`). That is a wide but shallow change — it is a filter applied
in several places, not a new system. Scope it as one piece of work and do it once; retrofitting
teams later, after more systems consume `getEnemies()`, will cost more.

---

## 12. IDEAL CORE COMBAT LOOP

Consistent with what is already built. Times are targets, not guarantees.

**Detection (0–20 s).** Spawn airborne at ~5000 m with the team already in a loose formation.
The datalink picture shows friendlies as blue and known hostiles as red; AWACS gives one BRA call
on the nearest hostile group. The player's radar sweeps and paints contacts. *Decision: which
group do we take, and do we go high or low?*

*Existing:* AWACS BRA callouts, radar RWS→TWS auto-promotion, the threat display.
*Missing:* friendly rendering, team datalink.

**Approach (20–60 s).** Closure builds. RWR chirps as a hostile radar sweeps you. The DLZ opens.
*Decision: shoot at Rmax and go defensive, or crank to Rne for a shot he can't defeat? Am I
supporting my wingman's shot or taking my own?*

*Existing:* full DLZ, staged shoot cue, RWR search/track/lock tones.
*Missing:* knowing which contact your teammate is targeting.

**Attack (2–15 s).** Launch. The missile flies APN with mid-course datalink; at 10 km the AIM-120
goes pitbull and the target's RWR screams. *Decision: support the missile or turn cold now?*

*Existing:* all of it, including the PITBULL audio cue.

**Defence (5–20 s).** Inbound launch warning, threat bearing on the RWR, the TTI panel counting
down. *Decision: chaff and notch, or flare and dive for terrain? Do I have the energy to do both?*

*Existing:* all of it, and it's the best-modelled part of the game.
*Missing:* flare and chaff on separate keys, so this decision is actually a decision.

**Merge / guns (10–60 s).** If both survive, the fight collapses inside 5 km. Energy fighting,
nose position, the gun funnel. *Decision: one-circle or two-circle? Take the high-angle snapshot
or preserve energy?*

*Existing:* the funnel, the FCS post-stall gate, real energy bleed.
*Missing:* a camera that can follow the bandit through this.

**Kill / disengage (1–5 s).** Hit marker on each connecting round, a distinct kill confirmation,
a kill-feed line, and the aircraft comes apart with an explosion. *Decision: chase the next
contact or reset with your teammate?*

*Missing:* the hit marker and the kill confirmation. This is the tiny fix with the largest
per-second impact.

**Recovery (0–30 s).** Alive: damaged, and now the six-zone damage model earns its keep — one
wing degraded, thrust down, fuel leaking. *Decision: keep fighting, or run?* Dead: 5-second card
naming the killer, standings visible, a short kill cam, then airborne again near the fight.

*Existing:* the damage model, the respawn card, the standings.
*Missing:* kill cam; a reason to prefer surviving.

**Re-engagement (0–20 s).** Back in, team picture visible, nearest fight indicated. Never more
than ~20 seconds of empty sky.

---

## 13. IDEAL FRIENDS MULTIPLAYER FLOW

The current flow, with friction marked:

```
Launch app
  → Mission Select   [default is Free Flight — no enemies]
  → CONTINUE TO LOADOUT
  → Loadout screen   [aircraft, 9 hardpoint dropdowns, environment, settings,
                      flight options, LAN host/join, full controls reference]
      ! host/join is ~two thirds down an *aircraft* screen
      ! each player must independently have chosen Dogfight
      ! the "this is a single-player mission" warning appears only after connecting
  → LAUNCH MISSION   [each player launches independently, whenever]
  → Fight
  → ...nothing ends...
  → someone opens Esc → ABORT TO DEBRIEF → their own personal debrief
  → RETURN TO LOBBY  [good: the lobby survives]
```

The target flow:

```
Launch app
  → MULTIPLAYER / SINGLE PLAYER          [one clear fork, first screen]
  → Host: pick mode (Team DM / Co-op Intercept), score limit, time limit → CREATE
    Join: enter IP → JOIN
  → Lobby: roster with teams, callsigns, aircraft
      - click to swap team; AUTO-BALANCE button for the host
      - pick aircraft + loadout preset inline
      - READY toggle per player
      - host presses START when everyone is ready (or force-starts)
  → All players spawn together, on their teams
  → Match runs to the score or time limit
  → MATCH END: winning team, final board, MVP, per-player K/D and missile Pk
      - REMATCH (same teams)          → straight back to the lobby, ready-checked
      - SHUFFLE TEAMS + REMATCH
      - CHANGE MODE                    → back to lobby settings
      - LEAVE
```

Friction removed: the mission/loadout ordering (mode is a lobby setting, not a per-player
choice), the buried host/join, the after-the-fact warning, the uncoordinated launch, and the
missing rematch. What is kept: the lobby-preserving debrief flow, which already works and is the
foundation the rematch button sits on.

**Design note:** the host's environment lock is already implemented and correct (time of day and
weather are forced to the scenario's values in a lobby because they are not replicated). Extend
the same principle — the host owns the *rules*, players own their *aircraft*.

---

## 14. IDEAL HUD / COMBAT INFORMATION

The HUD is already rich — the risk here is addition, not omission. The correct move is
**hierarchy and gating**, not more elements.

### Essential — always visible, largest, highest contrast

- Speed, altitude, heading, flight-path marker
- Selected weapon + remaining count
- Target designator box + range + closure when locked
- **Missile launch warning + threat bearing** — should be the most attention-grabbing thing on
  screen, above everything else
- Aircraft damage state — a compact silhouette, not a list of zone percentages
- Team score (multiplayer)

### Helpful — visible, but subordinate

- G, Mach, fuel
- DLZ / launch envelope (only when a missile is selected and a target is locked)
- Gun funnel (only in guns mode)
- Missile time-to-impact panel (only when missiles are in the air)
- Kill feed
- RWR / threat display
- Countermeasure counts

### Optional / advanced — off by default, or in the MFDs only

- Radar mode string, scan bar geometry
- Targeting-pod FLIR
- Detailed per-zone damage percentages
- The debug overlay (already F12-gated — correct)

### Specific HUD issues found

1. **Damage readout placement.** The airframe damage block sits upper-left under the wingman
   badge. Damage is one of the most decision-relevant pieces of information in the game (it
   determines whether you fight or run) and it is currently a text block in a corner. A small
   aircraft silhouette with reddening zones would read at a glance.

2. **Kill feed vs FLIR collision.** The kill feed was already moved below the FLIR overlay's
   maximum extent to avoid being painted over — a good catch, but a symptom of the top-right
   being contested. Worth a deliberate layout pass now rather than more ad-hoc dodging.

3. **Two shoot cues.** There is a staged shoot cue under the target box *and* a SHOOT audio
   callout *and* a LAR bar. That's three representations of one fact. Not wrong, but check in
   playtest that it reads as one signal, not three competing ones.

4. **Nothing tells you your team.** Obviously blocked on teams existing.

5. **HUD repaints at ~30 Hz** (`MIN_DRAW_INTERVAL_MS`). Sensible for a canvas overlay; verify in
   playtest that the gun funnel and the pipper don't feel laggy relative to the 60 Hz sim, since
   those are the two elements where latency is directly felt *(needs playtest)*.

---

## 15. IDEAL CONTROLS / CAMERA EXPERIENCE

### Controls

The target audience is friends on whatever hardware they own — mostly keyboard, some gamepad,
occasionally a stick. Today: keyboard bindings are fixed (`DEFAULT_BINDINGS`, no rebinding UI),
gamepad mapping is fixed, there is no sensitivity, deadzone or response-curve setting, and there
is no mouse-flight option. `invertPitch` is the only input preference exposed.

The stated bar — *"can a new player configure the game without searching source files or Discord
messages?"* — is not currently met. What it needs:

- **A rebinding screen.** The mapping layer exists (`ControlMapping.ts`); it needs a UI.
- **Sensitivity + response curve + deadzone**, per axis, for both keyboard ramp rate and gamepad.
  Gamepad flying without a configurable curve is the single most common reason a controller
  player concludes a flight game "feels bad."
- **A mouse-flight option** (mouse position drives a virtual stick). This is how a large share of
  the target audience expects to fly an accessible combat flight game, and it is the lowest-effort
  way to make the first ten minutes feel good for a newcomer.
- **Preset profiles** — "Keyboard", "Gamepad", "Stick" — so nobody has to build a map from zero.
- **Fold the rarely-used bindings away.** Thirteen keys across radar, targeting pod and wingmen,
  of which a dogfight uses about five. See the simplification appendix.

Keep: the controls reference already shown on the loadout screen *and* in the pause menu. That is
a genuinely good decision and should survive any redesign.

### Camera

Today: `COCKPIT` ⇄ `EXTERNAL` on Tab, right-drag freelook in both, and the cockpit head eases
back to boresight on release. That easing is a nice touch. The rest is not enough for a dogfight.

Target:

- **Hold-to-look-back** on a single key/bumper. Snaps 180°, returns on release. Cheapest large
  win in the whole camera section.
- **Target padlock** — hold or toggle to keep the locked bandit centred while the aircraft keeps
  flying. This is *the* answer to "I lost him."
- **Smooth recentre** on release (already the pattern in `CockpitCamera` — extend it).
- **Death cam / kill cam** — 3 seconds on the killer, or on your own wreck. Generates the stories.
- **Wider default cockpit FOV or an FOV slider.** 75–80° is realistic and restrictive; the target
  audience will be happier with a configurable default nearer 90°.
- **Restrained camera shake** — on gun fire, missile launch, and taking damage, scaled by
  severity. Enough to sell impact; not enough to hurt aiming.

Do **not** add: cinematic missile-cam by default (it takes control away at the worst moment —
optional replay-only), or a free orbit camera in multiplayer (it becomes a wallhack).

---

## 16. GAME MODE RECOMMENDATIONS

**Recommend exactly two. Polish both. Add nothing else until both are proven.**

### 1. Team Deathmatch — the primary PvP mode *(build first)*

Two teams, air spawns, first to N kills or highest score at the time limit. Friendly fire off.
Shared team datalink. 5-second respawn (already built). Match-end board with MVP and rematch.

*Why this one:* it is the smallest possible addition to what already exists — the FFA dogfight
plus teams plus an end condition — and it converts the existing combat, which is good, into a
session, which is what is missing. It also scales gracefully from 1v1 to 4v4.

### 2. Co-op Intercept — the primary PvE mode *(build second)*

All human players on one team against successive AI waves. Wave 1: two bandits. Wave 3: four,
mixed types. Wave 5: an ace with better decision-making. Team survives or wipes; score is waves
cleared, and it persists to the logbook.

*Why this one:* it is the mode a group of three friends on a Tuesday will actually launch. It
reuses the AI behaviours, the scenario spawner and the wingman commands that already exist. It
scales *down* to one player without becoming a different mode. And it creates a shared adversary,
which is what makes a friend group feel like a squadron.

### Explicitly not recommended yet

- **Free-for-all** — keep it as a lobby option since it already works, but don't develop it. FFA
  between friends is worse than teams at every player count above two.
- **Capture zones / air superiority** — needs map design work the project hasn't done, and the
  fights it creates aren't better than TDM's.
- **Escort / strike / intercept-as-PvP** — asymmetric modes need balance passes that a small
  friend group won't provide enough data for.
- **Elimination / no-respawn** — punishing downtime is wrong for this audience. The 5-second
  respawn is one of the build's best decisions; don't undo it.

The Strike Package and Traffic Pattern scenarios should stay as *single-player scenarios*, not
be promoted to modes. They are good at what they are.

---

## 17. AIRCRAFT / LOADOUT DESIGN RECOMMENDATIONS

### Aircraft identity: the data is there, surface it

Ten airframes are already differentiated in ways that would produce real playstyle differences.
Sampling two:

| | F-22A Raptor | MiG-29A Fulcrum |
|---|---|---|
| Thrust (dry / AB) | 208 / 312 kN | 98.8 / 162.8 kN |
| Empty mass | 19 700 kg | 10 900 kg |
| Fuel | 8 200 kg | 3 500 kg |
| Wing area | 78.0 m² | 38.1 m² |
| Head-on RCS | **0.05 m²** | **5.0 m²** |
| Beam RCS | 0.15 m² | 14.0 m² |
| Flares / chaff | 96 / 96 | 60 / 60 |
| Thrust vectoring | pitch | none |
| Hardpoints | 9 | 6 |

That is *not* the same aircraft twice. The Raptor is a high-energy, low-observable missile
platform that sees you first; the Fulcrum is a light, short-legged knife-fighter that has to get
close and can't afford a long defensive engagement. **Both of those identities are already
simulated. Neither is communicated.**

**Recommendation (Small effort, High value):** replace the selection card's three numbers with

- a **role tag** — *Air Superiority · Stealth Interceptor · Multirole · Knife-fighter · Heavy
  Interceptor · Strike*
- **five comparative bars**, computed from the specs, not hand-authored: **Acceleration**
  (thrust/mass), **Turn** (a sustained-rate proxy — `turnPerformance.ts` already exists),
  **Reach** (fuel + hardpoint count), **Stealth** (inverse RCS), **Survivability** (countermeasure
  count)
- **one sentence** of plain-language character: *"Sees you before you see it. Punishing to fight
  head-on, expensive to turn with."*

Computed bars mean the card stays honest if the specs are ever retuned.

Do **not** add more airframes. Ten is already more than the friend group will explore, and each
one costs an exterior model and a cockpit.

### Loadouts

Nine per-hardpoint dropdowns is a *configuration screen*, not a *decision*. And with each pylon
holding one missile, an F-22 can carry nine — which for PvP means the answer is almost always
"fill everything," so it isn't a choice at all.

**Recommendation (Small effort, Medium value):** three presets above the existing dropdowns —

- **Dogfight** — heavy IR, minimal ARH, light. Best acceleration and turn.
- **Balanced** — mixed.
- **BVR** — heavy ARH. Heavier, worse energy.

Keep the per-pylon dropdowns underneath for anyone who wants them. The presets should be visibly
different in *weight*, so choosing BVR genuinely costs you turn performance — the drag and mass
penalties are already modelled (`getStoreDragPenalty`, per-store `massKg`), so this trade-off is
free to expose. That converts loadout from configuration into a real pre-match decision.

**Also recommend:** a mode-level cap on ARH missiles in Dogfight (e.g. two), so the mode delivers
what its name promises. Do not change the missiles themselves.

---

## 18. PvE / PvP BALANCE

Recommended split of effort, based on what exists and on realistic friend-group player counts:

- **PvP (Team Deathmatch): 45%.** It is the headline mode, it is closest to done, and it is what
  gets scheduled.
- **Co-op PvE (Intercept): 40%.** It is what actually gets *played* when only two or three people
  show up — which, for a friend group, is most nights. A 2-player TDM is a duel; a 2-player co-op
  intercept is a mission. It also reuses the strongest existing asset (the AI and scenario system)
  and it degrades gracefully to solo.
- **Solo practice: 15%.** Free Flight and Traffic Pattern already cover this well. The remaining
  work is an AI difficulty setting and a short guided first flight, not new content.

The specific unlock required for the PvE half: **allow AI to spawn in LAN sessions.** Today it is
suppressed outright, which is why co-op is impossible. AI is currently spawned independently and
unreplicated on each client — so the co-op mode needs the *host* to own AI spawning and
replicate it, the same way remote players already are. That is the real cost of this item, and
it's the reason it's ranked second rather than first. It is a bounded piece of work: AI aircraft
would flow through the existing `NetworkAircraft` interpolation path.

---

## 19. FEATURES TO DEFER

Attractive, defensible ideas that should **not** be built yet — with the reason.

| Feature | Why defer |
|---|---|
| **Rearm / refuel on landing** | The tension is real, but it competes directly with the 5-second respawn, which is the correct pacing choice for this audience. Revisit only if a mode is added where surviving matters more than re-engaging. Note the machinery is one call away (`reloadWeapons()` exists and is debug-bound). |
| **More airframes (11th, 12th…)** | Ten is already unexplored. Each costs an exterior plus a cockpit. Zero replayability gain until aircraft identity is legible (§17). |
| **More weapon variants** | Four A/A missiles across two nations is the right number. More variants dilute the counter structure rather than deepening it. |
| **Ground-attack expansion (SEAD, CAS, more ground targets)** | The bomb and AGM systems work, but ground attack is a small share of playtime and doesn't create the fights the audience wants. Strike Package is enough. |
| **Dynamic weather / time of day in multiplayer** | Correctly locked today because neither is replicated. Replicating them is real work for an aesthetic gain. |
| **Voice comms** | Friends are in Discord. Building this is pure waste. |
| **Map variety / second theatre** | The 300 km procedural terrain plus one airbase is sufficient for air combat. Map variety matters far less than mode variety here. |
| **Replay system** | Genuinely fun for a friend group, but it needs deterministic playback or full state recording. Revisit after the kill cam, which delivers most of the same social value for a fraction of the cost. |
| **VR** | Large effort, tiny audience share, and it would constrain every future HUD decision. |
| **Spectator mode** | Only worth it once matches end and players are waiting between them. |

---

## 20. FEATURES TO REJECT

Ideas that would push the project away from its strongest identity or produce poor ROI.

| Feature | Why reject |
|---|---|
| **Progression / unlockable aircraft or weapons** | For a private friend group this is strictly negative: it gates content behind grind that everyone already owns, and it makes the newest player the weakest for reasons unrelated to skill. Keep the logbook and career stats — those are the *good* version of this. |
| **Clickable / fully interactive cockpits, startup procedures** | Very large effort against ~0% of dogfight playtime, and it would actively repel the target audience. The cockpits should stay visual and animated, which they already are. |
| **Realism settings menu (multiple fidelity tiers)** | Doubles the balance surface and forces every future decision to be made twice. The current two switches — G-LOC and auto-rudder — are exactly the right amount. |
| **Matchmaking / lobby browser / accounts** | The game is IP-and-port for friends. This is correct. Anything more is infrastructure with no players behind it. |
| **More than three game modes** | Every additional mode splits an already-small player pool and multiplies balance work. Two polished modes beat five thin ones. |
| **Persistent world / MMO / open-world** | Nothing in the implementation points this way and it would abandon the tight session loop that is the project's actual strength. |
| **Complex logistics (fuel planning, ordnance supply, base capture)** | Depth in a place players don't spend time. |
| **Making the AI harder via physics bonuses** | Aim quality, reaction time and decision speed only. An AI that turns better than the airframe allows is the fastest way to make players feel cheated. |

---

## 21. PRODUCT ROADMAP

### NOW — *"make multiplayer a game"*

Everything here is either tiny, or on the critical path to a session that ends.

1. **Hit + kill confirmation** (Tiny) — marker and sound on outgoing hits; kill feed for AI kills.
2. **Radar simplification** (Tiny) — A/A ⇄ A/G toggle, OFF off the cycle, one lock key.
3. **Separate flare and chaff keys** (Tiny) — makes missile defence a decision.
4. **Mission Select defaults to a fight** (Tiny) — and move the LAN warning before connection.
5. **Aircraft identity card** (Small) — role tag, five computed bars, one sentence.
6. **Look-back + target padlock camera** (Small).
7. **Loadout presets** (Small) — Dogfight / Balanced / BVR, with real weight differences.
8. **Teams** (Medium) — `team` on the player profile, friendly-fire off, friendly/hostile IFF
   everywhere (radar trackable set, missile targeting, AWACS, HUD designator, kill feed colours),
   blue/red markers.
9. **Match structure** (Medium) — score limit and/or timer, match-end board with winner + MVP +
   per-player stats, **REMATCH**.
10. **Host-driven lobby** (Medium) — host owns mode and rules; ready-up; synchronised start.

*Outcome: four friends can host, pick sides, fight a match that ends, look at a board, and press
REMATCH. That is the whole point of this stage.*

### NEXT — *"make it worth a second evening"*

11. **Co-op Intercept mode** (Medium-Large) — host-authoritative AI replicated to clients.
12. **AI difficulty tiers** (Small) — aim error, reaction delay, decision quality, missile
    discipline. Never physics bonuses.
13. **Controls: rebinding, sensitivity, curves, deadzones, presets, mouse-flight** (Medium).
14. **Kill cam / death cam** (Medium).
15. **Team pings** (Small) — one key: ping the target under the cursor, visible to your team.
16. **Guided first flight** (Small) — 60–90 seconds, in-air, one bandit, teaching lock → shoot →
    defend. Not a campaign.
17. **HUD hierarchy pass** (Small) — damage silhouette, launch-warning priority, layout pass on
    the contested top-right.

### LATER — *"only if playtests ask for it"*

18. Spectator mode (needs match-end waiting to exist first).
19. Rearm zones (only if a mode makes survival matter).
20. A third mode, chosen from what playtests reveal.
21. Replay / track recording.
22. Additional airframes.

**Roadmap discipline:** if a NOW item slips, cut a NEXT item rather than adding to NOW. The NOW
list is already the minimum viable *game*.

---

## 22. IDEAL VERSION OF THE GAME

Four friends open FSim on a weeknight. One hosts, picks **Team Deathmatch**, 25 kills, and the
others join by IP in about fifteen seconds. In the lobby they see each other's callsigns and
aircraft; two click over to red. One takes the Raptor because the card says it accelerates and
sees first; another takes the Fulcrum because it says it turns hard and can't run far — and both
of those turn out to be true in the air. Everyone readies. The host starts.

They spawn as two-ships at 5000 m. The datalink shows a friend in blue off the left wing and two
red contacts at 30 km. There's a BRA call, an AMRAAM goes off the rail, an RWR chirps, someone
chaffs and notches and the missile goes stupid — and the fight collapses into a merge where the
gun funnel, the post-stall gate and thirty seconds of hard energy management decide it. Landing a
burst thumps. A kill is unmistakable. Dying shows who did it and a three-second replay of the
shot, then puts the pilot back in the air five seconds later, near the fight, with a full jet.
Somebody limps home on one wing at 40% thrust and everybody watches. Someone gets a mid-air on the
merge and nobody lets them forget it.

Twelve minutes later the score hits 25. A board shows the winning side, the MVP, everyone's
missile Pk and gun accuracy. Someone says "that AMRAAM shot was luck." Someone presses **REMATCH**
and they're back in the lobby with teams shuffled, arguing about aircraft, twenty seconds from
the next fight. An hour later they've played five matches and one co-op intercept that they
nearly lost on wave four, and the thing they're still talking about is the moment someone dodged
a missile at 200 feet in a valley.

**None of that requires a better flight model, more aircraft, or more systems.** Every mechanic
in that paragraph except teams, the match end, the kill cam and the hit marker is already in the
build today. That is the encouraging finding of this audit: the expensive half is done.

---

## 23. ONE-MINUTE FUN TEST

> *Can a player launch the game and experience something fun or interesting within one minute?*

**Solo: marginally yes. Multiplayer: no.**

Solo path today: app opens on Mission Select with **Free Flight** highlighted → CONTINUE TO
LOADOUT → a long scrolling screen (aircraft grid, up to 9 hardpoint dropdowns, environment,
settings, flight options, LAN section, full controls reference) → LAUNCH MISSION → airborne at
5000 m. Reachable in roughly 20–30 seconds of clicking. But if the player accepts the highlighted
default they arrive in **empty skies with nothing to shoot**, and the first interesting thing
requires them to know to go back and pick a different mission.

**What blocks the one-minute test:**

1. **The default is Free Flight.** `MissionSelectScreen` highlights `SCENARIO_CATALOG[1]`
   (`FREE_FLIGHT`) while `App` declares `DEFAULT_SCENARIO = HEAD_ON_BVR`. They disagree, and the
   one the player sees is the one with no enemies. **Fix: default to a fight.** (Tiny.)
2. **The loadout screen is a wall.** Six sections and a full controls table between the player and
   the launch button. **Fix: collapse Environment / Flight Options / Controls behind a "More"
   disclosure; loadout presets replace the dropdown stack.** (Small.)
3. **Multiplayer can't clear the bar at all** — host or join is buried mid-screen, every player
   must independently have chosen the Dogfight scenario, and there's no synchronised start.
   **Fix: the host-driven lobby (NOW #10).**
4. **No control hints in the air.** A first-time player is airborne with no idea which key fires.
   The controls reference is on the previous screen and in the pause menu, but not in the first
   flight. **Fix: a dismissible corner card for the first 30 seconds — throttle, fire, lock,
   flares, camera.** (Tiny.)

With fixes 1, 2 and 4, the solo one-minute test passes comfortably: menu → fight → first missile
shot inside 60 seconds.

---

## 24. FIVE-MINUTE COMBAT TEST

The ideal first five minutes of a Team Deathmatch, with the friction each beat currently hits.

| Time | Beat | What should happen | Friction today |
|---|---|---|---|
| 0:00 | **Spawn** | Airborne, 5000 m, wingman visible in blue off the wing, team score at top | No teams, no friendly rendering |
| 0:10 | **Orient** | Datalink shows two red contacts at 30 km; one AWACS BRA call | AWACS exists solo; MP has no picture |
| 0:25 | **Locate** | Radar sweeps, contact promotes RWS→TWS, cursor onto the nearest bandit | **Works today** |
| 0:45 | **First engagement** | Closure builds, DLZ opens, RWR chirps as he sweeps you | **Works today** |
| 1:00 | **Fire** | AMRAAM off the rail, mid-course datalink, PITBULL at 10 km | **Works today** |
| 1:15 | **Defend** | Launch warning, threat bearing, TTI countdown; chaff + notch | **Works today**, but flare/chaff share one key |
| 1:40 | **Merge** | Inside 5 km, guns, energy fight, funnel converging | **Works — but the camera can't follow him** |
| 2:10 | **Kill** | Hit markers on each burst, distinct kill confirmation, kill feed, explosion | **Missing: outgoing hit + kill confirmation** |
| 2:15 | **Reset** | Rejoin your wingman, look for the next fight | No teams; no direction to the fight |
| 3:00 | **Die** | Card names the killer, 3 s kill cam, standings visible, 5 s countdown | Card and standings exist; **no kill cam** |
| 3:10 | **Respawn** | Fresh jet, full stores, near the fight | **Works today** (±3 km of origin, 5000 m) |
| 3:20–5:00 | **Second engagement** | Another fight inside ~20 s | No fight direction — could be empty sky |

**Reading:** the *middle* of that table — detect, approach, shoot, defend, merge — is already
excellent and needs nothing. The failures cluster at the **edges**: the first fifteen seconds
(no team, no picture) and the moment of resolution (no hit confirmation, no kill cam, no reason
to be anywhere). That is a very good position to be in, because edges are cheap to fix and
middles are not.

---

## 25. THIRTY-MINUTE FRIEND SESSION TEST

What a strong 30-minute session should look like, and what the current build would actually
deliver.

### Target session

| Phase | Duration | Content |
|---|---|---|
| Setup | 0:00–0:01 | Host creates, three join by IP, teams picked, ready, start |
| Match 1 — TDM | 0:01–0:13 | ~12 min, ~8–12 engagements each, 5–8 deaths each |
| Match end | 0:13–0:14 | Board, MVP, argument, shuffle teams, REMATCH |
| Match 2 — TDM | 0:14–0:25 | Different aircraft, different sides, ~11 min |
| Match end | 0:25–0:26 | Board, "one more?" |
| Match 3 — Co-op | 0:26–0:30+ | Everyone vs waves; nearly wipes on wave 4 |

Target ratios: **~85% in the air**, ~8% in menus, ~7% dead. Roughly **20–30 engagements per
player** across the session. Setup is under a minute; between-match dead time is under a minute.

### Memorable moments the session should generate

The build is already capable of most of these, which is worth noting explicitly:

- A missile dodged at 200 feet in a valley (terrain + flares + TTI panel — all exist)
- Somebody limping home with one wing shredded and 40% thrust (six-zone damage model — exists)
- A guns kill after a 40-second scissors (post-stall gate + funnel — exist)
- A mid-air on a head-on merge (collision exists)
- A cobra that makes a pursuer overshoot (post-stall gate — exists)
- The last kill of a match landing on the score limit (**needs match structure**)
- A kill cam replaying a shot nobody believed (**needs kill cam**)

### What the current build delivers instead

Setup takes several minutes of coordination ("did you pick Dogfight?"). The session is one
unbounded FFA with no teams and no score to reach. Every player is hostile to every other. Kills
are unconfirmed to the shooter. Nothing ends, so there is no rematch, no shuffle, no board, and no
natural stopping point — the session ends when someone gets bored, which is the worst possible
exit condition for a game you want people to return to.

**The replayability gap is not content. It is closure.** A session needs to *end* to be worth
repeating, and the score already exists on the server — it is simply never compared to anything.

---

# RECOMMENDATION DETAIL

Full detail for the highest-priority items. Ordered as in §21.

---

### R1 — Outgoing Hit & Kill Confirmation

**Perspective:** Player / Designer
**Player Value:** High · **Frequency:** Core · **Effort:** Tiny · **Complexity Risk:** Low ·
**Replayability Impact:** Medium · **Priority:** NOW · **Category:** Add

**Player Problem.** You feel every hit you *take* — a red edge vignette scaled by severity, plus a
`HIT` sound. You feel nothing at all when you *land* one. `setOnTargetHit` fires on every gun
round and missile impact, and it feeds sortie stats and the network replication — but the local
HUD is never told. Killing an AI increments `killCount` in silence.

**Example Scenario.** A two-second burst at 800 m. Tracers converge on the bandit. Nothing
happens on your screen. You keep firing because you can't tell whether you're connecting, waste
half your ammunition, and only learn you hit when the target starts trailing smoke.

**Recommended Experience.** Every connecting round produces a small, brief hit marker on the
pipper and a short click, pitched or weighted by severity. A missile impact produces a heavier
version. A kill produces something unmistakable — a distinct sound, a brief "SPLASH" style
callout, and a kill-feed line **for AI kills as well as player kills**.

**Why It Matters.** This is the single highest value-per-hour item in the document. Combat
feedback is 100% of combat time, and the asymmetry — being shot feels stronger than shooting —
makes the player's own weapons feel weaker than they are modelled to be.

**Risks.** Over-tuning: a loud marker on every 20 mm round at 6000 rpm becomes noise. Keep the gun
marker small and let volume scale sub-linearly with rate of fire.

---

### R2 — Radar & Countermeasure Control Simplification

**Perspective:** Player / Product
**Player Value:** Medium-High · **Frequency:** Core · **Effort:** Tiny · **Complexity Risk:** Low ·
**Replayability Impact:** Low · **Priority:** NOW · **Category:** Simplify

**Player Problem.** `R` cycles `OFF → RWS → TWS → STT → GMTI → OFF`. Mid-fight, one extra press
turns your radar **off**; another puts you in a ground-mapping mode that drops every aircraft
track. Recovering takes two more presses and several seconds. Separately, `Z` dispenses flares
**and** chaff together, so defending an IR missile burns the chaff you need for the radar one.

**Example Scenario.** Bandit at 8 km. You press `R` to promote to STT, overshoot by one, and your
radar is in GMTI with no aircraft tracks. By the time you've cycled back you've been locked.

**Recommended Experience.** One key toggles **Air ⇄ Ground** search. One key locks/unlocks the
designated target. `OFF` moves to the MFD, where nobody presses it by accident. Flares on one key,
chaff on another — so "which missile is this?" becomes a real decision that the excellent
underlying seeker model can finally reward.

**Why It Matters.** Removes a trap that punishes the player for something that isn't a skill, and
converts countermeasures from one button into the decision the simulation already supports.

**Risks.** None material. Keep the old bindings as aliases for anyone used to them.

---

### R3 — Aircraft Identity on the Selection Card

**Perspective:** Player / Designer / Product
**Player Value:** High · **Frequency:** Frequent (every launch) · **Effort:** Small ·
**Complexity Risk:** Low · **Replayability Impact:** High · **Priority:** NOW ·
**Category:** Improve

**Player Problem.** Ten airframes, and the card shows Nation / Max G / Max AoA — values that are
9.0 and 26–28° across nearly the whole roster. The player cannot tell the aircraft apart, so they
fly whatever they flew last time, and nine tenths of the roster never gets used.

**Example Scenario.** A friend picks the Su-57 because the name sounds good, gets outrun by an
F-22, and has no idea whether that was the aircraft or the pilot. They learn nothing and pick
randomly again next match.

**Recommended Experience.** The card shows a role tag (*Stealth Interceptor*, *Knife-fighter*,
*Heavy Interceptor*…), five bars computed from the specs — Acceleration, Turn, Reach, Stealth,
Survivability — and one sentence of character. Choosing an aircraft becomes choosing how you
intend to fight, and the aircraft then behaves the way the card promised, because the bars are
derived from the same numbers the sim uses.

**Why It Matters.** This is the cheapest replayability multiplier available. It converts a
cosmetic roster into ten playstyles using data that is already in the build, and it gives the
friend group something to argue about between matches.

**Risks.** Bars must be *computed*, not hand-authored, or they will drift out of sync the first
time an airframe is retuned. Resist adding a stat for everything — five bars, or the card becomes
a spreadsheet.

---

### R4 — Target Padlock & Look-Back Camera

**Perspective:** Player
**Player Value:** High · **Frequency:** Core · **Effort:** Small · **Complexity Risk:** Low ·
**Replayability Impact:** Medium · **Priority:** NOW · **Category:** Add

**Player Problem.** Two camera states, both with right-drag freelook. Cockpit FOV is 75–80°. In a
turning fight the bandit is outside the HUD field of view most of the time, and the only aid is a
dashed steering line. "I lost him" is the most common failure in the game's best moment.

**Example Scenario.** A scissors at 600 m. He goes over the top. You need to look up and behind
while still flying. You can right-drag the mouse — with the same hand context you're using to
manage the fight — or you can lose him. Most players lose him.

**Recommended Experience.** Hold a key: the camera snaps 180° and eases back on release. Hold (or
toggle) another: the camera padlocks to the designated target and keeps it centred while the
aircraft keeps flying to your inputs. Recentring is smooth, using the easing already in
`CockpitCamera`.

**Why It Matters.** Situational awareness is the fight, and this is the largest readability gain
per hour of work anywhere in the audit. It makes the existing dogfight model — which is good —
actually playable at close range.

**Risks.** Padlock can become a crutch if it works at unlimited range or through the airframe.
Gate it to the locked or nearest target within a reasonable cone, and keep the aircraft's own
motion fully player-controlled.

---

### R5 — Teams

**Perspective:** Player / Designer / Product
**Player Value:** Very High · **Frequency:** Core · **Effort:** Medium · **Complexity Risk:**
Medium · **Replayability Impact:** High · **Priority:** NOW · **Category:** Add

**Player Problem.** `getEnemies()` returns every AI plus every remote player, and the only IFF
concept classifies the AWACS picture by `spec.nation`. There is no way for two friends to be on
the same side. "Playing with friends" means "playing against friends."

**Example Scenario.** Four friends connect. Two want to fly as a pair against the other two. They
cannot. They also cannot avoid shooting each other by accident — an AIM-120 doesn't care whose
side you're on, and if one picks an F-16 and another a Su-27, AWACS actively paints them as
hostile to each other.

**Recommended Experience.** The lobby shows two columns. Click to swap sides; the host can
auto-balance. In flight, teammates are blue and hostiles red — on the HUD, the radar, the
datalink and the kill feed. Friendly fire is off, and your missiles will not lock a teammate.
The team score is visible at the top of the screen. Losing a teammate matters.

**Why It Matters.** It unlocks the entire cooperative half of the product — the 2v2, the
"cover me," the co-op PvE mode — and it is the prerequisite for the match structure that gives
the session a shape. Every other multiplayer recommendation compounds off this one.

**Risks / Complexity.** The team filter touches several call sites: `EntityManager.getEnemies()`,
the radar's trackable set, missile target resolution, `AWACS` classification, the HUD target
designator, and the network profile (a `team` field on `NetPlayerProfile`). It is wide but
shallow — a filter, not a new system. **Doing it now is meaningfully cheaper than doing it
later**, since each new consumer of `getEnemies()` adds another site to retrofit. Watch for one
trap: friendly fire being off must not make teammates *invisible* to your own radar, or players
lose their team picture.

---

### R6 — Match Structure & Rematch

**Perspective:** Designer / Product
**Player Value:** Very High · **Frequency:** Core · **Effort:** Medium · **Complexity Risk:** Low ·
**Replayability Impact:** High · **Priority:** NOW · **Category:** Add

**Player Problem.** `DOGFIGHT` declares `winConditions: []`. The server maintains authoritative
kills and deaths and nothing ever compares them to a target. There is no timer, no score limit, no
match end, no final board, no rematch. The only exit is one player choosing ABORT TO DEBRIEF,
which shows them a personal sortie summary while everyone else keeps flying.

**Example Scenario.** Four friends fly for twenty minutes. Nobody knows the score without holding
`N`. There is no moment where anything is settled. Eventually someone says "I should go" and the
session dissolves. Nobody says "again," because nothing finished.

**Recommended Experience.** The host sets a score limit and/or a time limit. The team score sits
at the top of the HUD, and the last few kills feel like they matter. When the limit is reached
the match freezes into a **MATCH END** board: winning team, final scores, MVP, and each player's
kills, deaths, missile Pk and gun accuracy — all of which `SortieStats` already computes. Three
buttons: **REMATCH**, **SHUFFLE TEAMS + REMATCH**, **CHANGE MODE**. Rematch drops everyone back
into the lobby with the connection already live — which the existing `LobbyRestoreBundle` flow
already supports.

**Why It Matters.** This is the mechanism that manufactures "again." It converts an open-ended
sandbox into a repeatable session, and it creates the natural moment where a friend group
compares notes, argues, changes aircraft, and goes back in. It is also the single most valuable
*playtest* investment in the roadmap: a match that ends produces a feedback event; one that
doesn't, doesn't.

**Risks.** Match-end synchronisation across clients — with the current relay design the host
should own the decision and broadcast it, rather than each client evaluating independently
(exactly the problem the single-player scenarios have in LAN today). Keep default limits short:
10–12 minutes beats 25.

---

### R7 — Host-Driven Lobby

**Perspective:** Product / Player
**Player Value:** High · **Frequency:** Core (every session) · **Effort:** Medium ·
**Complexity Risk:** Low · **Replayability Impact:** High · **Priority:** NOW ·
**Category:** Rework

**Player Problem.** Mode is chosen per-player on a screen that comes *before* the one containing
Host/Join, and the warning that you chose a single-player mission appears only after you connect.
There is no ready state and no synchronised start — each player presses LAUNCH whenever.

**Example Scenario.** Four friends connect. Two picked Dogfight, one picked Head-On BVR and is
fighting private invisible bandits, one is still reading the controls table. Two are already
airborne and one hasn't left the menu. Somebody has to explain the sequence over voice chat.

**Recommended Experience.** One fork on the first screen: **Single Player / Multiplayer**. The
host picks the mode and rules once. Joiners enter an IP and land in a lobby showing teams,
callsigns and aircraft. Everyone picks a plane and a loadout preset and presses READY. The host
presses START and everybody spawns together.

**Why It Matters.** Setup friction is paid on *every* session and it is the first impression the
game makes on a friend who was invited. Getting four people airborne on the same team should take
under a minute of wall-clock time and zero verbal instructions.

**Risks.** Don't over-build it. No matchmaking, no browser, no accounts — IP and port is correct
for this audience. The one thing worth guarding against is a host who leaves; decide early whether
that ends the match or migrates it (ending it is fine and much simpler).

---

### R8 — Co-op PvE: Intercept Mode

**Perspective:** Designer / Product
**Player Value:** High · **Frequency:** Frequent · **Effort:** Medium-Large · **Complexity Risk:**
Medium · **Replayability Impact:** Very High · **Priority:** NEXT · **Category:** Add

**Player Problem.** AI is suppressed entirely in LAN sessions. With two or three friends online —
which for most groups is *most* nights — the only option is a thin FFA. The AI, the behaviours and
the scenario spawner all exist and are unreachable in the mode where they would help most.

**Example Scenario.** Three friends log on. A 3-way FFA means two-on-one at any moment and it
isn't fun. They want to be a flight of three against something. There is no such option.

**Recommended Experience.** All players on one team. Waves of AI bandits escalate: two, then four
mixed, then an ace with better decision quality. Between waves there's a breather to regroup and
check damage. The team either clears the last wave or wipes. The score is waves cleared, and it
lands in the logbook so there's a number to beat.

**Why It Matters.** This is the mode that fits the friend group's real constraints. It scales from
1 to 8 players without becoming a different game, it creates a shared adversary (which is what
makes a group feel like a squadron), it makes the wingman commands relevant, and it gives the
existing AI work a stage.

**Risks / Complexity.** The real cost is that AI currently spawns independently and unreplicated
on every client. The host must own AI spawning and simulation, and replicate it — AI aircraft
flowing through the existing `NetworkAircraft` interpolation path. That is the bounded piece of
engineering behind this feature and the reason it is NEXT rather than NOW. Difficulty must come
from R9, not from wave *count* alone, or it becomes attrition.

---

### R9 — AI Difficulty Tiers

**Perspective:** Designer
**Player Value:** Medium-High · **Frequency:** Frequent (all PvE) · **Effort:** Small ·
**Complexity Risk:** Low · **Replayability Impact:** High · **Priority:** NEXT · **Category:** Add

**Player Problem.** There is exactly one AI skill level. `AIBrain` has no difficulty parameter
anywhere; every bandit reacts identically, fires at identical ranges (IR inside 3.5 km at &lt;35°
aspect, guns inside 1.2 km at &lt;8°), and defends identically. A new player finds them
overwhelming; an experienced one finds them predictable within two sorties.

**Example Scenario.** A friend's first flight ends in fifteen seconds against a bandit that flies
a perfect intercept. Their second ends the same way. They conclude the game is unfair rather than
that they need practice. Meanwhile the host, who has forty sorties, wants a real fight and can't
get one.

**Recommended Experience.** Three or four tiers — *Rookie, Regular, Veteran, Ace* — selectable in
the lobby, differing **only** in decision quality: gun and missile aim error, reaction delay
before responding to a threat, how early they commit or disengage, missile discipline (an Ace
waits for a good shot; a Rookie wastes missiles), and how well they use the vertical. An Ace
should also *make mistakes occasionally* — a predictable-but-perfect opponent is less interesting
than a slightly fallible one.

**Why It Matters.** It makes R8 replayable — the same waves at a higher tier are a genuinely
different fight — and it fixes the onboarding cliff. It is also the cheapest content multiplier
available: four tiers times the existing scenarios is a lot of session variety for a small amount
of tuning.

**Risks.** **Never grant physics bonuses.** An AI that turns tighter than the airframe allows or
sees through the terrain is the fastest way to make players feel cheated. All difficulty must come
from what the AI *decides*, never from what its aircraft *can do*.

---

### R10 — Controls: Rebinding, Curves, Presets, Mouse Flight

**Perspective:** Player / Product
**Player Value:** High · **Frequency:** Core · **Effort:** Medium · **Complexity Risk:** Low ·
**Replayability Impact:** Medium · **Priority:** NEXT · **Category:** Add

**Player Problem.** Bindings are fixed in source. There is no sensitivity, deadzone or response
curve for either keyboard or gamepad, no mouse-flight option, and no way to use a HOTAS
meaningfully. `invertPitch` is the only input preference exposed. The bar — *configure without
reading source files* — is not met.

**Example Scenario.** A friend plugs in an Xbox controller. The stick response is linear with no
deadzone tuning, so fine tracking in a gun solution is a fight against the input. They conclude
the flight model is twitchy. It isn't — the *input mapping* is.

**Recommended Experience.** A controls screen with three presets (Keyboard / Gamepad / Stick), a
rebindable list, and per-axis sensitivity, deadzone and response curve. A mouse-flight option
where mouse position drives a virtual stick, for players who expect that from an accessible
combat flight game.

**Why It Matters.** Input quality gates the perceived quality of *everything else*, especially the
flight model — which is the project's strongest asset. It also determines whether a friend with
different hardware can join at all.

**Risks.** Scope creep into a full input-remapping subsystem. Presets plus three sliders and a
rebind list is enough; per-axis curve editors are not needed.

---

### R11 — Kill Cam / Death Cam

**Perspective:** Player / Designer
**Player Value:** Medium-High · **Frequency:** Frequent · **Effort:** Medium · **Complexity Risk:**
Medium · **Replayability Impact:** Medium · **Priority:** NEXT · **Category:** Add

**Player Problem.** The respawn card names the killer, which is good. It does not say *how* —
missile or guns, from where, whether you missed an RWR cue. Half the core fantasy ("I know exactly
why I lost") is unserved.

**Example Scenario.** You're at 3000 m in a turn and you explode. The card says SHOT DOWN BY
VIPER. You have no idea whether that was a missile you never saw or a guns pass from your six.
You learn nothing, so you make the same mistake next life.

**Recommended Experience.** Three seconds, on the killer's aircraft or on your own wreck from
outside, with a caption naming the weapon and the range. Skippable. Then the standings and the
countdown you already have.

**Why It Matters.** It closes the "know why" half of the fantasy, and it is the single largest
generator of table-talk in a friends session — the moments people replay to each other are the
moments they *saw*.

**Risks.** Requires holding a short history of the killer's transform, and in multiplayer the
killer's state is interpolated, so the replay is approximate. Approximate is fine — it exists to
explain, not to adjudicate. Keep it short and always skippable; a long unskippable kill cam
directly undoes the 5-second respawn, which is one of the build's best decisions.

---

### R12 — Loadout Presets

**Perspective:** Player / Designer
**Player Value:** Medium · **Frequency:** Frequent · **Effort:** Small · **Complexity Risk:** Low ·
**Replayability Impact:** Medium · **Priority:** NOW · **Category:** Simplify

**Player Problem.** Up to nine per-hardpoint dropdowns. Since each pylon holds one missile and
there is no cost to filling every station, the optimal answer is always "everything," so the
screen is configuration rather than a decision.

**Example Scenario.** A new player sees nine dropdowns labelled SB-L, MB1, W2, E2 and has no idea
what any of them mean or what a good answer looks like. They either fill everything or leave it
empty, and either way they learn nothing.

**Recommended Experience.** Three buttons — **Dogfight**, **Balanced**, **BVR** — with the
existing dropdowns collapsed underneath for anyone who wants them. Each preset visibly changes
weight and drag, so BVR really does cost you turn performance. The mass and drag penalties are
already modelled per store, so this trade-off is free to expose.

**Why It Matters.** Turns a configuration screen into a genuine pre-match decision, removes a wall
from the one-minute test, and gives the aircraft-identity work something to interact with — a
light Fulcrum in Dogfight trim should feel decisively different from a Raptor in BVR trim.

**Risks.** If the presets aren't meaningfully different in performance, this is cosmetic. Tune the
weight difference until players can *feel* it *(needs playtest)*.

---

## APPENDIX A — SYSTEMS TO SIMPLIFY OR HIDE

Systems consuming development and *player attention* out of proportion to their share of
playtime. None of these should be **deleted** — they are built and they work. The recommendation
is to move them off the critical path.

| System | Playtime share | Recommendation |
|---|---|---|
| **Five MFD pages** (Radar, EW, FLIR, Stores, DataLink) on `F1`/`F2` | Low — the HUD carries the fight | Keep, but stop treating them as primary. Default to the most useful page and don't teach the cycling in the first flight. |
| **Targeting pod** on three keys (`P`/`O`/`K`) | Very low — one A/G scenario | Collapse to one toggle. Free two bindings. |
| **Radar `OFF` and `GMTI`** in the `R` cycle | ~0% and low | Move `OFF` to the MFD; give A/G its own toggle (R2). |
| **Wingman commands** on `1`–`4` | Low — one scenario has a wingman | Keep in single-player. In multiplayer these four keys are dead; reuse them for team pings. |
| **Per-hardpoint loadout dropdowns** | Every launch, low value | Demote behind presets (R12). |
| **Environment selects (time of day, weather)** | Once per launch | Correctly locked in MP already. In SP, move behind a "More" disclosure to shorten the loadout screen. |
| **Full controls reference on the loadout screen** | Read once | Collapse to a link/disclosure. Keep it in the pause menu where it's actually needed. |

The general principle: **the dogfight uses about five keys.** Everything else should be reachable
but not in the way.

---

## APPENDIX B — WHAT NOT TO CHANGE

A short protection list, because several of these are subtle decisions that would be easy to
"improve" into something worse:

1. **The speed-scheduled FCS ceiling with the floored pitch authority and the post-stall gate.**
   This is the flight feel. Do not touch it.
2. **The 5-second multiplayer respawn.** Short respawns are correct for this audience. Resist
   every argument for lengthening them "for tension."
3. **The flare irradiance / seduction split.** Scoring by perceived brightness *and* rolling
   against seeker rejection separately is what makes countermeasures skilful rather than random.
4. **The six-zone damage model with distinct flight consequences.** Do not collapse it to a health
   bar — it is already the "limp home" system, it just needs a mode that asks for it.
5. **The debrief's stat selection.** Missile Pk, decoy defeats, time-to-first-kill, landing grade,
   career logbook. Informative without being analytics. Don't add more.
6. **Four air-to-air missiles, two per nation.** The counter structure is clean. More variants
   would dilute it.
7. **G-LOC and auto-rudder as simple checkboxes.** Exactly the right amount of realism
   configuration. Do not turn this into a realism settings page.
8. **The environment lock in multiplayer lobbies.** Correct reasoning, correctly implemented.
   Extend the principle (host owns rules) rather than relaxing it.
9. **The controls reference appearing in both the loadout screen and the pause menu.**
10. **The lobby-surviving-the-debrief flow.** It is the foundation the rematch button sits on.

---

## CLOSING

FSim's problem is not that it lacks depth. It has more simulation depth than its target audience
needs, and much of that depth — the flare seduction model, the aspect-dependent IR signature, the
250× RCS spread across the roster, the six-zone damage cascade — is genuinely good design that
players would enjoy *if they were ever told it was there*.

The problem is that the game around the simulation hasn't been built yet. There are no sides, so
friends can't be a team. There is no end, so a session can't be repeated. There is no
confirmation, so a kill isn't felt. There is no identity on the aircraft cards, so a roster of ten
plays as a roster of one.

All four of those are cheap relative to what has already been paid for. The expensive half — the
flight model, the weapons, the netcode transport, the damage model, the HUD instruments — is done
and is good.

**Build the game around it.**
