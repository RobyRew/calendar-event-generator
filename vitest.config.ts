import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// `npm test` runs this suite three times under different host time zones
// (TZ=UTC, America/New_York, Europe/Bucharest): the generator and parser must
// produce identical results wherever they run, including the UTC server.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
})
