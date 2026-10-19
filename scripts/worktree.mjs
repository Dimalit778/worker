#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, lstatSync, realpathSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { gitContext, schemaDigest, assertManagedDatabase, freePort } from './worktree-safety.mjs';

const command = process.argv[2] ?? 'dev';
const hook = process.argv.includes('--hook');
const context = gitContext(process.cwd());
const root = context.root;
const dir = join(root, '.worktree-dev');
const stateFile = join(dir, 'state.json');
const lock = join(dir, 'setup.lock');
const print = message => console.log(`[worktree] ${message}`);
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const launchCommand = `cd ${quote(root)} && pnpm worktree:dev`;
let state;
let locked = false;
const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });

function run(bin, args, env, capture = false) {
  try { return execFileSync(bin, args, { cwd: root, env, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' }); }
  catch { throw new Error(`${bin.split('/').at(-1)} ${args.slice(0, 2).join(' ')} failed. No external database was selected.`); }
}

function pgBin() {
  const candidates = [process.env.WORKTREE_PG_BIN];
  try { candidates.push(run('pg_config', ['--bindir'], process.env, true).trim()); } catch { /* Homebrew fallback */ }
  for (const base of ['/opt/homebrew/opt', '/usr/local/opt', '/usr/lib/postgresql']) {
    for (const version of ['18', '17', '16', '15', '14']) candidates.push(join(base, base.endsWith('postgresql') ? version : `postgresql@${version}`, 'bin'));
  }
  const found = candidates.find(path => path && ['initdb', 'pg_ctl', 'psql', 'createdb'].every(bin => existsSync(join(path, bin))));
  if (!found) throw new Error('Install PostgreSQL locally (macOS: brew install postgresql@16), or set WORKTREE_PG_BIN to its bin directory.');
  return found;
}

function writeEnv() {
  const target = join(root, '.env.local');
  if (existsSync(target)) {
    if (lstatSync(target).isSymbolicLink()) throw new Error('Refusing to overwrite a symlinked .env.local.');
    if (!readFileSync(target, 'utf8').startsWith('# Managed by scripts/worktree.mjs')) {
      const backup = join(dir, 'env.local.before-setup');
      if (existsSync(backup)) throw new Error('An unmanaged .env.local and a previous backup both exist. Resolve them before setup.');
      writeFileSync(backup, readFileSync(target), { mode: 0o600 });
      print('Saved the previous .env.local privately under .worktree-dev; its database settings are not used.');
    }
  }
  // Only this explicit, opt-in template is shared. Main .env/.env.local are never copied.
  const overrides = join(context.primary, '.env.worktree.local');
  const extra = existsSync(overrides) ? parseEnv(readFileSync(overrides, 'utf8')) : {};
  const protectedKeys = /(?:DATABASE|DIRECT_URL|SHADOW|AUTH|NODE_ENV|WORKTREE|^PORT$)/i;
  const values = Object.fromEntries(Object.entries(extra).filter(([key]) => !protectedKeys.test(key)));
  Object.assign(values, {
    DATABASE_URL: state.databaseUrl, DIRECT_URL: state.databaseUrl,
    NEXTAUTH_URL: `http://localhost:${state.appPort}`, NEXTAUTH_SECRET: state.authSecret,
    WORKTREE_DEV: '1', WORKTREE_ID: state.id,
  });
  writeFileSync(target, '# Managed by scripts/worktree.mjs — local isolated development only\n' + Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });
  chmodSync(target, 0o600);
  return values;
}

function environment(values) {
  // Explicit child env wins over inherited shell and every Next.js dotenv file.
  const env = { ...process.env, ...values, NODE_ENV: 'development' };
  delete env.SHADOW_DATABASE_URL;
  delete env.TEST_DATABASE_URL;
  return env;
}

async function prepare() {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { mkdirSync(lock); locked = true; writeFileSync(join(lock, 'pid'), String(process.pid)); }
  catch {
    let active = true;
    try { process.kill(Number(readFileSync(join(lock, 'pid'), 'utf8')), 0); } catch { active = false; }
    if (active) {
      if (hook) { print('An existing setup/server owns this worktree; reuse its environment.'); return null; }
      state = JSON.parse(readFileSync(stateFile, 'utf8'));
      assertManagedDatabase(state, { DATABASE_URL: state.databaseUrl, DIRECT_URL: state.databaseUrl }, root);
      if (['dev', 'default-dev'].includes(command) && state.serverPid) {
        try {
          process.kill(state.serverPid, 0);
          const response = await fetch(`http://127.0.0.1:${state.appPort}/login`, { signal: AbortSignal.timeout(5000) });
          if (response.ok) {
            print(`Already running: http://localhost:${state.appPort}`);
            print(`Demo manager: manager@worktree.test | employee: employee@worktree.test | password: ${state.demoPassword}`);
            return null;
          }
        } catch { /* still starting or stale; do not start a second server */ }
      }
      throw new Error('Another setup/start is in progress for this worktree. Reuse the running server, or stop it first.');
    }
    rmSync(lock, { recursive: true, force: true });
    mkdirSync(lock); locked = true; writeFileSync(join(lock, 'pid'), String(process.pid));
  }
  if (existsSync(stateFile)) state = JSON.parse(readFileSync(stateFile, 'utf8'));
  else {
    const id = 'wt_' + createHash('sha256').update(root).digest('hex').slice(0, 12);
    const dbPort = await freePort(55432);
    const password = randomBytes(24).toString('hex');
    state = { root, id, dataDir: join(dir, 'postgres'), dbPort, appPort: await freePort(3000, [dbPort]),
      databaseUrl: `postgresql://${id}:${password}@127.0.0.1:${dbPort}/${id}_dev`,
      authSecret: randomBytes(32).toString('hex'), demoPassword: '12345' };
    save();
  }
  assertManagedDatabase(state, { DATABASE_URL: state.databaseUrl, DIRECT_URL: state.databaseUrl }, root);
  let values = writeEnv();
  const env = environment(values);
  const modules = join(root, 'node_modules');
  if (existsSync(modules) && (lstatSync(modules).isSymbolicLink() || realpathSync(modules) !== modules)) throw new Error('node_modules must be installed inside the worktree; shared symlinks are refused.');
  const dependencyHash = createHash('sha256').update(readFileSync(join(root, 'pnpm-lock.yaml'))).update(readFileSync(join(root, 'package.json'))).digest('hex');
  if (!existsSync(join(modules, '.modules.yaml')) || state.dependencies !== dependencyHash) {
    run('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts', '--prefer-offline'], env);
    // Only the known native/build packages needed by this project; no application postinstall.
    run('pnpm', ['rebuild', 'esbuild', 'sharp', '@prisma/engines'], env);
    state.dependencies = dependencyHash; save();
  }
  const digest = schemaDigest(root);
  if (state.generated !== digest || !existsSync(join(root, 'src/generated/prisma/client.ts'))) {
    run('pnpm', ['exec', 'prisma', 'generate', '--generator', 'client'], env);
    state.generated = digest; save();
  }
  print(`Prepared ${state.id}. ${state.applied === digest ? 'Schema is ready.' : 'Schema approval is pending; no migrations have run.'}`);
  print(`Run: ${launchCommand}`);
  return { env, digest };
}

async function consent(digest) {
  if (state.applied === digest) return;
  print(`Schema changes: apply this checkout’s migrations to isolated local database ${state.id}_dev only.`);
  print(`Worktree: ${root}\nSchema fingerprint: ${digest}`);
  const approval = process.argv.find(arg => arg.startsWith('--approve-schema='));
  if (approval) {
    if (approval.slice('--approve-schema='.length) !== digest) throw new Error('Schema approval fingerprint does not match this checkout.');
    state.approved = digest; save(); return;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Schema approval required. Run pnpm worktree:dev in your terminal and approve the prompt.');
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await terminal.question('Apply migrations to this isolated database? Type APPLY to approve: ');
    if (answer !== 'APPLY') throw new Error('Schema changes were not approved.');
    state.approved = digest; save();
  } finally { terminal.close(); }
}

async function startDatabase(env) {
  const bin = pgBin();
  if (!existsSync(join(state.dataDir, 'PG_VERSION'))) {
    const pwfile = join(dir, 'postgres-password');
    writeFileSync(pwfile, decodeURIComponent(new URL(state.databaseUrl).password), { mode: 0o600 });
    try { run(join(bin, 'initdb'), ['-D', state.dataDir, '-U', state.id, '-A', 'scram-sha-256', '--pwfile', pwfile, '--no-locale', '-E', 'UTF8'], env, true); }
    finally { rmSync(pwfile, { force: true }); }
  }
  let running = false;
  try { run(join(bin, 'pg_ctl'), ['-D', state.dataDir, 'status'], env, true); running = true; } catch { /* stopped */ }
  if (!running) {
    state.dbPort = await freePort(state.dbPort, [state.appPort]);
    const url = new URL(state.databaseUrl); url.port = String(state.dbPort); state.databaseUrl = url.toString(); save();
    Object.assign(env, writeEnv());
    run(join(bin, 'pg_ctl'), ['-D', state.dataDir, '-l', join(dir, 'postgres.log'), '-o', `-p ${state.dbPort} -h 127.0.0.1 -k ''`, '-w', 'start'], env, true);
  }
  // Status is for our own data directory; never reuse an arbitrary localhost server.
  const pgEnv = { ...env, PGPASSWORD: decodeURIComponent(new URL(state.databaseUrl).password) };
  const args = ['-h', '127.0.0.1', '-p', String(state.dbPort), '-U', state.id];
  const exists = run(join(bin, 'psql'), [...args, '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', `SELECT 1 FROM pg_database WHERE datname='${state.id}_dev'`], pgEnv, true).trim();
  if (!exists) run(join(bin, 'createdb'), [...args, `${state.id}_dev`], pgEnv, true);
  assertManagedDatabase(state, env, root);
}

async function main() {
  if (!['prepare', 'dev', 'schema', 'stop', 'status', 'default-dev'].includes(command)) throw new Error('Usage: node scripts/worktree.mjs prepare|dev|schema|stop|status');
  if (!context.linked) {
    if (command === 'default-dev') {
      const child = spawn('pnpm', ['exec', 'next', 'dev', '--webpack', ...process.argv.slice(3)], { cwd: root, stdio: 'inherit' });
      child.on('exit', code => process.exit(code ?? 1)); return;
    }
    if (hook) { print('Main checkout: isolated worktree setup skipped.'); return; }
    throw new Error('This command requires a linked Git worktree. The main checkout is never provisioned or migrated.');
  }
  if (command === 'stop' || command === 'status') {
    if (!existsSync(stateFile)) { print('Not prepared yet.'); return; }
    state = JSON.parse(readFileSync(stateFile, 'utf8'));
    assertManagedDatabase(state, { DATABASE_URL: state.databaseUrl, DIRECT_URL: state.databaseUrl }, root);
    if (command === 'stop') run(join(pgBin(), 'pg_ctl'), ['-D', state.dataDir, '-m', 'fast', '-w', 'stop'], process.env, true);
    else { print(`${state.id}: http://localhost:${state.appPort}; schema ${state.applied === schemaDigest(root) ? 'ready' : 'approval pending'}`); print(`Run: ${launchCommand}`); }
    return;
  }
  const prepared = await prepare();
  if (!prepared) return;
  const { env, digest } = prepared;
  if (command === 'prepare') return;
  await consent(digest);
  await startDatabase(env);
  if (state.applied !== digest) {
    run('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { ...env, WORKTREE_SCHEMA_APPROVAL: digest });
    state.applied = digest; save();
  }
  // Detect schema edits with no corresponding migration; never substitute db push/reset.
  run('pnpm', ['exec', 'prisma', 'migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--exit-code'], env);
  if (!state.seeded) {
    run('pnpm', ['exec', 'tsx', 'scripts/worktree-seed.ts'], { ...env, WORKTREE_DEMO_PASSWORD: state.demoPassword });
    state.seeded = true; save();
  }
  if (command === 'schema') { print('Isolated schema and demo data are ready.'); return; }
  const index = process.argv.indexOf('--port');
  const preferred = index >= 0 ? Number(process.argv[index + 1]) : state.appPort;
  if (!Number.isInteger(preferred) || preferred < 1024 || preferred > 65335) throw new Error('Port must be between 1024 and 65335.');
  state.appPort = await freePort(preferred, [state.dbPort]); save(); Object.assign(env, writeEnv());
  print(`Open http://localhost:${state.appPort}`);
  print(`Demo manager: manager@worktree.test | employee: employee@worktree.test | password: ${state.demoPassword}`);
  // Keep the setup lock during the server lifetime to prevent duplicate launchers/state rewrites.
  const child = spawn('pnpm', ['exec', 'next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(state.appPort)], { cwd: root, env, stdio: 'inherit' });
  state.serverPid = child.pid; save();
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
  await new Promise(resolveExit => { child.on('exit', code => { process.exitCode = code ?? 0; resolveExit(); }); child.on('error', error => { process.exitCode = 1; print(error.message); resolveExit(); }); });
  delete state.serverPid; save();
}

main().catch(error => { console.error(`[worktree] ${error.message}`); process.exitCode = 1; }).finally(() => {
  if (locked) rmSync(lock, { recursive: true, force: true });
});
