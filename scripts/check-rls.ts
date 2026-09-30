import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../src/generated/prisma/client';
config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
async function main() {
try {
  const role = await db.$queryRaw`SELECT current_user AS role, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user`;
  const tables = await db.$queryRaw`SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced, pg_get_userbyid(c.relowner)=current_user AS owned_by_connection FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname`;
  console.log(JSON.stringify({ role, tables, authorization: 'Server authorization is authoritative. Enabled RLS alone does not prove policy enforcement.' }, null, 2));
} finally { await db.$disconnect(); }

}
main().catch((error: unknown) => {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNAVAILABLE';
  console.error(`RLS inspection failed (${code}); verify database connectivity and privileges.`);
  process.exitCode = 1;
});
