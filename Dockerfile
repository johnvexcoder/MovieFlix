# Multi-stage build.
# Node 22 is required (better-sqlite3@13 needs >=22 ) and the Next.js production
# build runs with a BOUNDED heap so it fits on low-RAM hosts (ram+swap).
# If the host has < 3GB of ram+swap, add a swapfile BEFORE building (see README).

# ----------  Builder ----------
FROM node:22-alpine AS builder

# Python + build tools are required to compile better-sqlite3 (node-gyp).
# The Alpine mirror index fetch occasionally fails with a transient DNS error
# on home-lab hosts; retry a few times before giving up so a single blip does
# not abort the entire update.
RUN i=1; until apk add --no-cache python3 make g++; do \
      if [ "$i" -ge 5 ]; then echo "apk add failed after 5 attempts" >&2; exit 1; fi; \
      echo "apk add attempt $i failed, retrying..."; sleep 6; i=$((i+1)); \
    done

WORKDIR /app

# Bound the heap so the compiler does not balloon into swap and stall the host.
# 1536 MB gives the webpack TypeScript checker enough headroom (its peak during
# a cold build comes within ~10 MB of the old 1024 MB cap) while still fitting
# comfortably on hosts with >= 3 GB of ram+swap (see install.sh swap_check).
# Official Node images already include matching C/C++ headers in /usr/local.
# Point node-gyp there so native modules never need unofficial-builds.nodejs.org.
ENV NODE_OPTIONS=--max-old-space-size=1536 \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_BUILD_PARALLEL=1 \
    npm_config_nodedir=/usr/local

# Install dependencies from the lockfile.
# ffmpeg-static runs a postinstall that downloads a ~30 MB ffmpeg binary from
# GitHub with a fixed 30s timeout. Production never uses it (native ffmpeg is
# installed in the runner stage and FFMPEG_PATH=/usr/bin/ffmpeg is always set),
# so point FFMPEG_BIN at an existing empty file to make the postinstall skip
# the download. The binary is also not copied into the standalone output.
ENV FFMPEG_BIN=/usr/local/bin/ffmpeg
RUN touch /usr/local/bin/ffmpeg
COPY package*.json ./
RUN npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

# Copy source (data/thumbs etc. are git-ignored / injected at runtime)
COPY . .

# Build the Next.js standalone output. Webpack uses substantially less memory
# for this filesystem-heavy server than Turbopack, which traces media paths and
# can exhaust the 1 GB builder heap on small production VMs.
RUN npm run build -- --webpack \
    # Ensure /app/data dirs exist inside the image so the runtime mounts cleanly
    && mkdir -p /app/data/thumbnails /app/data/artwork /app/data/transcode-temp

# ----------  Runtime ----------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=9000 \
    NODE_OPTIONS=--max-old-space-size=512

RUN i=1; until apk add --no-cache su-exec ffmpeg; do \
      if [ "$i" -ge 5 ]; then echo "apk add failed after 5 attempts" >&2; exit 1; fi; \
      echo "apk add attempt $i failed, retrying..."; sleep 6; i=$((i+1)); \
    done

# Copy the standalone server (includes a bundled subset of node_modules,
# including better-sqlite3's prebuilt linux-musl binary)
COPY --from=builder /app/.next/standalone ./
# Copy the static assets the standalone server references
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY docker-entrypoint.sh /usr/local/bin/movieflix-entrypoint

# Ensure writable directories exist for the SQLite DB / thumbnails / artwork
RUN mkdir -p /app/data/thumbnails /app/data/artwork /app/data/transcode-temp \
    && chown -R node:node /app/data \
    && chmod 755 /usr/local/bin/movieflix-entrypoint

EXPOSE 9000

ENTRYPOINT ["movieflix-entrypoint"]
CMD ["node", "server.js"]
