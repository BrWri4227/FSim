# FSim Sound Files

Drop your audio files here. The game will automatically load them and replace the
synthesized placeholders. Any missing file silently falls back to synthesis.

## Required filenames (WAV or MP3, any sample rate)

| Filename              | What it plays                                              |
|-----------------------|------------------------------------------------------------|
| `engine_idle.wav`     | Jet engine at idle — looped, pitch-shifted by throttle     |
| `engine_ab.wav`       | Afterburner roar (optional, reserved for future use)       |
| `engine_flameout.wav` | Engine wind-down / compressor stall one-shot               |
| `gun_20mm.wav`        | M61A1 Vulcan burst — looped while firing                   |
| `gun_30mm.wav`        | GSh-30 burst — looped while firing                         |
| `ir_growl_cold.wav`   | AIM-9 / R-73 seeker acquiring — looped                     |
| `ir_growl_hot.wav`    | AIM-9 / R-73 seeker locked — looped                        |
| `rwr_search.wav`      | Single RWR search ping                                     |
| `rwr_track.wav`       | Single RWR track ping (plays faster than search)           |
| `rwr_lock.wav`        | RWR continuous STT lock tone — looped                      |
| `missile_launch.wav`  | Missile motor ignition one-shot                            |
| `pull_up.wav`         | GPWS "pull up" voice warning                               |
| `pull_up_urgent.wav`  | GPWS "pull up pull up" urgent warning                      |

## Free sources for realistic military aircraft sounds

- **Freesound.org** — search "F-16 engine", "jet cannon", "missile launch", "radar warning receiver"
  - Many CC0 / Attribution licensed recordings
  - https://freesound.org

- **ZapSplat** — royalty-free sound effects including aviation
  - https://www.zapsplat.com

- **DCS World community** — DCS forum users occasionally share RWR tones and cockpit sounds
  - Search the ED forums for "RWR sounds pack"

- **MSFS / X-Plane community** — some aircraft sound packs are redistributable

## Tips

- WAV files at 44.1 kHz or 48 kHz work best; the Web Audio API resamples automatically.
- Looped sounds (engine, growl, gun, rwr_lock) should loop cleanly — trim silence at start/end.
- Mono is fine for all sounds; stereo is supported but not required.
- The engine sound is pitch-shifted via `playbackRate` (0.85 at idle → 1.25 at afterburner),
  so record/use the engine at a neutral mid-throttle pitch for best results.
