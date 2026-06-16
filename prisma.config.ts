import { resolve } from 'node:path';

import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

function datasourceUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Set DATABASE_URL (and DIRECT_URL for Neon migrations) in .env or .env.local.');
  }
  return url;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Prefer DIRECT_URL (non-pooled) for Migrate; fall back to DATABASE_URL for local / single-URL setups.
    url: datasourceUrl(),
  },
});
