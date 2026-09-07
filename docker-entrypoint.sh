#!/bin/sh
set -eu

mkdir -p /app/data/thumbnails /app/data/artwork /app/data/transcode-temp
chown -R node:node /app/data
exec su-exec node "$@"
