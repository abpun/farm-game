---
name: game-dev
description: Conventions for building browser game features in this Phaser + TypeScript farm game - audio cues and music, settings, visual effects and game feel, and how to verify them in headless Chromium. Use when adding gameplay feedback, sounds, effects, animations, settings, or when polishing UI in this repo.
---

# Game dev in this repo

Read `CLAUDE.md` first; this skill adds the working recipes.

## Adding feedback for a new gameplay action

1. The core action emits a typed event on success only (`core/events/GameEvents.ts`).
   Never emit before validation passes; failed actions return `fail(reason)`.
2. Sound: map the event to a cue in `src/audio/gameSounds.ts`, add the cue recipe to
   `src/data/sounds.json` (layers of oscillators or noise with envelopes). Give it a
   `cooldownMs` / `maxVoices` so bursts stay pleasant, and `duck` for jingles.
3. Visual: add a recipe to `phaser/fx/fxPalette.ts` (world) or `uiFxPalette.ts` (HUD)
   and trigger it from `WorldFx` / `UiFx`. Always go through the capped `ParticlePool`
   and check `effectsEnabled`, `reducedMotion`, `shakeEnabled` from `fx/prefs.ts`.
4. Keep feedback short (under ~1s) and never block input; repetitive actions must stay fast.
5. Refusals: show the reason (toast or float text in the error colour). Error toasts play
   the error cue and emit `Denied` on the UI bus so the HUD can point at the cause.

## Audio rules

- Only `AudioEngine` touches Web Audio. It unlocks on the first gesture, suspends while
  the tab is hidden, drops piled-up cues on return, and swallows every error.
- Music is chosen by `pickTrack` (season, fishing). New tracks go in `music.json` as
  chords plus bass/arp/melody/drum patterns; tests check bar lengths and ranges.
- Default mix: music under effects. Peak-normalised buffers make `gain` in data the
  real loudness, so compare new cues against existing ones of the same kind.

## Settings

Add a field to `core/settings/settings.ts` (default + `normalizeSettings` repair), a
setter in `SettingsStore`, a control in `ui/screens/SettingsScreen.ts` (register it with
the `FocusRing` for keyboard use), and a test. Only add options the game really honours.

## Verifying in the browser

- `npm run dev`, then drive Chromium with Playwright (`/opt/node-tools/node_modules/playwright`).
  Use the dev handles: `__farm` (session), `__audio`, `__settings`, `__game`.
- Click the canvas once before testing audio (autoplay unlock); `__audio.state` should
  be `running`. Wrap `__audio.play` to log which cues fire.
- Headless Chromium runs at a few fps with a fixed 16.7ms step, so effects last longer in
  wall time than in real use, and screenshots lag: set `scene.tweens.timeScale` low
  to catch a tween mid-flight.
- Finish with `npm run check` and `npm run build`.
