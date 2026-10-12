#!/usr/bin/env bash
# Builds public/video/if-food-could-talk.mp4 from scratch: song → frames → encode.
# Needs: python3 + numpy, espeak-ng, mbrola (+ us1 us2 us3 en1 voices), ffmpeg, Playwright Chromium.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
work="${WORK:-$here/.build}"
workers="${WORKERS:-3}"
fps=24
out="$repo/public/video/if-food-could-talk.mp4"

mkdir -p "$work/frames" "$(dirname "$out")"
python3 "$here/song.py" "$work"
for ((w = 0; w < workers; w++)); do
  node "$here/render.mjs" "$work/timeline.json" "$work/frames" "$fps" "$w" "$workers" &
done
wait

# Two-pass loudness normalisation keeps the level steady (-16 LUFS, peaks under -1.5 dBTP).
measured=$(ffmpeg -hide_banner -i "$work/mix.wav" -af loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$measured" | sed -n "s/.*\"$1\" : \"\(.*\)\".*/\1/p"; }
ffmpeg -y -hide_banner -loglevel error -i "$work/mix.wav" \
  -af "loudnorm=I=-16:TP=-1.5:LRA=9:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true" \
  -ar 48000 "$work/mix-norm.wav"
ffmpeg -y -hide_banner -loglevel error -framerate "$fps" -i "$work/frames/f%05d.jpg" -i "$work/mix-norm.wav" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -profile:v high -r "$fps" \
  -c:a aac -b:a 192k -movflags +faststart -shortest "$out"
echo "wrote $out"
