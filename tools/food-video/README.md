# If Food Could Talk! — music video generator

An original children's song and 3D cartoon video, built entirely from code. Output:
`public/video/if-food-could-talk.mp4` (1920×1080, 24 fps, about 3 minutes).

```sh
tools/food-video/make.sh          # WORKERS=3 by default; frames go to tools/food-video/.build
```

## Pieces

- `song.py` writes the song: arrangement (116 BPM, C major), a backing band (Karplus–Strong
  ukulele, bass, glockenspiel, light drums) and the vocals. Lyrics go through eSpeak NG to
  MBROLA phonemes; each syllable's vowel is put on a melody note, so the voices sing in tune.
  Each food has its own voice. It also writes `timeline.json` (sections, beats, every sung
  syllable) that drives the animation.
- `scene/` is a three.js scene rendered deterministically at any song time:
  `characters.js` (Pizza Pete, Bella Banana, Carlo Carrot, Bobby Broccoli and their dances),
  `sets.js` (kitchen, party room, beach, garden, park, chorus stage, finale), `main.js` (shot
  list, lip sync, name cards, wipes).
- `render.mjs` drives headless Chromium through every frame; several workers can share the job.

## Song

Intro → each food is revealed and sings a verse in its own set → chorus on the star stage with
everyone met so far → double group chorus → goodbye.

> If food could talk, what would it say?
> Hello, hello, let's munch and play!
> Crunchy, munchy, yummy, yay!
> If food could talk, it'd talk all day!

The title font is Fredoka (SIL Open Font License, see `scene/fonts/FREDOKA-LICENSE`).
