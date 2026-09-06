# Piranha JavaScript port — build 0.1

This is a playable, incomplete port using original extracted artwork and audio. **It is not yet a faithful reproduction of the complete 100-level game.** The first 20 level initializers and their reachable progression callbacks are converted; levels 21–100 remain unavailable. Enemy movement and firing cadence still need comparison with DOS.

For the current gap audit, collision behavior and debug controls, see [CONVERSION_STATUS.md](CONVERSION_STATUS.md). Debug tools are available through the console button or F2; F3 steps one physics tick.

## Run

Use Node.js 18 or newer (the computer's default Node 10 is too old):

```sh
cd web
node server.mjs
```

Open http://127.0.0.1:5173. No npm install, bundler, CDN, or internet connection is needed. Any static HTTP server can also serve `web/`; media byte-range support is recommended. `server.mjs` binds to loopback only and supports byte ranges for audio playback and seeking.

```sh
cd web
npm test
```

## Implemented

- Original 320×200 playfield, displayed in VGA's 4:3 aspect ratio.
- Batched WebGL rendering: one background draw and one sprite draw per ordinary frame. Canvas 2D fallback when WebGL is unavailable.
- 3,619 atlas frames (3,618 original artwork frames plus one utility pixel) in one padded 2048×4096 atlas, including all 64 ship rotation frames. No AI-generated replacements.
- Levels 1–20 use the recovered spawn instructions, formations, timers, kill counters, completion masks, and staged callbacks, including the level-19 boss. Required enemy artwork and all four campaign backgrounds are loaded.
- Enemy weapons follow the original per-actor weapon field. Types 1, 3, and 6 use Ammo.01A, Ammo.02A, and Ammo.03B respectively; type 0 does not fire.
- Optional CRT scanlines use 50% overlay opacity, with one line every 5 CSS pixels.
- Original per-frame offsets and hotspots position every animation around its intended anchor, including rotating ships, coins, asteroids, and bullets.
- Preallocated typed arrays for actors, bullets, and effects; fixed simulation steps independent of render refresh rate. Actor scans include all 264 slots, including 256–263.
- Rotation, thrust, inertia, braking, shooting, asteroid splitting, enemies, lives, pickups, scoring, level transitions, restart, pause, and saved personal best.
- Collision masks follow the selected animation frame and its recovered origin. Conservative circles reject distant pairs before pixel tests. Players are stamped last into a CPU object-ID layer; no GPU readback is used.
- One, two, or three local players. Keyboard controls shown in the UI; touch buttons control player one.
- Difficulty selector: **Easy** is the default, with 200 health per ship (2× Normal's 100). The selection applies on launch/restart and remains in effect through level changes, respawns, and coin continues for every pilot. The hull meter displays health relative to the selected maximum. This is a requested browser addition; enemy stats and damage are unchanged.
- Original module music and original PCM effects, with volume/mute, pause behavior, and a sound archive with playback and download links.
- Loss of focus pauses play and clears input; audio begins only after user interaction.
- Start directly from the intro with a regular key press, a click/tap on the artwork, or its start prompt. The selected crew and difficulty apply. Form navigation, focused buttons/links, and browser shortcuts retain their normal behavior; repeated input cannot launch twice while audio unlocks.
- Arcade continue: after the last pilot loses their last ship, click **Insert coin** or press **5** (including numpad 5). This free virtual coin restores three ships and full health for every pilot, with 2.5 seconds of protection. Score, collected credits, enemies, and pending wave progress are preserved; bullets are cleared for re-entry. This is a requested browser addition, not a recovered DOS mechanic.

## Fidelity boundaries

Confirmed: original artwork; 320×200 visible dimensions; 100 campaign entries; the first 20 background/asteroid selections and reachable progression scripts; original random-velocity table; normal asteroid breakup counts (3 medium / 4 small / 4 tiny); medium mines splitting into four small mines; enemy weapon types; normal player-shot damage of 35; original PCM sample bytes; sound playback rate constants; campaign music assignments.

Reconstructed and awaiting DOS comparison: movement speed, acceleration, drag, original collision sampling rules, wrapping behavior, firing cadence, enemy projectile damage, asteroid breakup velocities, enemy paths and advanced firing patterns, health/lives balancing, co-op behavior, pickup drift/lifetime and scoring. Drop schedules are now recovered as described below. The 70 Hz simulation rate is a working choice and is not yet proven against the original timer. Ordinary atlas sprite palettes are recovered from their embedded VGA blocks and the shared banks described below; dynamic palette effects still need DOS comparison. HUD and menu controls are browser UI, not a transcription of the DOS screens.

### Sprite palettes

The type-0x0A DWORD at offset 1 points to a compact palette, rather than indicating total file size. The original loader copies that palette to a VGA bank (`0x440A6`) and adds the bank base to pixel-stream bytes (`0x43A0F`). Using the background palette for unshifted sprite indices caused the almost-black bullets and mottled purple asteroid.

The atlas now uses the original yellow bullet palette and each asteroid variant's own shading. Ships, explosions, pickups, and enemies also use their recovered colors. `Enemy.G` shares the ship-1 bank. Pickup index 255 wraps through the coin bank into the explosion palette's white entry; this preserves the glints in health/weapon pickups. These colors are baked into RGBA, retaining the existing batched WebGL rendering with no additional runtime palette lookup.

`atlas.json` records the palette source for each animation group. The builder decodes source sprites directly and refuses unresolved palettes or failed frames. The Python regression suite compares every one of the 3,618 artwork frames against a palette-bank/byte-shift reconstruction, including all asteroid rotations, bullet orientations, and pickup glints. The remaining atlas frame is the renderer's white utility pixel.

### Smooth asteroid rotation

Asteroid drawing retains the original frames and adds only a small residual rotation around each frame's recovered hotspot. With continuous frame phase `f`, the base sprite is `floor(f)` modulo its frame count, and the residual is `(f - floor(f)) × measuredTurnToNextFrame`. It resets when the base frame changes and handles negative phases and the last-to-first transition. Frame timers now use the source initializer and advance every 2 or 3 simulation updates; rendering may advance rotation by the remaining fraction of a simulation tick without changing game state. Paused rendering does not extrapolate.

All 40 asteroid animation groups currently have 64 frames: the nominal full-turn increment is 360/64 = 5.625 degrees. They are not all rigid 2D rotations, however. The first large asteroid turns clockwise, medium fragments turn counterclockwise, and other frames contain 3D shape changes. `tools/measure_rock_rotation.py` estimates each neighboring pair's small screen-plane rotation offline by comparing anchored alpha silhouettes, with ±5.625 degrees as the search limit. It includes the wraparound pair. Where a rotation would worsen alignment, the residual stays zero. This smooths the observable in-plane turn; 3D tumbling and lighting changes still come from discrete artwork frames.

`atlas.json:rockRotation` records the per-frame correction angles in radians. The original RGBA artwork and masks are unchanged. WebGL rotates vertices in its existing batch, without an extra draw call or shader pass. Canvas 2D applies the same hotspot transform and restores its context. Rotated bounds are used for culling. Both retain nearest-neighbor texture sampling. Collision masks and their conservative circles remain on the discrete simulation frame, as requested; they do not rotate through the visual residual.

Original animation evidence: `0x599F6` calls frame advancement `0x59A09`. A direction byte of `0xFF` decrements frames; the other branch increments and wraps. The initializer at `0x6096F–0x60986` chooses a delay of 1 or 2, and the update decrements that timer on intervening calls. Thus source frame changes are separated by 2 or 3 update calls. The browser now implements these counters, including the immediate first advance and random forward/reverse direction. At the current 70 Hz simulation, that means 35 or 23⅓ frames/second, and a 64-frame loop takes about 1.83 or 2.74 seconds. The original hardware timer frequency is still unverified, so matching update counts does not establish exact wall-clock parity. The recovered 1,000-digit random table is used for these choices and pickup rolls; the entire original game's random-call ordering is not yet reproduced.

Validation covers fractional reset, reversed playback, animation wrap, unchanged stepped masks, pause behavior, hotspot transforms in both renderers, rotated culling, and silhouette registration quality. The first large and medium asteroid animations each show over 20% lower aggregate silhouette transition error with their measured rotations than without them.

### Collision masks and CPU layer

The extracted assets do contain separate `$M` silhouettes (filesystem names end in `_M.bin`). The atlas builder now decodes them for ship 1, Enemy.G.03a, and Ammo.01A / Ammo.01B / Ammo.02A / Ammo.03B. Other groups use their ordinary sprite alpha: every alpha value greater than zero is solid. Each group records its source under `collision.sources` in `atlas.json`. These are recovered mask shapes, not a claim that the DOS collision sampler has been reproduced.

Masks have independent frame dimensions and origins. For example, normal bullet frame 0 has artwork origin `(1,4)` but mask origin `(2,4)`; its `$M` stencil contains 16 solid pixels versus 26 in the artwork. The original origin is used for each. All 3,618 artwork frames have corresponding collision data in `assets/collision.bin` (745,625 bytes, one bit per pixel with byte-aligned rows). Runtime decoding produces reusable row spans once at load time.

`src/collision.js` maintains a reusable `Uint16Array` object-ID layer with 128-pixel gutters. Solid actors are stamped in render order, followed by all living players. Transparent pixels preserve IDs underneath. Coins and visual effects do not block bullets; coin collection uses mask overlap. Temporary invulnerability does not remove the player's silhouette, even during its visual blink. Ship-to-actor contacts use direct mask overlap so the player's final layer write cannot hide an existing overlap.

Every frame's conservative circle encloses its solid pixels relative to its origin and includes a rounding allowance. It only rejects distant candidates; the actual hit requires mask pixels to overlap. Rendering and collision use the same base animation selection and rounded positioning. Asteroid rendering adds a small visual rotation between frames; collision retains the stepped source mask (see below). Bullet travel is sampled at intervals no greater than one pixel on either axis to reduce tunneling through small objects. Bullets do not wrap: they keep moving offscreen and are removed beyond the original 50-pixel gutter (`x < -50`, `x > 370`, `y < -50`, or `y > 250`). This sweeps bullets against actors at their updated positions, not full continuous relative-motion collision detection.

The firing actor is excluded, with a pool-generation check so a later occupant of its slot is not accidentally immune. Co-op friendly fire remains disabled. Enemy shots are absorbed by other solid actors without damaging them; player shots damage enemies and asteroids. Player masks have priority wherever their solid pixels overlap actor pixels. Deaths, splits, and player respawns refresh the layer before subsequent projectiles are checked.

Validation: the Python suite compares every mask pixel, origin, and circle bound with the separate source member or atlas alpha. JavaScript tests cover transparent gaps, player-last ordering, frame wrapping, rotation-dependent contacts, high actor IDs, stale layer removal, shooter exclusion, projectile travel, and continuing after death. The 20-level progression simulations still pass.

A local Node 22 synthetic benchmark of full simulation updates (three protected players, stationary rocks of mixed sizes, zero-damage projectiles replenished each tick; 100 warmup ticks then 300 samples) measured median / 95th percentile of 0.075 / 0.095 ms for 32 actors + 48 bullets, and 0.657 / 0.928 ms at the pool limits of 264 actors + 512 bullets. This excludes rendering and is a local measurement, not a mobile performance guarantee. Browser smoke testing retained 60 FPS and two WebGL draws.

The original colored-map ownership rules and grid sampling still need tracing and DOS comparison. The current exhaustive mask overlap can differ from a sparse original sampling grid, even when both use the same silhouette.

### Pickup collection, level selection and shop

All eight pickup types now persist for 24 simulation seconds, twice the previous lifetime. After the campaign completion condition is met, a level stays playable until every pickup has been collected or individually timed out. The existing one-second clear delay starts only after that. Pausing freezes pickup lifetimes. The playfield displays the remaining pickup count and latest expiration countdown; delayed waves and protected-stage completion rules still apply.

The starting-level dropdown lists the 20 converted levels and applies to both the launch button and intro-screen start. Selecting a later level starts a fresh run with the chosen crew/difficulty, default equipment, and zero credits; it does not carry purchases from a previous run.

The level-complete button now opens a shop before levels 2–20. Pilots can spend the shared browser credit balance on hull repair (+50 browser health, clamped), one extra ship (also revives an eliminated co-op pilot), the existing three-tier weapon progression, ammunition speed (+20% per upgrade), and ship speed (+20% thrust and +15% top speed per upgrade). Both speed upgrades have three purchasable tiers. Purchased equipment survives level transitions, ship loss, and coin continuation; starting a fresh run resets it. The shop freezes gameplay, supports choosing a co-op pilot, rejects unaffordable/full/invalid purchases without charging, and offers a next-level launch without buying anything. Escape returns to the level-complete screen.

`tools/recover_gameplay_data.py` exports the original 16-entry price tables at `0x7B03D`, `0x7B07D`, and `0x7B0BD`. The original selection at `0x7C5D3–0x7C619` depends on the living crew count. The browser uses those prices for ship (index 0), repair (1), ammo speed (3), ship speed (4), and its two weapon upgrades (indices 8/9). Source purchase handlers at `0x7CEE8–0x7CF70` confirm ship increments and +50 energy clamped to 928 original units. The browser retains its own 100/200 health scale. Shop categories and prices are recovered; the speed increments, simplified weapon mapping, shared co-op economy, and HTML shop presentation are browser adaptations, not a complete transcription of the DOS shop. Extra-energy capacity and the remaining original weapon families are not offered yet.

Validation covers lifetime extension, staggered expiry, collection-triggered completion, all 20 campaign progressions, source price bytes, purchase validation, co-op revival, caps, real movement/projectile changes, equipment persistence and clean selected-level starts. `tests/shop-check.html` seeds a separate shop scenario for testing the real shop UI without altering a live run.

### Continuous player edge crossing

Player sprites now appear on both sides as their pixels cross an edge, with four pieces at corners. `src/wrapping.js` chooses copies from each frame's rounded bounds and recovered origin. Ships, exhaust and co-op markers use the existing sprite batch in both WebGL and Canvas 2D. This seamless crossing is a requested browser enhancement rather than the DOS offscreen-gutter behavior.

The muzzle position is wrapped separately from the ship center before creating a shot. A nose across the seam fires from that side, while a tail crossing does not move the firing point. All weapon tiers use this position. Once emitted, bullets still travel without wrapping and expire at the original gutter bounds.

Collision masks use the same edge-copy rule, retaining one player ID across every visible piece. Player stamps are clipped to the playfield; offscreen continuations cannot be hit in the gutter. Wrapped wings can collect pickups and collide with asteroids or enemy bullets. Conservative circle rejection includes the copies, player-last pixel ownership remains intact, and a contact is resolved once per actor/pilot pair. No extra game actors or GPU readbacks are needed.

Tests compare every wrapped solid pixel for all 64 frames of all three ships at edges/corners, and check muzzle placement for all weapon tiers, tail-first crossings, outgoing shots, opposite-side collisions, dead-player cleanup and exhaust wrapping. `tests/wrapping-check.html` provides a reproducible visual check with shots from wrapped muzzles.

### Recovered exhaust

The thrust branch at `0x61A6F` reaches the actual spawn at `0x61C72–0x61C7D`: kind 70, subtype 10, starting frame 4. Two preceding side-emitter calculations do not call the spawn routine, so they are not added to the browser effect. Initializer `0x6074A–0x60776` selects `MISC/o8_Explosion.02c` (pointer `0x44477`), 12 frames, delay zero. Each frame is 6×6 pixels. The browser now emits this opaque original artwork every thrust tick instead of fading 2×1 rectangles every other tick.

`tools/recover_gameplay_data.py` exports the 64 rear attachment offsets from `0x3880C + (320 + shipFrame) × 8` and backward exhaust velocities from `0x3A80C + (64 + ((shipFrame + 32) % 64)) × 8`. The effect inherits ship velocity and adds 1.5 pixels per update backward. Original per-frame origins and explosion-bank colors are retained; the existing sprite batch handles the trail. Tests check all 64 attachment directions, emission cadence, frame selection, pause, expiration, and restart. The reproducible visual fixture at `tests/effects-check.html` displays exhaust in three ship directions and every pickup using the real renderer.

### Pickups and screen shake

`0x4FADE` was previously misidentified as shop configuration. It copies five **drop schedules** from the profile pointer table at `0x506A0`: large, medium, small, tiny asteroids, and enemies. Their lengths live at `0x50538–0x5053C`, with cursors at `0x5053D–0x50541`. The browser loads those schedules into campaign RAM so later level-script overrides remain effective. Drops can occur before an asteroid finishes splitting, not just when the smallest pieces die. `0x5D546` resolves random drop codes 10/11; 120 means no pickup.

The browser now includes 10/50/100-credit coins, question marks, bombs, weapon upgrades, energy and extra ships using original artwork and origins. Energy restores 100 browser health up to the selected difficulty's maximum; extra ships apply to living co-op pilots. Weapon upgrades currently use a browser three-tier progression (single yellow shot → yellow spread → energy spread); the complete original weapon progression is still pending. Coin drift, 24-second lifetime, and front-face-only animation remain approximations; animation advances every three simulation ticks.

The question-mark handler `0x90C29` chooses projectile type 5/6 and pattern 21–26. The port recovers all six: sequential 8/16-shot sweeps, simultaneous 8/16-shot rings, and 12/33-shot spirals. Patterns use the original signed velocity tables, coin position, damage 150, initial animation frame 10, and collecting player's ownership. Type 5 is Ammo.03A using unshifted ship-1 colors; type 6 is Ammo.03B using the PlayerInfo bank. Friendly fire remains disabled as in the browser's existing co-op rules.

The recovered shake is in the bomb handler `0x5CE67`, rather than the question-mark handler: a palette flash and 50 damage to at most 11 eligible rocks/mines (Enemy.H is eligible in the source but not yet in this campaign). The browser snapshots targets before breakup, rebuilds the collision layer after collection, and applies a short camera shake and warm flash. A smaller 0.22-second shake on successful asteroid damage to a player is the requested browser addition. Shake is visual only, never changes collision coordinates, freezes on pause, and clears on restart/continue/level change.

Regression checks cover source drop choices, script overrides, all six burst counts and vectors, cash/energy/lives/weapons, bomb target limits, stale collision removal, friendly fire, and effect resets. All 20 campaign progression simulations still pass.

### Sprite origins

Each 26-byte frame record stores frame offsets at `+6/+8` and hotspots at `+10/+12`. The DOS blitter adds the offsets, then subtracts the hotspots (`0x43AF6–0x43B17`). The atlas exports `origin = hotspot - frameOffset` in the existing final two fields of each frame rectangle. Transparent cell padding does not affect this origin. Using the padded cell center previously caused rotations to shift position.

This applies to every artwork frame. Both WebGL and Canvas 2D already subtract the atlas origin, so the fix adds no rendering work. The Node regression suite checks placement against all source frame records at normal and enlarged scale, including animation wraparound. The original per-frame positioning is now recovered; remaining dynamic light/copy effects still need comparison with DOS.

Not implemented: levels 21–100, complete original shop/weapon system, deathmatch, original level passwords, accurate compiled fonts, `$C`/`$L` compositing, and exact tracker-library mixing. This build ends explicitly after level 20. The level-19 call to the general pattern queue remains unimplemented; the stage-clear call clears encounter pools.

## Newly recovered campaign evidence

### Normal-game asset and code selection

The title uses `START.DD:g8_Logo`, exported as `assets/title-normal.png`. Startup loads that archive/member at `0x83E7B` / `0x83E80`. The separate `MISC.DD:g8_Logo` contains the baked-in "Playable demo" caption and is not used by the browser. The distinct filename also avoids retaining the earlier incorrect title in browser caches.

The original Normal Game player-count handlers at `0x868CF`, `0x868EF`, and `0x8690F` select mode 1 in `[0x7A83D]`. The dispatcher at `0x90480` / `0x9048E` calls `0x6F642`, which loads `SHIP1.DD` and follows the normal campaign, including the level-function table at `0x50714` and the 100-level completion check at `0x71CF9`. These are the assets and initializer sources used by the browser port. Mode 2 selects League Game through `0x9052A` → `0x6E395`, using `SHIP2.DD`; that path is not ported. This identifies the normal/league branches and the two logo assets; it does not establish that every demo-related branch in the binary has been identified.

The call at `0x4FDE7` dispatches through `dword [levelIndex*4 + 0x50714]`. That table contains the original 100 initializer addresses. Several initializers were omitted from the existing recursive-descent listing as data gaps.

`assets/campaign-evidence.json` records all 100 addresses, linear instruction listings up to the first return, and encountered asset-loader constants. **These are static evidence, not evaluated scripts**: loops, branches, callbacks, and runtime mutations must still be translated.

| Level | Entry | Background | Asteroid | Delayed enemies |
|---|---|---|---|---|
| 1 | `0x213B7` | 1 | 1 | None |
| 2 | `0x21423` | 1 | 2 | One; initial countdown 840, reload 280 |
| 3 | `0x2154B` | 1 | 7 | Five; initial countdown 0, reload 560 |

The first asteroid retains the original spawn coordinates `(-50,-50)`. Script-created velocities now use the original 500-entry signed fixed-point table at `0x3CE10`, stepped by the helper at `0x3D62F`. The 70 Hz conversion and subsequent movement remain subject to DOS comparison.

### Bullet edge behavior

The common projectile initializer `0x609C2` assigns update callback `0x5978C` at `0x609D5–0x609DA`. This applies to the currently ported weapon types 1, 3, 5, and 6. The callback calls `0x59F4B` at `0x59790`.

`0x59F4B` compares 16.16 position fields against `0x041A0000` (1050), `0x05460000` (1350, Y maximum), and `0x05BE0000` (1470, X maximum). Projectile initialization adds a 1100-pixel coordinate bias (`0x60A06` / `0x60A1F` store the resulting fixed-point positions), so the browser-space limits are X = -50..370, Y = -50..250. Strictly outside those limits, the routine writes `0xFFFF` to the auxiliary entry and zero to the actor-type byte `[EBX + 0x48DF2]`. It does not replace the position with an opposite-edge coordinate. Exact boundary values survive because the branches use `JAE` / `JBE`.

The browser now follows these bounds for both player and enemy shots. Regression cases cover all four edges for all four ported weapons and both owners, no opposite-edge hits, and exact gutter boundaries. The existing projectile lifetime limits and speeds remain browser approximations.

### Levels 1–20 and enemy weapons

`tools/convert_campaign.py` follows reachable branches, helper calls, and assignments to the callback pointer at `0x5070F` directly in `unpacked/MAIN.FLAT`. It exports 2,894 instructions to `src/campaign-data.js`. Unlike the linear evidence file, this includes delayed formations, kill-triggered reinforcements, and the changing level-19 boss callbacks. `src/campaign.js` executes only this bounded instruction set and explicitly mapped engine calls. Unsupported instructions or calls stop conversion/execution instead of silently inventing waves.

The bridge mirrors actor health and weapon writes, kill counters at `0x50705–0x50709`, completion mask `0x5070D`, completion hold `0x5070E`, and animation counters used by boss staging. Level 13 correctly excludes protected enemy hazards from its asteroid completion count. Medium-mine breakup at `0x5DA9E` creates four small mines (`0x5DC21–0x5DCFD`), necessary for level 4's five-kill wave gate.

Opening callback `0x214C9` writes weapon **0** to `[EBX + 0x4CA82]` at `0x21534`. The firing dispatcher at `0x589A7` creates no projectile for that value. The old generic enemy shot was therefore incorrect for levels 2–3. Armed formations in levels 6/12 use type 1, level 14 uses type 3, and level 17 and the activated level-19 boss use type 6. Projectile art pointers are selected at `0x60A26`, `0x60B08`, and `0x60C46`. Ammo.03B shares the PlayerInfo palette at bank 172; the comment identifying that shared pointer as Particle.A.01h$C was incorrect.

Regression tests simulate target defeats to verify that all 20 levels finish without killing protected stage components. They also check weapon selection and projectile rendering, mine breakup, boss activation/retirement, delayed completion, and coin continuation. These simulations validate progression, not equivalence to a recorded DOS playthrough.

## Original audio

`../tools/convert_web_audio.py` renders all nine original `DATA/MUSIC*.DD` modules with the installed Extended Module Player/libxmp. `xmp` identifies these as **DSMI 1.4 AMF**. The local FFmpeg build lacks a tracker demuxer, so the conversion is AMF → xmp stereo PCM → FFmpeg Ogg Vorbis/MP3.

- 44,100 Hz stereo, linear interpolation, xmp amplification 0 to avoid mixer clipping.
- Ogg Vorbis quality 5 and MP3 VBR quality 2.
- One module traversal, naturally ending at the module loop; no arbitrary time truncation or fades.
- All 18 encoded files were decoded again without errors. All nine PCM renders are non-silent; peak amplitudes remain below full scale.
- Total rendered music: 1,161.48 seconds (19 minutes 21 seconds).
- `assets/audio/manifest.json` records titles, durations, rates, channels, peaks, RMS levels, SHA-256 hashes of the originals, and source addresses.
- Each `musicNN.txt` preserves decoder-reported module and instrument credits.
- These renders preserve libxmp's interpretation of AMF. They have not been compared with a recording of the original DOS C-library mixer, so they are not claimed bit-exact.

### Effects

`SOUND.DD` has four raw sample members. No header is discarded. WAV payloads and exported `.u8` files match the original member bytes exactly. Unsigned 8-bit mono interpretation is strongly supported by the waveforms centered on `0x80` and the sample loader. The original game chooses playback rate at each call site rather than storing one fixed rate in the raw file.

| Slot | Member | Bytes | Recovered rates (Hz) |
|---|---|---:|---|
| 0 | Sound.A.10 | 12,856 | 15,000 / 16,000 |
| 1 | Sound.G.03 | 10,725 | 22,000 / 22,050 (setup preview) |
| 2 | Sound.E.08 | 28,864 | 15,000 / 19,000 / 26,000 / 28,000 / 32,000 |
| 3 | Sound.E.06 | 14,749 | 25,000 |

Loader `0x2080B` builds 32-byte sample records from raw pointer/length. Callers of `0x2093A`, `0x20A03`, and `0x20ACC` pass slot in EAX, volume in ECX, panning in EDX, and playback frequency in EBX. Example: `0x572A5` passes slot 0 and 15,000 Hz; `0x5C0BD` passes slot 3 and 25,000 Hz. Each observed rate has a separate WAV preview. Browser playback uses decoded buffers and can reproduce pitch changes with `AudioBufferSourceNode.playbackRate`.

The campaign music byte table at `0x6F4DE` selects MUSIC02 (“Chromosphere”) for the opening levels. MUSIC01 (“Can you feel it?”) is available in the archive; original menu music starts with user interaction in this build's archive rather than autoplay.

`THEME.DD/u8_OTMTheme` remains unidentified and is not included as a guessed effect.

## Rebuild assets

From the repository root:

```sh
python3 tools/recover_gameplay_data.py   # original drop tables, random digits, exhaust and burst vectors
python3 tools/build_web_assets.py        # Pillow required; decodes unpacked/gdl source sprites
python3 tools/extract_sprites.py         # optional: regenerate standalone contact sheets
python3 -m unittest discover -s tools/tests -v  # palette/atlas regression checks; Pillow required
python3 tools/recover_web_levels.py      # capstone required; static evidence
python3 tools/convert_campaign.py        # capstone required; first 20 executable scripts
python3 tools/convert_web_audio.py       # xmp and ffmpeg on PATH; no Python dependencies
```

The asset builder uses the restricted x86 blit interpreter to decode original source members, so stale contact sheets cannot affect atlas colors. The standalone extractor still reports failures for unsupported copy/light variants and palette fallbacks for unresolved effects/fonts; those are not used in the web atlas. The audio converter reads SOUND.DD directly through the existing GDL parser. None of these scripts modify DOS assets.

## Next work toward full fidelity

1. Recover the original tick duration, input integration and player collision logic; compare side-by-side with DOS gameplay.
2. Translate the remaining level initializer control flow and per-frame callbacks from the recovered table. Do not treat static loader evidence as authored encounter schedules.
3. Recover exact enemy routes, advanced firing patterns, asteroid breakup velocities, and remaining health/damage rules.
4. Finish original weapon/upgrade effects and shop layout; port multiplayer modes and six-character level codes.
5. Verify dynamic palette effects, fonts, light/copy effects and exact audio mixing.

Original game/artwork © D-Designs, 1996. Original music credits remain in the exported module reports. The repository's COPYING.txt belongs to the bundled DOSBox distribution; it is not assumed to license Piranha's assets.

## Hold-to-slow modifier

Either Shift key gradually slows the entire simulation to half speed over 0.5 seconds; releasing both returns it to normal over 0.5 seconds. The wall-clock ramp scales time entering the existing fixed 70 Hz simulation, so movement, firing, animations, collisions, campaign events, and pickup lifetimes stay synchronized. Rendering continues at the display rate. Music and UI timing retain their normal pace. Pausing or leaving gameplay resets the speed, and focus loss clears held keys. Player two now fires with E, freeing Shift for the shared modifier.

## Mobile flight controls

Touch controls appear immediately below the playfield on narrow screens and devices with a coarse pointer. Hold Left/Right, Thrust, Brake, Fire, or Slow (half speed); each pointer is tracked independently, including multiple fingers on one button. Release, cancellation, capture loss, pause, menus, and focus loss clear the appropriate inputs and pressed feedback. Touch controls operate player one; slow motion affects the whole game. Fullscreen includes the cabinet and controls, with a side panel on short landscape touch displays. Native text selection, dragging, context menus, and touch callouts are disabled within the cabinet; touch scrolling/zoom gestures are suppressed on the playfield and flight buttons. The settings and dialogs remain normal page controls. `tests/mobile-check.html` displays live 390px and 320px layouts for browser inspection; `tests/touch-controls.test.mjs` covers concurrent holds and input cleanup.

## Mobile landscape expansion

During a flight (including pause, game over, and the between-level shop), touch devices automatically enter a CSS viewport-filling mode in landscape. Portrait restores the page and its prior scroll position. Exit suppresses automatic re-entry until the next orientation change or fresh flight. Expand/F uses native fullscreen when available and falls back to the same CSS mode when the API is missing or rejects the request. Escape exits the CSS mode; returning to the title exits either mode. Desktop windows do not automatically expand.

The CSS mode retains the HUD, controls, pause, and exit buttons; on landscape touch displays they sit beside a playfield with the original 4:3 display aspect. Visual viewport updates follow browser toolbar changes, and `viewport-fit=cover` plus safe-area padding protect controls around notches and the home indicator. The browser itself controls its address bar: CSS expansion cannot force Safari chrome to disappear. Native fullscreen is only requested from the explicit button/key interaction, since [requestFullscreen requires transient user activation](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen#security_considerations). See also [WebKit's safe-area guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/).

`tests/fullscreen.test.mjs` covers orientation changes, unavailable/rejected APIs, native exit, opt-out, scroll restoration, and viewport resizing. `tests/fullscreen-check.html` simulates touch capability with native fullscreen unavailable while running the real game in a resizable iframe. Browser checks passed at 844×390 and 667×300: all controls fit and the playfield retains 4:3; portrait restores the page. This fixture is not a physical iPhone/Safari test.

## Level music startup and diagnostics

Launch now selects the level's soundtrack and calls the HTML media element's `play()` synchronously, before awaiting AudioContext resume or sound-effect loading. Previously playback was deferred until those asynchronous operations finished, and all play errors were discarded; this could violate Safari's user-gesture requirements. The independent media element and Web Audio effects context are both resumed as needed. Duplicate requests share pending playback, and stale play errors from a paused/replaced track cannot overwrite current state.

Blocked or failed playback turns the sound button into **Enable music**, which retries from a direct interaction instead of muting. Muting also sets the media element's `muted` property. The debug panel and JSON snapshots show track, playback state/time and errors; `piranha.audio` returns an independent status object. Levels 1–9 use music 2, levels 10–19 use music 3, and level 20 uses music 4. Browser checks confirmed advancing playback on levels 1 and 10 and position-preserving pause/resume; audio tests cover gesture ordering, retry, stale promises, codec selection, mute and archive suppression.
