# Farm Game

Idle farming sim in the browser. Phaser renders 2D, Three.js is reserved for later 3D. Vite + TypeScript.

## Commands

- `npm run dev` start dev server
- `npm run check` typecheck, lint, format check, tests (run before finishing any task)
- `npm run format` apply Prettier

## Architecture rules

- `src/core` is engine-agnostic: no imports from phaser, three, or ui (enforced by ESLint). Pure TS, unit-testable.
- `src/phaser` and `src/three` are renderers. They read core state and react to events; they hold no game rules.
- Each system in `core/systems` owns one concern. Cross-system flows go through `FarmService`; notifications go through the typed `EventBus`.
- Game content (crops, prices, timings, grid size) lives in `src/data/*.json`. Adding a crop means editing `crops.json` only.
- Time is passed in as `dt`; systems never read `Date.now()`.
- The farm is isometric: all grid↔screen math lives in `phaser/iso/IsoGrid.ts`; depth sorts by `col + row`.
- Art is procedural and baked to textures at boot (`phaser/art/*`). Crop looks come from `visual.kind` in `crops.json`; a new kind = one drawer in `CropArtist.ts`. Real sprites can replace a texture key without touching gameplay.
- In dev, `window.__farm` is the live `GameSession` (e.g. `__farm.update(60)` fast-forwards a minute); `__audio`, `__settings` and `__game` are also exposed.
- The save format is versioned (`core/save/saveFormat.ts`); bump `SAVE_VERSION` and add a migration when state shape changes. Never edit a shipped migration.
- Everything on the farm is a placed object (`WorldSystem`) defined in `data/catalog.json`; garden beds also have crop state in `PlotSystem`. Paths in `farm.json` are no-build zones.
- Seasons (`data/seasons.json`, `SeasonSystem`) scale crop growth via `seasonGrowth` in `crops.json` (0 = dormant). `GameSession.update` never lets one step cross a season boundary.
- Seasonal art: looks in `phaser/art/seasonLooks.ts`; season variants are baked as `key@season` and swapped on `SeasonChanged`.
- UI is built from widgets in `phaser/ui/widgets` (pixel 9-slice frames, Button, Panel, Drawer, Modal, Toasts). Dock entries in `ui/screens/Docks.ts`; features without `onOpen` show "Coming soon".
- Audio lives in `src/audio` (no Phaser imports, enforced by ESLint). Sounds and music are synthesized from `data/sounds.json` / `data/music.json` and baked to buffers at boot; a cue or track with a `file` uses that recording instead. Gameplay cues map from bus events in `audio/gameSounds.ts`, so they only play after an action succeeds. `AudioEngine` is the only Web Audio user: unlock on first gesture, suspend while the tab is hidden, never throws.
- Player settings (`core/settings`) are stored under their own key, separate from the save; read them live via `fx/prefs.ts`. Optional effects (`phaser/fx`) must check `effectsEnabled`/`reducedMotion`/`shakeEnabled` and use the capped `ParticlePool`.
- The valley is authored in `data/world.json` in map coordinates (east = col − row, south = col + row): coast, river and pond, paths, bridges, forests, features (cave, waterfall, harbor, chests, spots), islands. `phaser/map/WorldShape` classifies every grid cell into one terrain (`map/terrain.ts`: sea, sand, rock, grass, woods, path, fresh) held in a `TerrainGrid`; surface queries read that grid, so gameplay matches what is drawn. `Landmarks` places the features and dressing. Keep `tests/world.test.ts` green when editing the map.
- The ground is an isometric Phaser tilemap (`scenery/TerrainTiles`). Tiles sit on the dual grid (corners on cell centres), are picked by their four corner terrains, and are baked per season by `art/TilesetArtist` + `art/terrain/tilePainter` (bilinear corner blend, dithered edges, banks, foam). Rivers, paths and coast are just terrains; a new ground kind = a code in `terrain.ts` and a colour in `tilePainter`. Sea foam animates by swapping the tileset frame.
- Mining (`MiningService`, `data/mining.json`) and discoveries (`ExplorationService`, `data/exploration.json`) are core rules; the Mine is its own scene (the farm sleeps, the UI scene ticks the game clock). Boat fishing spots are reached through the harbor's sea chart.
- `docs/` holds the user's design docs; don't reformat them.
- Art direction: cozy Stardew-style isometric pixel art (see the `pixel-art` skill). One art-pixel scale (`PIXEL_SCALE`), no anti-aliasing, hue-shifted ramps.

## Code style

- Comments only when the why is non-obvious, max two lines. Prefer clear names.
- Small files, one responsibility, named exports, no `any`, `import type` for types.
- Early returns, no magic numbers (name a constant or move to data).
- Every core system gets a Vitest test.
