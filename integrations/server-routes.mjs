// Registers the routes that need the Node server (auth, API, feeds, share pages).
// They live outside src/pages so the static GitHub Pages build never sees them:
// astro.config.mjs adds this integration only for BUILD_TARGET=server.

/** @type {{ pattern: string; entrypoint: string }[]} */
export const SERVER_ROUTES = [
  { pattern: '/api/health', entrypoint: './src/server-routes/api/health.ts' },
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
