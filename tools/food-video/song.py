"""If Food Could Talk! — original song: arrangement, backing band, sung vocals, timeline.

Writes into an output directory:
  music.wav     backing band (44.1 kHz stereo)
  vocals.wav    all sung parts
  mix.wav       band and voices together
  timeline.json sections, beats and per-character syllables for the animation

Singing: eSpeak NG turns each lyric line into MBROLA phonemes; every syllable's vowel is
placed on a melody note (pitch + length) and MBROLA renders the line. Each food has its own
voice and a formant lift (render low/slow, then speed up) for a brighter cartoon timbre.
"""

import json
import math
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np

SR = 44100
BPM = 116
BEAT = 60 / BPM
BAR = BEAT * 4
LEAD = 0.35  # seconds of room before a line for its first consonants
LINE_RMS = 0.2  # every sung line is levelled to this, so no voice is quieter than another

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- song structure

CHORDS = {
    "C": [48, 52, 55, 60, 64],
    "G": [43, 50, 55, 59, 62],
    "Am": [45, 52, 57, 60, 64],
    "F": [41, 48, 53, 57, 60],
    "Dm": [50, 53, 57, 62, 65],
}
PROGRESSIONS = {
    "intro": ["C", "Am", "F", "G"],
    "reveal": ["F", "G"],
    "verse": ["C", "Am", "F", "G", "C", "Am", "Dm", "G"],
    "chorus": ["C", "G", "Am", "F", "C", "G", "F", "C"],
    "outro": ["F", "G", "C", "C"],
}

CHORUS = [
    ("If food could talk, what would it say?", [64, 67, 67, 69, 67, 64, 62, 64]),
    ("Hello, hello, let's munch and play!", [64, 64, 67, 64, 65, 65, 67, 69]),
    ("Crunchy, munchy, yummy, yay!", [72, 71, 69, 67, 69, 71, 72]),
    ("If food could talk, it'd talk all day!", [64, 67, 67, 69, 67, 65, 62, 60]),
]
VERSE_TUNE = [
    [60, 60, 64, 64, 67, 67, 69, 67, 64],
    [65, 65, 69, 69, 67, 65, 64, 62],
    [60, 62, 64, 65, 67, 69, 67],
    [65, 65, 64, 62, 64, 65, 67, 67],
]
VERSES = {
    "pizza": [
        "I'm Pizza Pete, so round and cheesy,",
        "Slice me up, it's nice and easy!",
        "Pepperoni polka dots,",
        "I love a party, lots and lots!",
    ],
    "banana": [
        "I'm Bella Banana, sweet and bright,",
        "My yellow coat is snug and tight!",
        "Bend to the left, and bend to the right,",
        "Banana dance with all your might!",
    ],
    "carrot": [
        "I'm Carlo Carrot, crunchy and tall,",
        "I grow in the garden, best of all!",
        "Hop like a bunny, one, two, three,",
        "Carrots help your eyes to see!",
    ],
    "broccoli": [
        "I'm Bobby Broccoli, a tiny tree,",
        "Strong and healthy, just like me!",
        "Flex your muscles, stretch up high,",
        "Reach your branches to the sky!",
    ],
}
OUTRO = [
    ("Bye bye, friends, we'll see you soon!", [67, 64, 67, 64, 65, 62, 64, 60]),
    ("Let's munch along to this happy tune!", [60, 62, 64, 65, 67, 69, 71, 72, 72]),
]

# voice, octave shift, formant lift
VOICES = {
    "pizza": ("us2", -12, 1.08),
    "banana": ("us1", 0, 1.12),
    "carrot": ("us3", 0, 1.26),
    "broccoli": ("en1", -12, 1.05),
}
CAST_ORDER = ["pizza", "banana", "carrot", "broccoli"]


def build_sections():
    sections = [{"name": "intro", "kind": "intro", "bars": 4, "cast": []}]
    cast = []
    for food in CAST_ORDER:
        cast = cast + [food]
        sections.append({"name": f"{food}-reveal", "kind": "reveal", "bars": 2, "cast": [food]})
        sections.append({"name": f"{food}-verse", "kind": "verse", "bars": 8, "cast": [food]})
        if food != CAST_ORDER[-1]:
            sections.append({"name": f"chorus-{len(cast)}", "kind": "chorus", "bars": 8, "cast": cast})
    sections.append({"name": "finale-1", "kind": "chorus", "bars": 8, "cast": cast})
    sections.append({"name": "finale-2", "kind": "chorus", "bars": 8, "cast": cast})
    sections.append({"name": "outro", "kind": "outro", "bars": 4, "cast": cast})
    t = 0.0
    for s in sections:
        s["start"] = t
        s["end"] = t + s["bars"] * BAR
        t = s["end"]
    return sections


