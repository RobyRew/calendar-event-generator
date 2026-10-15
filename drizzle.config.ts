import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: (process.env.DB_URL || 'file:./data/calendar.db').replace(/^file:/, '') },
})
