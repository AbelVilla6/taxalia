#!/usr/bin/env node
// Idempotent setup: checks Ollama, pulls gemma4:e4b, installs backend deps.
import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = 'gemma4:e4b';

function run(cmd, opts = {}) {
  return spawnSync(cmd, { shell: true, stdio: 'inherit', ...opts });
}

function check(cmd) {
  return spawnSync(cmd, { shell: true, stdio: 'pipe' });
}

// 1. Ollama installed?
const ollamaCheck = check('ollama --version');
if (ollamaCheck.status !== 0) {
  console.error(
    '\n[setup] ERROR: Ollama is not installed or not in PATH.\n' +
    'Install it from https://ollama.com and re-run npm run setup.\n'
  );
  process.exit(1);
}
console.log('[setup] Ollama found.');

// 2. Model pulled?
const listResult = check('ollama list');
const listOutput = listResult.stdout?.toString() ?? '';
if (listOutput.includes(MODEL)) {
  console.log(`[setup] Model ${MODEL} already present — skipping pull.`);
} else {
  console.log(`[setup] Pulling ${MODEL} (this may take a few minutes)…`);
  const pull = run(`ollama pull ${MODEL}`);
  if (pull.status !== 0) {
    console.error(`[setup] ERROR: Failed to pull ${MODEL}.`);
    process.exit(1);
  }
  console.log(`[setup] Model ${MODEL} ready.`);
}

// 3. Backend deps installed?
const backendDir = resolve(ROOT, 'backend');
if (!existsSync(backendDir)) {
  console.log('[setup] backend/ not yet created — skipping npm ci. Run again after PR2.');
  process.exit(0);
}

const backendModules = resolve(backendDir, 'node_modules');
if (existsSync(backendModules)) {
  console.log('[setup] backend/node_modules already present — skipping npm ci.');
} else {
  console.log('[setup] Installing backend dependencies…');
  const install = run('npm ci', { cwd: backendDir });
  if (install.status !== 0) {
    console.error('[setup] ERROR: npm ci failed in backend/.');
    process.exit(1);
  }
  console.log('[setup] Backend dependencies installed.');
}

console.log('\n[setup] Done. Run: cd backend && npm start\n');