# ---------------------------------------------------------------- melody fitting


def rhythm(n):
    """Onsets (beats) for n syllables over a 2-bar line; the last one is held."""
    if n == 1:
        return [0.0], [6.0]
    span = 12  # eighths for all but the last syllable
    slots = [round(i * span / (n - 1)) for i in range(n - 1)]
    onsets = [s / 2 for s in slots] + [6.0]
    durs = [onsets[i + 1] - onsets[i] for i in range(n - 1)] + [1.6]
    return onsets, durs


def fit_tune(tune, n):
    if n == len(tune):
        return list(tune)
    return [tune[round(i * (len(tune) - 1) / max(1, n - 1))] for i in range(n)]


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ---------------------------------------------------------------- singing (MBROLA)

VOWEL_START = set("aeiouAEIOUV@{Q3")
MAX_CONSONANT = 0.085


def phonemes(text, voice):
    out = subprocess.run(
        ["espeak-ng", "-v", f"mb-{voice}", "-q", "--pho", text],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    result = []
    for line in out.splitlines():
        parts = line.split("\t")
        name = parts[0].strip()
        if not name or name == "_":
            continue
        dur = float(parts[1]) / 1000 if len(parts) > 1 and parts[1].strip() else 0.06
        result.append((name, dur))
    return result


def syllables(phs):
    """Group phonemes into syllables around vowels: (onset, vowel, coda)."""
    vowels = [i for i, (p, _) in enumerate(phs) if p[0] in VOWEL_START]
    sylls = []
    for k, vi in enumerate(vowels):
        prev = vowels[k - 1] if k else -1
        nxt = vowels[k + 1] if k + 1 < len(vowels) else len(phs)
        between_before = phs[prev + 1 : vi]
        if k == 0:
            onset = between_before
        else:
            onset = between_before[1:] if len(between_before) > 1 else between_before
        if k + 1 < len(vowels):
            after = phs[vi + 1 : nxt]
            coda = after[:1] if len(after) > 1 else []
        else:
            coda = phs[vi + 1 :]
        sylls.append((onset, phs[vi], coda))
    return sylls


def sing_line(text, voice_key, tune, line_start, transpose=0):
    """Returns (audio at SR, start time, syllable events) for one sung line."""
    voice, octave, lift = VOICES[voice_key]
    sylls = syllables(phonemes(text, voice))
    notes = fit_tune(tune, len(sylls))
    onsets, durs = rhythm(len(sylls))
    pho = []
    events = []
    cursor = 0.0
    for i, (onset, vowel, coda) in enumerate(sylls):
        hz = midi_hz(notes[i] + octave + transpose)
        start = LEAD + onsets[i] * BEAT
        length = durs[i] * BEAT
        onset_len = sum(min(d, MAX_CONSONANT) for _, d in onset)
        onset_start = max(cursor, start - onset_len)
        scale = (start - onset_start) / onset_len if onset_len > 0 else 1
        if onset_start > cursor + 0.001:
            pho.append(("_", onset_start - cursor, None))
        for name, d in onset:
            pho.append((name, min(d, MAX_CONSONANT) * scale, hz))
        coda_len = sum(min(d, MAX_CONSONANT) for _, d in coda)
        vowel_len = max(0.07, length * 0.9 - coda_len)
        pho.append((vowel[0], vowel_len, hz))
        for name, d in coda:
            pho.append((name, min(d, MAX_CONSONANT), hz))
        cursor = start + vowel_len + coda_len
        events.append([line_start - LEAD + start, line_start - LEAD + start + vowel_len, notes[i]])
    pho.append(("_", 0.2, None))
    with tempfile.TemporaryDirectory() as tmp:
        pho_path = os.path.join(tmp, "line.pho")
        raw = os.path.join(tmp, "raw.wav")
        lifted = os.path.join(tmp, "lifted.wav")
        with open(pho_path, "w") as f:
            for name, dur, hz in pho:
                ms = max(10, round(dur * 1000 * lift))
                if hz is None:
                    f.write(f"_ {ms}\n")
                    continue
                low = hz / lift
                if dur > 0.3:
                    points = " ".join(
                        f"{p} {low * (1 + 0.012 * math.sin(p / 100 * dur * 2 * math.pi * 5.5) * (p > 35)):.1f}"
                        for p in range(0, 101, 10)
                    )
                else:
                    points = f"0 {low:.1f} 100 {low:.1f}"
                f.write(f"{name} {ms} {points}\n")
        subprocess.run(
            ["mbrola", "-e", f"/usr/share/mbrola/{voice}/{voice}", pho_path, raw],
            check=True,
            capture_output=True,
        )
        rate = 16000 if voice != "en1" else 16000
        subprocess.run(
            [
                "ffmpeg", "-y", "-loglevel", "error", "-i", raw,
                "-af", f"asetrate={rate * lift:.0f},aresample={SR}",
                "-ac", "1", lifted,
            ],
            check=True,
        )
        audio = read_wav(lifted)
    voiced = audio[np.abs(audio) > 0.01]
    if voiced.size:
        audio = audio * (LINE_RMS / float(np.sqrt(np.mean(voiced**2))))
    return audio, line_start - LEAD, events


def read_wav(path):
    with wave.open(path) as w:
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32)
        if w.getnchannels() == 2:
            data = data.reshape(-1, 2).mean(axis=1)
    return data / 32768


