#!/bin/sh
set -eu

MOVIEFLIX_FFMPEG_BIN="${FFMPEG_PATH:-/usr/bin/ffmpeg}"
if [ ! -x "$MOVIEFLIX_FFMPEG_BIN" ]; then
  echo "[fatal] FFmpeg is missing or not executable: $MOVIEFLIX_FFMPEG_BIN" >&2
  exit 1
fi
if ! "$MOVIEFLIX_FFMPEG_BIN" -hide_banner -encoders 2>/dev/null | grep -q 'libx264'; then
  echo "[fatal] FFmpeg does not provide the required libx264 encoder." >&2
  exit 1
fi

mkdir -p /app/data/thumbnails /app/data/artwork /app/data/transcode-temp
chown -R node:node /app/data
exec su-exec node "$@"
