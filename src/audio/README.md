# Audio

All sound in the game is **synthesized in the browser** from the recipes in
`src/data/sounds.json` (cues), `src/data/music.json` (tracks) and
`src/data/ambience.json` (when ambient one-shots play). Nothing is downloaded,
so there are no third-party audio assets and no licensing or attribution to track.
The music is original, written for this game as note patterns in `music.json`.

## How it fits together

- `SoundBank` bakes every cue and loop into an `AudioBuffer` once at boot
  (`OfflineAudioContext`), short cues first. Loops fold their ringing tail back onto
  the start so they repeat seamlessly.
- `AudioEngine` owns the single `AudioContext`: channel buses (music, sfx, ambient),
  music crossfades and ducking, the voice limiter, autoplay unlock and tab handling.
- `gameSounds.ts` maps `GameEvents` to cue names; `AmbientScheduler` spaces ambience
  and only plays sources that exist (e.g. cows only once a cow lives on the farm).

## Replacing a sound with a recording

Add `"file": "audio/name.ogg"` to a cue in `sounds.json` or a track in `music.json`
and put the file in `public/audio/`. If the file is missing or cannot be decoded, a
warning is logged and the synthesized version plays instead. Record any licence and
attribution for files you add here.