# ---------------------------------------------------------------- instruments


def env(n, attack, decay_time):
    t = np.arange(n) / SR
    a = np.minimum(1, t / max(attack, 1e-4))
    return a * np.exp(-t / decay_time)


def pluck(freq, length, bright=0.5):
    """Karplus–Strong ukulele string, computed one delay-line block at a time."""
    n = int(length * SR)
    period = max(2, int(SR / freq))
    rng = np.random.default_rng(int(freq * 100))
    out = np.zeros(n + period + 1, dtype=np.float32)
    burst = rng.uniform(-1, 1, period)
    burst = np.convolve(burst, [bright, 1 - bright], mode="same")
    out[:period] = burst
    pos = period
    while pos < n:
        end = min(pos + period, n)
        prev = out[pos - period : end - period + 1]
        out[pos:end] = 0.996 * 0.5 * (prev[:-1] + prev[1:])[: end - pos]
        pos = end
    return out[:n] * env(n, 0.002, 0.45)


def bass_note(freq, length):
    n = int(length * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(4 * np.pi * freq * t)
    return tone * env(n, 0.005, 0.35)


def bell(freq, length):
    n = int(length * SR)
    t = np.arange(n) / SR
    partials = [(1, 1), (2.76, 0.35), (5.4, 0.12)]
    tone = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t * (2 + r)) for r, a in partials)
    return tone * env(n, 0.002, 0.9)


def kick():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    f = 50 + 90 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 10)


def clap(seed):
    n = int(0.18 * SR)
    rng = np.random.default_rng(seed)
    noise = rng.uniform(-1, 1, n)
    noise = noise - np.convolve(noise, np.ones(8) / 8, mode="same")
    return noise * env(n, 0.001, 0.06)


def shaker(seed):
    n = int(0.06 * SR)
    noise = np.random.default_rng(seed).uniform(-1, 1, n)
    noise = noise - np.convolve(noise, np.ones(3) / 3, mode="same")
    return noise * env(n, 0.004, 0.02)


def pop():
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    f = 300 + 1400 * t / 0.25
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.003, 0.08)


