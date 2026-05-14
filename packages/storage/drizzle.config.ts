import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema/index.ts',
  out: './generated/drizzle',
  dbCredentials: {
    url: './contextbridge-storage.sqlite',
  },
});
