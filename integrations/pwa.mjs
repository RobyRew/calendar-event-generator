import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generateSW } from 'workbox-build';

// Offline support: precache the built client and serve index.html for app
// navigations. Replaces vite-plugin-pwa, whose Astro wrapper does not declare
// support for Astro 7; this is the same workbox generateSW step it ran.
// Server-handled paths are never answered from the cache.

/**
 * @param {{ base: string }} options
 * @returns {import('astro').AstroIntegration}
 */
export default function pwa({ base }) {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return {
    name: 'calgen:pwa',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        const { count, size, warnings } = await generateSW({
          globDirectory: outDir,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
          swDest: path.join(outDir, 'sw.js'),
          modifyURLPrefix: prefix === '/' ? undefined : { '': prefix },
          navigateFallback: `${prefix}index.html`,
          navigateFallbackDenylist: [/^\/api\//, /^\/feed\//, /^\/s\//],
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        });
        for (const w of warnings) logger.warn(w);
        logger.info(`service worker: ${count} files precached (${(size / 1024).toFixed(1)} KiB)`);
      },
    },
  };
}
