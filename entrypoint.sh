#!/bin/sh
set -e

# Ensure data directories exist and are writable
mkdir -p /app/data/thumbnails /app/data/artwork 2>/dev/null || true
chown -R nextjs:nodejs /app/data 2>/dev/null || true
chmod -R 777 /app/data 2>/dev/null || true

# Execute as nextjs user if running as root
if [ "$(id -u)" = "0" ]; then
  exec chroot --userspec=nextjs:nodejs --skip-chdir / "$@"
else
  exec "$@"
fi
