# ===========================================
# Stage 1: Dependencies
# ===========================================
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Install build tools for native addons (better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# ===========================================
# Stage 2: Builder
# ===========================================
FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure data directory exists during build time for SQLite initialization
RUN mkdir -p /app/data

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN npm run build

# ===========================================
# Stage 3: Production Runner
# ===========================================
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# Install ffmpeg and curl for healthcheck & transcoding
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=9000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 nextjs

# Copy static assets and standalone server output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create data directory with write permissions for SQLite & thumbnails
RUN mkdir -p /app/data/thumbnails /app/data/artwork && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 9000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:9000/api/health || exit 1

CMD ["node", "server.js"]
