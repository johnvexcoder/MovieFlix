# Multi-stage build.
# Node 22 is required (better-sqlite3@13 needs >=22 ) and the Next.js production
# build runs with a BOUNDED heap so it fits on low-RAM hosts (ram+swap).
# If the host has < 3GB of ram+swap, add a swapfile BEFORE building (see README).

# ----------  Builder ----------
FROM node:22-alpine AS builder

# Python + build tools are required to compile better-sqlite3 (node-gyp)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Bound the heap so the compiler does not balloon into swap and stall the host
# Official Node images already include matching C/C++ headers in /usr/local.
# Point node-gyp there so native modules never need unofficial-builds.nodejs.org.
ENV NODE_OPTIONS=--max-old-space-size=1024 \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_BUILD_PARALLEL=1 \
    npm_config_nodedir=/usr/local

# Install dependencies from the lockfile
COPY package*.json ./
RUN npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

# Copy source (data/thumbs etc. are git-ignored / injected at runtime)
COPY . .

# Build the Next.js standalone output
RUN npm run build \
    # Ensure /app/data dirs exist inside the image so the runtime mounts cleanly
    && mkdir -p /app/data/thumbnails /app/data/artwork /app/data/transcode-temp

# ----------  Runtime ----------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=9000 \
    NODE_OPTIONS=--max-old-space-size=512

RUN apk add --no-cache su-exec ffmpeg

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
