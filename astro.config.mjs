// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { houseDefaults } from '@robyrew/web-config/astro';
import { loadEnv } from 'vite';
import pwa from './integrations/pwa.mjs';
import serverRoutes from './integrations/server-routes.mjs';

// Two build targets from one codebase:
//   BUILD_TARGET=server (default) — Node server for calendar.robyrew.com: the app,
//     plus accounts, the API and the live calendar feeds.
//   BUILD_TARGET=static — the local-only app as plain files for GitHub Pages.
//     No server routes are registered, and PUBLIC_CLOUD=false hides every
//     account and sharing control, so the bundle never calls /api.
const target = process.env.BUILD_TARGET === 'static' ? 'static' : 'server';
const base = process.env.BASE_URL || '/';
const site = process.env.PUBLIC_SITE_URL || (target === 'static' ? 'https://robyrew.github.io' : 'https://calendar.robyrew.com');

// The analytics origin is allow-listed in the CSP only when analytics is configured
// (.env.production); CSP is not applied by the dev server.
const publicEnv = { ...loadEnv('production', process.cwd(), 'PUBLIC_'), ...process.env };
const umamiOrigin = (() => {
  try {
    return publicEnv.PUBLIC_UMAMI_SCRIPT_URL ? new URL(publicEnv.PUBLIC_UMAMI_SCRIPT_URL).origin : null;
  } catch {
    return null;
  }
})();

export default defineConfig({
  ...houseDefaults,
  site,
  base,
  output: target,
  adapter: target === 'server' ? node({ mode: 'standalone' }) : undefined,

  security: {
    // CSRF: reject cross-origin form posts. JSON API routes additionally require
    // a JSON content type, which a cross-site form cannot send.
    checkOrigin: true,
    // Astro hashes the inline scripts/styles it emits (the island loader is
    // inline) into a <meta> CSP on every page, recomputed on each build — no
    // hand-maintained hash list to go stale after an Astro upgrade. The server
    // adds the header-only directives (frame-ancestors, HSTS…) separately.
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        `connect-src 'self'${umamiOrigin ? ` ${umamiOrigin}` : ''}`,
        "manifest-src 'self'",
        "worker-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: {
        resources: ["'self'", ...(umamiOrigin ? [umamiOrigin] : [])],
      },
    },
  },

  integrations: [
    react(),
    ...(target === 'server' ? [serverRoutes()] : []),
    pwa({ base }),
  ],

  server: { port: 5173 },

  vite: {
    plugins: [tailwindcss()],
    define: {
      'import.meta.env.PUBLIC_CLOUD': JSON.stringify(target === 'server' ? 'true' : 'false'),
    },
    build: {
      target: 'safari16',
      cssTarget: 'safari16',
    },
  },
});
