import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createServer } from 'node:net';

export const DEFAULT_WORKTREE_APP_PORT = 3001;

export function gitContext(cwd) {
  const git = (...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const root = realpathSync(git('rev-parse', '--show-toplevel'));
  const gitDir = realpathSync(git('rev-parse', '--absolute-git-dir'));
  const commonDir = realpathSync(resolve(root, git('rev-parse', '--git-common-dir')));
  return { root, primary: resolve(commonDir, '..'), linked: gitDir !== commonDir };
}

export function schemaDigest(root) {
  const hash = createHash('sha256');
  hash.update(readFileSync(join(root, 'prisma/schema.prisma')));
  for (const name of readdirSync(join(root, 'prisma/migrations')).sort()) {
    const file = join(root, 'prisma/migrations', name, 'migration.sql');
    if (existsSync(file)) hash.update(name).update(readFileSync(file));
  }
  return hash.digest('hex');
}

export function assertManagedDatabase(state, env, root) {
  if (!state || state.root !== realpathSync(root) || !/^wt_[a-f0-9]{12}$/.test(state.id)) throw new Error('Missing or foreign worktree state. Run pnpm worktree:setup.');
  if (state.dataDir !== join(state.root, '.worktree-dev', 'postgres')) throw new Error('Invalid isolated PostgreSQL data directory.');
  const expected = new URL(state.databaseUrl);
  if (expected.protocol !== 'postgresql:' || expected.hostname !== '127.0.0.1' || expected.pathname !== `/${state.id}_dev` || expected.username !== state.id || !expected.password || Number(expected.port) !== state.dbPort || expected.search) throw new Error('Database must belong to this worktree’s isolated local cluster.');
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    if (env[key] !== state.databaseUrl) throw new Error(`${key} does not match the isolated worktree database. External/main databases are refused.`);
  }
}

/** Prisma CLI guard: inherited production URLs must never win over worktree configuration. */
export function guardPrismaWorktree(root, env, args = process.argv) {
  const context = gitContext(root);
  if (!context.linked) return;
  const file = join(context.root, '.worktree-dev/state.json');
  const state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  assertManagedDatabase(state, env, context.root);
  const mutation = args.includes('migrate') && args.some(arg => ['deploy', 'dev', 'reset', 'resolve'].includes(arg)) || args.includes('db') && args.some(arg => ['push', 'execute'].includes(arg));
  if (mutation && (env.WORKTREE_SCHEMA_APPROVAL !== schemaDigest(context.root) || state?.approved !== schemaDigest(context.root))) {
    throw new Error('Schema changes require explicit approval through pnpm worktree:dev or pnpm worktree:schema.');
  }
}

export async function portIsFree(port) {
  return new Promise(resolveFree => {
    const server = createServer();
    server.once('error', () => resolveFree(false));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => server.close(() => resolveFree(true)));
  });
}

export async function freePort(preferred = 3000, excluded = []) {
  for (let port = preferred; port < Math.min(65536, preferred + 200); port++) {
    if (!excluded.includes(port) && await portIsFree(port)) return port;
  }
  throw new Error('No available local port in the requested range.');
}

/** The app uses an exact port; PostgreSQL still selects its own free port. */
export async function worktreeAppPort(port = DEFAULT_WORKTREE_APP_PORT, excluded = []) {
  if (!Number.isInteger(port) || port < 1024 || port > 65335) throw new Error('Port must be between 1024 and 65335.');
  if (excluded.includes(port) || !await portIsFree(port)) {
    throw new Error(`Application port ${port} is unavailable. Free it or choose an explicit --port; no alternative port was selected.`);
  }
  return port;
}
