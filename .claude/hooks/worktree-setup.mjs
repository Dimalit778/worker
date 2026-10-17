import { readFileSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
// CLAUDE_PROJECT_DIR can remain the main checkout after EnterWorktree; input.cwd follows Claude.
const cwd = input.cwd ?? process.cwd();
const root = execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const script = join(root, 'scripts/worktree.mjs');
if (!existsSync(script)) throw new Error('This checkout lacks project worktree tooling; follow AGENTS.md.');
const result = spawnSync(process.execPath, [script, 'prepare', '--hook'], { cwd: root, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
