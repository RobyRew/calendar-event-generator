# syntax=docker/dockerfile:1.10
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# Shared runtime: pinned, non-root, port 8080, one security-header set.
# This app previously ran as ROOT on port 80 from an unpinned nginx:alpine, with
# no CSP, no HSTS, no Referrer-Policy and a deprecated X-XSS-Protection.
FROM ghcr.io/robyrew/static-web:1
# SPA: unknown paths serve index.html instead of 404ing, so client-side routes work.
ENV WEB_FALLBACK=/index.html
# Widen only the directives the analytics script needs, rather than restating the policy.
ENV CSP_SCRIPT_EXTRA="https://stats.cosmincalin.es" \
    CSP_CONNECT_EXTRA="https://stats.cosmincalin.es"
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
