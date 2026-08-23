#!/usr/bin/env node
/**
 * tools/sync_to_bro.mjs — Direct Generator Sync from brosurface to live bro
 *
 * Applies all 23 bundled & equivalence-proven generator outputs directly into
 * the live bro tree (D:/projects/bro), including QuickJS bindings, bronze_host bindings,
 * documentation, and TypeScript definitions.
 *
 * Usage:
 *   node tools/sync_to_bro.mjs [--dry-run]
 *   npm run sync-to-bro
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BROSURFACE_ROOT = path.resolve(__dirname, '..');
const BRO_ROOT = path.resolve(BROSURFACE_ROOT, '..', 'bro');

const isDryRun = process.argv.includes('--dry-run');

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║         brosurface -> bro Direct Generator Sync Tool               ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

if (!fs.existsSync(BRO_ROOT)) {
  console.error(`❌ bro directory not found at: ${BRO_ROOT}`);
  process.exit(1);
}

// 1. Get all integration bundles
const integrationDir = path.join(BROSURFACE_ROOT, 'integration');
const bundles = fs.readdirSync(integrationDir, { withFileTypes: true })
  .filter(e => e.isDirectory() && fs.existsSync(path.join(integrationDir, e.name, 'diff.patch')))
  .map(e => e.name);

console.log(`[Step 1] Applying ${bundles.length} equivalence-proven integration bundles to ${BRO_ROOT}...`);

let successCount = 0;
let failCount = 0;

for (const name of bundles) {
  const patchPath = path.join(integrationDir, name, 'diff.patch');
  try {
    if (isDryRun) {
      execSync(`git -C "${BRO_ROOT}" apply --check "${patchPath}"`, { stdio: 'pipe' });
      console.log(`  [DRY-RUN] ${name.padEnd(20)} ✅ Applies cleanly`);
    } else {
      execSync(`git -C "${BRO_ROOT}" apply --whitespace=nowarn "${patchPath}"`, { stdio: 'pipe' });
      console.log(`  [APPLIED] ${name.padEnd(20)} ✅ Successfully applied`);
    }
    successCount++;
  } catch (err) {
    console.error(`  [FAILED]  ${name.padEnd(20)} ❌ Error applying patch: ${err.message}`);
    failCount++;
  }
}

// 2. Sync TypeScript Definitions to bro/docs/bro.d.ts and bro/types/index.d.ts
console.log(`\n[Step 2] Emitting global TypeScript definition files to bro...`);
const dtsSrc = path.join(BROSURFACE_ROOT, 'out', 'types', 'index.d.ts');
if (fs.existsSync(dtsSrc)) {
  const targetDts1 = path.join(BRO_ROOT, 'docs', 'bro.d.ts');
  const targetDtsDir2 = path.join(BRO_ROOT, 'types');
  const targetDts2 = path.join(targetDtsDir2, 'index.d.ts');

  if (!isDryRun) {
    fs.copyFileSync(dtsSrc, targetDts1);
    if (!fs.existsSync(targetDtsDir2)) fs.mkdirSync(targetDtsDir2, { recursive: true });
    fs.copyFileSync(dtsSrc, targetDts2);
    console.log(`  ✅ Emitted ${targetDts1}`);
    console.log(`  ✅ Emitted ${targetDts2}`);
  } else {
    console.log(`  [DRY-RUN] Would copy ${dtsSrc} -> ${targetDts1} & ${targetDts2}`);
  }
}

console.log('\n════════════════════════════════════════════════════════════════════');
if (failCount === 0) {
  console.log(`🎉 Sync Complete! ${successCount} bundles and TypeScript definitions synced.`);
} else {
  console.error(`⚠️ Sync finished with ${failCount} failures out of ${bundles.length} bundles.`);
  process.exit(1);
}
console.log('════════════════════════════════════════════════════════════════════\n');
