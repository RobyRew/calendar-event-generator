# syntax=docker/dockerfile:1.10
# ─────────────────────────────────────────────────────────────────────────────
# Build — Node 22. better-sqlite3 compiles a native addon, so python3/make/g++.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# Server target (default): app + accounts, API, feeds. .env.production carries
# the public analytics identifiers baked into the bundle.
RUN npm run build

# Keep only runtime dependencies (the compiled better-sqlite3 binding stays).
RUN npm prune --omit=dev

# ─────────────────────────────────────────────────────────────────────────────
# Runtime — Node server, non-root. The app moved off the static-web image when
# it gained accounts and live feeds; server.mjs sends the same security headers
# (scripts/security-headers.mjs).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    DB_URL=file:/app/data/calendar.db

RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/drizzle ./drizzle
COPY --from=build --chown=app:app /app/scripts ./scripts
COPY --from=build --chown=app:app /app/server.mjs ./server.mjs

# SQLite lives here. Bind-mount /opt/calendar-event-generator/data to this path
# in Dokploy, or every redeploy starts with an empty database.
RUN mkdir -p /app/data && chown app:app /app/data

USER app
EXPOSE 4321

# Liveness only: independent of Logto and of any sign-in round trip.
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4321/api/health || exit 1

# Migrations are idempotent; apply them, then serve.
CMD ["sh", "-c", "node ./scripts/migrate.mjs && node ./server.mjs"]
