#!/usr/bin/env node
// use-env.mjs — point .env at one of .env.development / .env.staging / .env.production
//
// Expo reads `.env` automatically. Switching envs is "make this file
// the active one". We use a symlink so we never copy stale values and
// the source of truth stays the env-specific file.
//
// Usage:
//   node scripts/use-env.mjs development   (default in npm scripts)
//   node scripts/use-env.mjs staging
//   node scripts/use-env.mjs production

import { existsSync, lstatSync, unlinkSync, symlinkSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = (process.argv[2] ?? '').trim();
const valid = ['development', 'staging', 'production'];
if (!valid.includes(target)) {
  console.error(`use-env: expected one of ${valid.join(', ')}, got '${target}'`);
  process.exit(1);
}

const cwd = process.cwd();
const envFile = resolve(cwd, '.env');
const targetFile = `.env.${target}`;
const targetPath = resolve(cwd, targetFile);

if (!existsSync(targetPath)) {
  console.error(`use-env: ${targetFile} not found.`);
  console.error(`Copy .env.example to ${targetFile} and fill in the values for the ${target} environment.`);
  process.exit(1);
}

// Drop existing .env (regular file OR symlink) without touching the
// per-env source files.
if (existsSync(envFile) || lstatSync(envFile, { throwIfNoEntry: false })) {
  unlinkSync(envFile);
}

symlinkSync(targetFile, envFile);

// Surface the active project so the user knows what they're about to build.
const contents = readFileSync(targetPath, 'utf-8');
const urlMatch = contents.match(/^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m);
const supabaseUrl = urlMatch?.[1]?.trim() ?? '(unset)';

console.log(`✓ .env → ${targetFile}`);
console.log(`  APP_ENV=${target}`);
console.log(`  Supabase: ${supabaseUrl}`);
