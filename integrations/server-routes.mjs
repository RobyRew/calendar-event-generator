// Registers the routes that need the Node server (auth, API, feeds, share pages).
// They live outside src/pages so the static GitHub Pages build never sees them:
// astro.config.mjs adds this integration only for BUILD_TARGET=server.

/** @type {{ pattern: string; entrypoint: string }[]} */
export const SERVER_ROUTES = [
  { pattern: '/api/health', entrypoint: './src/server-routes/api/health.ts' },
  { pattern: '/api/me', entrypoint: './src/server-routes/api/me.ts' },
  { pattern: '/api/auth/sign-in', entrypoint: './src/server-routes/api/auth/sign-in.ts' },
  { pattern: '/api/auth/callback', entrypoint: './src/server-routes/api/auth/callback.ts' },
  { pattern: '/api/auth/sign-out', entrypoint: './src/server-routes/api/auth/sign-out.ts' },
  { pattern: '/api/calendars', entrypoint: './src/server-routes/api/calendars/index.ts' },
  { pattern: '/api/calendars/[id]', entrypoint: './src/server-routes/api/calendars/calendar.ts' },
  { pattern: '/api/calendars/[id]/events', entrypoint: './src/server-routes/api/calendars/events.ts' },
  { pattern: '/api/calendars/[id]/import', entrypoint: './src/server-routes/api/calendars/import.ts' },
  { pattern: '/api/calendars/[id]/members', entrypoint: './src/server-routes/api/calendars/members.ts' },
  { pattern: '/api/shared', entrypoint: './src/server-routes/api/shared.ts' },
  { pattern: '/api/shares', entrypoint: './src/server-routes/api/shares/index.ts' },
  { pattern: '/api/shares/[id]', entrypoint: './src/server-routes/api/shares/share.ts' },
  { pattern: '/api/shares/[id]/rotate', entrypoint: './src/server-routes/api/shares/rotate.ts' },
  { pattern: '/api/share/[token]/accept', entrypoint: './src/server-routes/api/share/accept.ts' },
  { pattern: '/feed/[token].ics', entrypoint: './src/server-routes/feed.ts' },
  { pattern: '/s/[token]', entrypoint: './src/server-routes/share-page.astro' },
];

/** @returns {import('astro').AstroIntegration} */
export default function serverRoutes() {
  return {
    name: 'calgen:server-routes',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        for (const route of SERVER_ROUTES) injectRoute({ ...route, prerender: false });
      },
    },
  };
}
