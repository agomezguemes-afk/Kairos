#!/usr/bin/env node
// audit-design.mjs — design-system regression check.
//
// Fails (exit 1) when a screen introduces:
//   1. hardcoded hex colors (#FFF, #1c1c1e, etc.)
//   2. deprecated token paths (Colors.background.*, Colors.text.*,
//      Colors.border.*, Colors.accent.*)
//   3. legacy Typography.* usage in new files (warning only — too noisy as
//      an error until the migration sweep is done).
//
// Used in pre-commit and in CI. Treat warnings as TODO, errors as blockers.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, join, extname } from 'node:path';

const ROOT = resolve(process.cwd());
const SRC = join(ROOT, 'src');

const HARDCODED_HEX = /'#[0-9A-Fa-f]{3,8}'|"#[0-9A-Fa-f]{3,8}"/g;
const DEPRECATED_TOKENS = [
  { pattern: /Colors\.background\./g, replacement: 'Colors.bg.*' },
  { pattern: /Colors\.text\./g, replacement: 'Colors.ink.*' },
  { pattern: /Colors\.border\./g, replacement: 'Colors.hair.*' },
  { pattern: /Colors\.accent\./g, replacement: 'Colors.gold.*' },
];
const LEGACY_TYPOGRAPHY = /Typography\.(size|weight|lineHeight|tracking|display|heading|body|caption|mono)/g;

// Files that are themselves the source of truth and may legitimately
// contain hex / deprecated names (the shims themselves).
const IGNORED_FILES = new Set([
  'src/theme/tokens.ts',
  'src/theme/animations.ts',
  'src/theme/index.ts',
]);

// Files where hex colors are OK because they encode discipline / category
// brand colors that need to be persisted as data, not as theme tokens.
const HEX_ALLOWED = [
  'src/types/core.ts',
  'src/types/content.ts',
  'src/data/blockTemplates.ts',
  'src/data/exerciseLibrary.ts',
];

const exts = new Set(['.ts', '.tsx']);

/** @returns {string[]} */
function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === '__tests__' || entry.startsWith('.')) continue;
      walk(full, acc);
    } else if (exts.has(extname(entry))) {
      acc.push(full);
    }
  }
  return acc;
}

const files = walk(SRC);
const errors = [];
const warnings = [];

for (const file of files) {
  const rel = relative(ROOT, file);
  if (IGNORED_FILES.has(rel)) continue;
  if (rel.endsWith('.test.ts') || rel.endsWith('.dev.ts')) continue;

  const text = readFileSync(file, 'utf8');

  // 1. hardcoded hex (errors, with allowlist for data files)
  if (!HEX_ALLOWED.includes(rel)) {
    const matches = text.match(HARDCODED_HEX);
    if (matches) {
      const unique = [...new Set(matches)].sort();
      errors.push({
        file: rel,
        rule: 'hardcoded-hex',
        detail: `${unique.length} unique hex(s): ${unique.slice(0, 3).join(', ')}${unique.length > 3 ? '…' : ''}`,
      });
    }
  }

  // 2. deprecated tokens (errors)
  for (const { pattern, replacement } of DEPRECATED_TOKENS) {
    const count = (text.match(pattern) || []).length;
    if (count > 0) {
      errors.push({
        file: rel,
        rule: 'deprecated-token',
        detail: `${count}× use(s), use ${replacement}`,
      });
    }
  }

  // 3. legacy Typography (warnings)
  const legacyCount = (text.match(LEGACY_TYPOGRAPHY) || []).length;
  if (legacyCount > 0) {
    warnings.push({
      file: rel,
      rule: 'legacy-typography',
      detail: `${legacyCount}× use(s), migrate to Type.*`,
    });
  }
}

// ── Report ───────────────────────────────────────────────────────────

function pad(s, w) {
  if (s.length >= w) return s.slice(0, w - 1) + '…';
  return s + ' '.repeat(w - s.length);
}

function group(items) {
  const byFile = new Map();
  for (const it of items) {
    if (!byFile.has(it.file)) byFile.set(it.file, []);
    byFile.get(it.file).push(it);
  }
  return byFile;
}

const errsByFile = group(errors);
const warnsByFile = group(warnings);

console.log('');
console.log('Kairos design audit');
console.log('───────────────────');
console.log(`scanned: ${files.length} files in src/`);

if (errors.length === 0 && warnings.length === 0) {
  console.log('');
  console.log('✓ clean — no design-system regressions');
  process.exit(0);
}

if (errors.length > 0) {
  console.log('');
  console.log(`✗ errors: ${errors.length} across ${errsByFile.size} file(s)`);
  console.log('');
  // Top 10 files by error count
  const top = [...errsByFile.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);
  for (const [file, items] of top) {
    console.log(`  ${pad(file, 60)} ${items.length} issue(s)`);
    for (const it of items) {
      console.log(`    · [${it.rule}] ${it.detail}`);
    }
  }
  if (errsByFile.size > 10) {
    console.log(`  … and ${errsByFile.size - 10} more file(s)`);
  }
}

if (warnings.length > 0) {
  console.log('');
  console.log(`⚠ warnings: ${warnings.length} across ${warnsByFile.size} file(s)`);
  console.log(`  (legacy Typography.* — migrate to Type.* during polish sweep)`);
}

console.log('');

// Errors block the build. Warnings don't.
// During the migration sweep, run with `--allow-errors` to surface them
// without failing CI yet.
const allowErrors = process.argv.includes('--allow-errors');
if (errors.length > 0 && !allowErrors) {
  console.log('  run with --allow-errors to bypass (migration mode)');
  process.exit(1);
}
process.exit(0);
