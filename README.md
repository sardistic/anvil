# ANVIL

A short 1-bit browser game: a lone woman walks a monochrome cyberpunk city toward the "life after death" upload.

Play at https://anvil.sardistic.com — or open `index.html` in any browser (the leaderboard shows as offline without the server).

## Run the server
`node server.js` (Node 24+, uses built-in `node:sqlite`; no npm install). Env: `PORT` (80), `DB_PATH` (./scores.db). Or `docker build -t anvil . && docker run -p 8080:80 -v $PWD/data:/data anvil`.

## High scores
After the upload completes you type a name (12 chars, remembered locally) and press Enter; the board "THE KEPT" shows the top 8 with your row inverted, or your position if you're below the cut. API: `GET /api/scores` (top 20), `POST /api/scores` `{name, score, rank, secs, fragments, stomps}` (one per IP per 10 s).

## Controls
- Move: `←` `→` or `A` `D`
- Jump: `Space` / `↑` / `W`
- Dash: `Shift` / `X` / `K` (invisible to the lights while dashing; 0.75 s cooldown)
- Mute: `M` · Restart: `R`

## How the look is made
- The world is drawn in grayscale at 3× (1200×675; drops to 2× automatically if the machine cannot hold 60 fps) with ink outlines on every near shape. Detail layers: fire escapes, neon signs, wires, rooftop vents and tanks, street lamps with light cones, steam grates, rain, a moon, a cross-hatched hologram, a fast foreground railing.
- Every frame is pushed through a *static* 8×8 Bayer ordered dither (64 tonal steps) to pure 1-bit black/white — the dot-shaded halftone of the film. No per-frame noise, no full-screen flashes; glitch bands appear only on damage and in the ending.
- A light CSS scanline/vignette overlay finishes it.

## The score
Synthesized in WebAudio (no copyrighted music) and driven by play:
- Sub drone always; its lowpass opens with your speed and slams open on a dash.
- Tempo climbs 96 → 104 → 112 bpm across the acts; hats join in Act II, an arpeggio in Act III.
- A detuned pad fades in from Act II and lifts in pitch while you are airborne.
- At 1 integrity a 58.5 Hz tone beats against the 55 Hz drone.
- Footsteps and landings click; every act change rings the anvil.

## Mechanics & rewards
- **Score, combos, pops.** Every fragment is +10 × a chain multiplier (chain builds while you keep collecting). Stomping drones in the air chains: +100, +200, +300… without touching the ground. Floating score pops, 5-frame hitstop on stomps.
- **Near miss.** Passing through a light in the air = "CLOSE CALL +50" with a brief slow-mo.
- **Crates.** Dash into an X-marked crate: it bursts into three fragments; one in three holds a core (+500, +1 integrity). The core crates blink.
- **Geysers.** Grated vents blow steam on a cycle (puffs = charging); stand on one when it blows to launch ~120px. Fragment columns above each.
- **Every platform pays.** 112 fragments laid in arcs over containers, drones, gaps and girders. Outlined boxes with a bright top rim are solid; buildings end behind the sidewalk strip and are scenery.
- **Safe falls.** Falling into a gap costs one integrity and returns you to the last safe ground — only death at 0. Every gap has a 300px runway and a chevron warning post.
- **Progress bar** under the HUD with act ticks. Ending shows score, rank (S/A/B/C), time, fragments, lights silenced.
- Drone lights only read the street — jump or dash through. Checkpoint at each act. 6 fragments heal.

## Rare powers (the only colour in the game)
Glowing rings. Four sit at the top of the geyser columns; crates (20%) and stomps (12%) can drop more. While one is active a faint coloured glow surrounds the character and a timer bar shows under the score.
- **PHASE** (cyan, 12 s) — the lights cannot see you at all.
- **MAGNET** (amber, 15 s) — fragments within 80px fly to you.
- **OVERCLOCK** (magenta, 10 s) — double jump, dash cooldown 0.3 s, all score ×2.
- **SHIELD** (green, until used) — absorbs one hit or fall.

## Design principles applied (from the literature)
- **Competence feedback that scales with success** (Kao et al., CHI 2024): stomp chains get bigger bursts, longer hitstop, larger shake and a shout at ×3; a hit-free act pays "FLAWLESS ACT +300".
- **Autonomy through meaningful choice** (Ryan, Rigby & Przybylski 2006): powers change how you play for a while — stealth, greed, speed, safety — rather than just adding points.
- **Juice for appeal** (Hicks et al. 2019): pops, particles, hitstop, slow-mo near-misses, glow; none of it full-screen flashing.
- **GameFlow** (Sweetser & Wyeth 2005): clear goals (progress bar, counters), immediate feedback, challenge matched to skill.
- **Invisible dynamic difficulty** (Constant & Levieux, CHI PLAY 2017): after three setbacks within a minute, drone lights sweep 35% slower and a shield waits at the respawn point. Never announced.

Debug: `#play=560&power=over` starts with a power active.
