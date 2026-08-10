import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://bcba:bcba_dev_only@localhost:5432/bcba_workspace',
  },
  strict: true,
  verbose: true,
});