def add(track, sound, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= track.shape[0] or i + len(sound) <= 0:
        return
    j = min(track.shape[0], i + len(sound))
    start = max(0, i)
    seg = sound[start - i : j - i] * gain
    track[start:j, 0] += seg * math.sqrt(0.5 * (1 - pan))
    track[start:j, 1] += seg * math.sqrt(0.5 * (1 + pan))


# ---------------------------------------------------------------- arrangement


def arrange(sections):
    total = sections[-1]["end"] + 3
    music = np.zeros((int(total * SR), 2), dtype=np.float32)
    vocals = np.zeros((int(total * SR), 2), dtype=np.float32)
    sung = {food: [] for food in CAST_ORDER}
    beats = []
    for s in sections:
        prog = PROGRESSIONS[s["kind"]]
        for b in range(s["bars"]):
            bar_start = s["start"] + b * BAR
            chord = CHORDS[prog[b % len(prog)]]
            root = chord[0]
            for beat in range(4):
                beats.append(bar_start + beat * BEAT)
            quiet = s["kind"] == "intro" and b < 2
            # ukulele strums: down, up-down-up pattern
            for at, up in [(0, False), (1.5, True), (2, False), (3, False), (3.5, True)]:
                strings = chord[1:] if not up else chord[1:][::-1]
                for k, note in enumerate(strings):
                    add(music, pluck(midi_hz(note + 12), 0.7), bar_start + at * BEAT + k * 0.012,
                        0.16 if not up else 0.1, -0.3)
            # bass
            if not quiet:
                for at, offset in [(0, 0), (2, 7), (3.5, 12)]:
                    add(music, bass_note(midi_hz(root - 12 + offset), BEAT * 1.4), bar_start + at * BEAT, 0.42)
            # drums
            if s["kind"] != "intro" or b >= 2:
                for at in (0, 2):
                    add(music, kick(), bar_start + at * BEAT, 0.55)
                for at in (1, 3):
                    add(music, clap(int(bar_start * 10) + at), bar_start + at * BEAT, 0.22, 0.15)
                for k in range(16):
                    add(music, shaker(k + b), bar_start + k * BEAT / 4, 0.05 if k % 2 else 0.08, 0.4)
            # reveal: drum roll into a pop and a sparkle
            if s["kind"] == "reveal":
                if b == 1:
                    for k in range(8):
                        add(music, clap(k), bar_start + 2 * BEAT + k * BEAT / 4, 0.08 + 0.02 * k, -0.2)
                    for k, note in enumerate([72, 76, 79, 84]):
                        add(music, bell(midi_hz(note), 1.2), bar_start + 3 * BEAT + k * 0.06, 0.12, 0.3)
            if s["kind"] == "intro" and b == 0:
                for k, note in enumerate([60, 64, 67, 72, 76, 79]):
                    add(music, bell(midi_hz(note), 1.5), bar_start + k * BEAT / 2, 0.12, 0.2)
        if s["kind"] == "reveal":
            add(music, pop(), s["end"] - 0.05, 0.25)

        lines = []
        if s["kind"] == "verse":
            food = s["cast"][0]
            lines = [(text, VERSE_TUNE[i], [food]) for i, text in enumerate(VERSES[food])]
        elif s["kind"] == "chorus":
            lines = [(text, tune, s["cast"]) for text, tune in CHORUS]
        elif s["kind"] == "outro":
            lines = [(text, tune, s["cast"]) for text, tune in OUTRO]
        for i, (text, tune, singers) in enumerate(lines):
            line_start = s["start"] + i * 2 * BAR
            gain = 0.95 / math.sqrt(len(singers))
            for k, food in enumerate(singers):
                audio, at, events = sing_line(text, food, tune, line_start)
                pan = 0 if len(singers) == 1 else (k / (len(singers) - 1) - 0.5) * 0.6
                add(vocals, audio, at, gain, pan)
                sung[food].extend(events)
            # a soft glockenspiel doubles the tune so it is easy to follow
            onsets, durs = rhythm(len(tune))
            for (o, d), note in zip(zip(onsets, durs), tune):
                add(music, bell(midi_hz(note + 12), d * BEAT + 0.4), line_start + o * BEAT, 0.035, 0.2)
    return music, vocals, sung, beats, total


def write_wav(path, data):
    peak = max(1e-6, float(np.max(np.abs(data))))
    data = data / peak * 0.89
    pcm = (np.clip(data, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "w") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    sections = build_sections()
    music, vocals, sung, beats, total = arrange(sections)
    # Keep the band well under the voices: scale each to a fixed RMS before the mix.
    def rms(x):
        return float(np.sqrt(np.mean(x[np.abs(x) > 1e-4] ** 2))) if np.any(np.abs(x) > 1e-4) else 1.0

    music *= 0.11 / rms(music)
    vocals *= 0.2 / rms(vocals)
    write_wav(os.path.join(OUT, "music.wav"), music)
    write_wav(os.path.join(OUT, "vocals.wav"), vocals)
    write_wav(os.path.join(OUT, "mix.wav"), music + vocals)
    timeline = {
        "bpm": BPM,
        "beat": BEAT,
        "bar": BAR,
        "duration": total,
        "sections": sections,
        "beats": beats,
        "sung": sung,
        "lyrics": {
            "chorus": [t for t, _ in CHORUS],
            "verses": VERSES,
            "outro": [t for t, _ in OUTRO],
        },
    }
    with open(os.path.join(OUT, "timeline.json"), "w") as f:
        json.dump(timeline, f)
    print(f"song: {total:.1f}s, {len(beats)} beats")


if __name__ == "__main__":
    main()
