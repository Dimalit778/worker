import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { assertManagedDatabase, DEFAULT_WORKTREE_APP_PORT, freePort, gitContext, guardPrismaWorktree, schemaDigest, worktreeAppPort } from '../scripts/worktree-safety.mjs';

const dir = realpathSync(mkdtempSync(join(tmpdir(), 'worktree-tooling-')));
const primary = join(dir, 'main repo');
const linked = join(dir, 'linked tree');
mkdirSync(primary);
const git = (...args: string[]) => execFileSync('git', ['-C', primary, ...args], { stdio: 'pipe' });
git('init', '--initial-branch=main');
mkdirSync(join(primary, 'prisma/migrations/initial'), { recursive: true });
writeFileSync(join(primary, 'prisma/schema.prisma'), 'fixture schema');
writeFileSync(join(primary, 'prisma/migrations/initial/migration.sql'), 'fixture migration');
git('add', '.');
git('-c', 'user.email=test@example.invalid', '-c', 'user.name=Test', 'commit', '-m', 'fixture');
git('worktree', 'add', '-b', 'feature', linked);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function stateFor(root = linked) {
  return { root, id: 'wt_123456abcdef', dbPort: 55432, dataDir: join(root, '.worktree-dev/postgres'), databaseUrl: 'postgresql://wt_123456abcdef:local-password@127.0.0.1:55432/wt_123456abcdef_dev', approved: '' };
}
const envFor = (state: ReturnType<typeof stateFor>) => ({ DATABASE_URL: state.databaseUrl, DIRECT_URL: state.databaseUrl });

describe('worktree isolation and schema approval', () => {
  it('detects linked worktrees independent of Codex/Claude/Cursor path conventions, including spaces', () => {
    expect(gitContext(primary)).toMatchObject({ root: primary, primary, linked: false });
    expect(gitContext(linked)).toMatchObject({ root: linked, primary, linked: true });
  });
  it('accepts only the exact worktree-owned local database', () => {
    const state = stateFor();
    expect(() => assertManagedDatabase(state, envFor(state), linked)).not.toThrow();
    expect(() => assertManagedDatabase(state, { ...envFor(state), DATABASE_URL: 'postgresql://production.example/main' }, linked)).toThrow('DATABASE_URL');
    expect(() => assertManagedDatabase(state, { ...envFor(state), DIRECT_URL: 'postgresql://production.example/main' }, linked)).toThrow('DIRECT_URL');
    expect(() => assertManagedDatabase(state, envFor(state), primary)).toThrow('foreign');
    expect(() => assertManagedDatabase({ ...state, dataDir: '/tmp/some-other-cluster' }, envFor(state), linked)).toThrow('data directory');
  });
  it('refuses remote, shared-local, or option-overridden URLs even if stored in state', () => {
    for (const url of ['postgresql://wt_123456abcdef:pw@production.example:55432/wt_123456abcdef_dev', 'postgresql://wt_123456abcdef:pw@127.0.0.1:55432/main', 'postgresql://wt_123456abcdef:pw@127.0.0.1:55432/wt_123456abcdef_dev?host=production.example']) {
      const state = { ...stateFor(), databaseUrl: url };
      expect(() => assertManagedDatabase(state, envFor(state), linked)).toThrow('isolated');
    }
  });
  it('invalidates schema consent when schema or migration content changes', () => {
    const before = schemaDigest(linked);
    writeFileSync(join(linked, 'prisma/schema.prisma'), 'changed schema');
    expect(schemaDigest(linked)).not.toBe(before);
    const next = schemaDigest(linked);
    writeFileSync(join(linked, 'prisma/migrations/initial/migration.sql'), 'changed migration');
    expect(schemaDigest(linked)).not.toBe(next);
  });
  it('requires both explicit launcher approval and matching fingerprint for Prisma mutations', () => {
    const state = stateFor();
    mkdirSync(join(linked, '.worktree-dev'), { recursive: true });
    const save = () => writeFileSync(join(linked, '.worktree-dev/state.json'), JSON.stringify(state));
    save();
    expect(() => guardPrismaWorktree(linked, envFor(state), ['prisma', 'generate'])).not.toThrow();
    for (const args of [['migrate', 'deploy'], ['migrate', 'dev'], ['migrate', 'reset'], ['db', 'push'], ['db', 'execute']]) {
      expect(() => guardPrismaWorktree(linked, envFor(state), args)).toThrow('explicit approval');
    }
    const digest = schemaDigest(linked);
    const approvedEnv = { ...envFor(state), WORKTREE_SCHEMA_APPROVAL: digest };
    expect(() => guardPrismaWorktree(linked, approvedEnv, ['migrate', 'deploy'])).toThrow('explicit approval');
    state.approved = digest; save();
    expect(() => guardPrismaWorktree(linked, approvedEnv, ['migrate', 'deploy'])).not.toThrow();
    expect(() => guardPrismaWorktree(linked, { ...approvedEnv, WORKTREE_SCHEMA_APPROVAL: 'stale' }, ['migrate', 'deploy'])).toThrow();
    expect(() => guardPrismaWorktree(primary, {}, ['generate'])).not.toThrow();
  });
  it('selects another port if the preferred one is busy', async () => {
    const server = createServer();
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No listening address');
    try { expect(await freePort(address.port)).toBeGreaterThan(address.port); }
    finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
  it('defaults the app to 3001 and refuses to silently substitute a busy or database port', async () => {
    expect(DEFAULT_WORKTREE_APP_PORT).toBe(3001);
    const server = createServer();
    const testPort = await freePort(45000);
    await new Promise<void>(resolve => server.listen(testPort, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No listening address');
    try { await expect(worktreeAppPort(address.port)).rejects.toThrow('no alternative port'); }
    finally { await new Promise<void>(resolve => server.close(() => resolve())); }
    expect(await worktreeAppPort(address.port)).toBe(address.port);
    await expect(worktreeAppPort(address.port, [address.port])).rejects.toThrow('unavailable');
    for (const invalid of [NaN, 80, 65536, 3001.5]) {
      await expect(worktreeAppPort(invalid)).rejects.toThrow('Port must be');
    }
  });
  it('all three tool integrations run prepare, never unattended schema changes', () => {
    const codex = readFileSync('.codex/environments/environment.toml', 'utf8');
    const cursor = JSON.parse(readFileSync('.cursor/worktrees.json', 'utf8'));
    const claude = JSON.parse(readFileSync('.claude/settings.json', 'utf8'));
    expect(codex).toContain('prepare --hook');
    expect(cursor['setup-worktree']).toEqual(['node scripts/worktree.mjs prepare --hook']);
    expect(claude.hooks.SessionStart[0].hooks[0].command).toContain('worktree-setup.mjs');
    for (const config of [codex, JSON.stringify(cursor), JSON.stringify(claude)]) {
      expect(config).not.toMatch(/migrate deploy|db push|approve-schema=/);
    }
  });
});
