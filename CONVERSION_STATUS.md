# Conversion status — 6 September 2026

This is a playable port of the normal campaign's first 20 levels, with original extracted graphics and audio. It is not yet a complete or timing-identical conversion of the original 100-level game.

| Area | Current state | Still missing or unverified |
| --- | --- | --- |
| Campaign | The first 20 initializers, reachable progression callbacks, wave gates and completion rules run through the recovered instruction interpreter. | Levels 21–100. The level-19 pattern-queue host call at `0x90D29` is explicitly a no-op in `src/campaign.js`; boss progression exists, but its full attack behavior is incomplete. |
| Movement and timing | Fixed 70 Hz simulation, original rotation artwork/hotspots and recovered asteroid animation counters. | Original hardware tick duration, exact thrust/drag/turning values, enemy paths, firing cadence, breakup velocities and random-call ordering need DOS comparison. |
| Weapons and shop | Original enemy weapon selection, normal-shot damage, recovered shop prices; repairs, extra ships, three browser weapon tiers, ammo and engine upgrades. | Remaining original weapon families, extra-energy capacity, exact upgrade effects and original shop presentation. Health/damage/economy and several enemy patterns remain adaptations. |
| Modes and interface | Normal campaign, one to three local pilots, original normal title art, browser menus/HUD and level selection. | League/other original modes, six-character level codes and exact DOS interface behavior. Current co-op is an adaptation. |
| Graphics | Original atlas artwork, recovered palettes and per-frame origins. | Dynamic palette changes, original fonts and remaining copy/light effects; visual fidelity still needs side-by-side validation. |
| Sound | All nine modules rendered to browser music formats; four original PCM samples extracted. | Original mixer/interpolation/panning/pitch/event behavior is not fully replicated. `THEME.DD/u8_OTMTheme` is still unidentified. |
| Collision | CPU object-ID layer and per-frame bit masks, with conservative circle rejection and swept bullet sampling. | Original colored-map ownership rules and sparse grid sampler are not reproduced exactly. See below. |

Progression tests establish that the implemented scripts can complete; they do not establish parity with recorded DOS gameplay.

Requested browser changes are deliberate: Easy's doubled health, coin continues, extended pickup lifetimes and pickup-gated completion, selecting a starting level, smooth residual asteroid rotation, visible ship wrapping and wrapped firing origins, Shift slow motion, touch controls, and mobile landscape expansion. These should be kept separate from accidental fidelity gaps when comparing versions.

## Collision implementation

- `src/collision.js` decodes one-bit masks into reusable row spans. Separate original `$M` members supply ship 1, Enemy.G.03a and several projectile masks. Other groups use every artwork pixel with alpha greater than zero. Mask dimensions and hotspots can differ from the visible sprite; the engine respects those differences. `atlas.json` records the source for every group.
- The bullet target layer is a reusable **576 × 456 `Uint16Array`**, comprising the **320 × 200** visible field plus **128-pixel gutters**. Zero is empty. Actor IDs are 1–264; player IDs are 265–267. Solid actors are stamped first and players last. Wrapped player copies share the same ID and are clipped to the visible field. Transparent mask pixels preserve the object underneath.
- Conservative circles only reject distant candidates. Bullet mask pixels are then tested against candidate IDs in the layer. Bullets move in samples no farther than one pixel per axis, reducing tunneling. The firing actor is excluded using its pool generation; co-op friendly fire is disabled. Enemy fire is absorbed by other solid actors without damaging them.
- Ship/actor contacts and pickup collection use direct mask overlap after circle rejection. Pickups and visual effects are absent from the bullet-blocking layer. Invulnerable ships remain solid even during their visual blink. Deaths, splits, respawns, level loads and coin continues refresh collision placements/layer as appropriate.
- **Limits:** collisions use discrete animation frames even while asteroids render a fractional rotation. Bullets are swept against actors at their updated positions, not continuously swept against both objects' trajectories. The original sparse collision grid and layer ownership semantics still need tracing and DOS comparison. Exhaustive pixel overlap can therefore disagree with DOS even when the underlying mask is identical.

The normal runtime performs no canvas or WebGL pixel readback for collision. Debug rendering is a separate optional Canvas 2D overlay; it does not supply physics input.

## Debug tools

Click **Debug** in the game console or press **F2**. F2 switches debugging off again; the panel's minus button hides only the panel so the overlay remains visible. The console button reopens a hidden panel. Controls stay inside native/mobile expanded mode, and the desktop panel sits beside the playfield when there is room.

- **Bullet ID layer:** colorizes the actual engine layer, with adjustable opacity and a layer-only view. Cyan identifies players; actor colors are deterministic. Colors are illustrative—inspect numeric IDs to distinguish objects reliably.
- **Conservative circles**, **origins and IDs**, **pickup/bullet masks**, and the **last 32 bullet hit points** can be shown separately. Recent hit markers are historical positions, not persistent objects. Wrapped player placements are included. Only the visible field is drawn; the console API can return gutters too.
- **Pause/Resume**, **Step (F3)** and **1× / ½× / ¼× / ⅒×** speed controls support close inspection. Step pauses a running game and advances exactly one 70 Hz tick with neutral input. Real clear/game-over transitions are preserved. Debug speed multiplies the Shift modifier and resets to 1× when debugging is disabled.
- The panel reports simulation ticks/time, pool use, callback address, wave/completion/pickup state, game events, and the last physics tick's shot queries, circle tests, pixels tested, bullet hits and contact overlaps. Overlaps do not necessarily inflict damage, for example during invulnerability. Update timing is simulation work per render frame, excluding rendering/debug UI; it is not an end-to-end benchmark.
- Tap/click the playfield to inspect the topmost collision-layer ID, or use the object dropdown for pickups, projectiles and offscreen actors. The inspector includes position, velocity, health, source mask, frame, dimensions, origin, conservative radius and pool generation where applicable.
- **Save state JSON** exports a diagnostic snapshot, not a restorable save game. **Save layer PNG** exports the visible 320 × 200 colorized collision layer with transparent empty pixels.

Browser console API:

```js
piranha.debug.enable();               // Enable panel, overlay and counters.
piranha.debug.snapshot();             // Independent diagnostic object snapshot.
piranha.debug.layer();                // Copy: {width, height, originX, originY, ids}.
piranha.debug.layer(true);            // Same, including the 128-pixel gutters.
piranha.debug.inspect(160, 100);      // Inspect a visible layer pixel while enabled.
piranha.debug.step(1);                // Pause and step; accepts 1–70 ticks.
piranha.debug.enable(false);          // Disable; restore ordinary simulation speed.
```

Read-only snapshots and exported typed arrays are copies. Editing them does not edit the running game. Collision counters and bounded hit history are allocated only while debugging is enabled. Enabling debugging does not change RNG, damage, immunity, progression, masks or collision decisions. The explicit time controls do change how far the simulation advances.

Tests cover exact layer export/colorization, high IDs, copy isolation, recovered mask provenance, instrumentation without simulation changes, bounded history, fixed stepping and terminal-state preservation. The wider collision suite covers transparent gaps, player priority, animation changes, wrapped placements, shooter exclusion, slot reuse and swept bullet travel. Asset extraction and timing evidence are detailed in [PORTING.md](PORTING.md).
