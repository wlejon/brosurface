#!/usr/bin/env node
/**
 * tools/sync_to_bro.mjs — Direct Generator Sync from brosurface to live bro
 *
 * Regenerates every artifact and copies the docs, the TypeScript definitions
 * and the natives outputs (prototype headers, registration TUs, wrappers,
 * globals fragments) into the live bro tree (D:/projects/bro):
 *
 *   out/docs/<x>-api.js            -> bro/docs/<x>-api.js
 *   out/types/index.d.ts           -> bro/docs/bro.d.ts, bro/types/index.d.ts
 *   out/natives/<sub>/*            -> bro/src/bronze_host/natives/<sub>/*
 *
 * The entry-point bodies (bro/src/bronze_host/native_<sub>.cpp) and the
 * [manual] JavaScript are hand-written in bro and never touched here.
 *
 * Usage:
 *   node tools/sync_to_bro.mjs [--dry-run]
 *   npm run sync-to-bro
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runEmitDocs } from '../gen/emit_docs.mjs';
import { runEmitDts } from '../gen/emit_dts.mjs';
import { runEmitNatives } from '../gen/emit_natives.mjs';

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

function copy(src, dst, tag) {
  if (!isDryRun) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
  console.log(`  ✅ [${tag}] ${path.basename(src)} -> ${dst}`);
}

// 1. Regenerate all targets from IDLs
console.log('[Step 1] Regenerating all targets from idl/...');
const idlDir = path.join(BROSURFACE_ROOT, 'idl/');
runEmitDocs(idlDir, path.join(BROSURFACE_ROOT, 'out/docs/'));
runEmitDts(idlDir, path.join(BROSURFACE_ROOT, 'out/types/index.d.ts'));
runEmitDts(idlDir, path.join(BROSURFACE_ROOT, 'out/bro.d.ts'));
const { plans } = runEmitNatives(idlDir, path.join(BROSURFACE_ROOT, 'out/natives/'));

// 2. Docs
console.log('\n[Step 2] Copying emitted docs to bro/docs/...');
const outDocsDir = path.join(BROSURFACE_ROOT, 'out', 'docs');
for (const f of fs.readdirSync(outDocsDir).filter(f => f.endsWith('.js') || f.endsWith('.md'))) {
  copy(path.join(outDocsDir, f), path.join(BRO_ROOT, 'docs', f), 'doc');
}

// 3. TypeScript definitions
console.log('\n[Step 3] Copying the TypeScript definitions to bro...');
const dtsSrc = path.join(BROSURFACE_ROOT, 'out', 'types', 'index.d.ts');
copy(dtsSrc, path.join(BRO_ROOT, 'docs', 'bro.d.ts'), 'd.ts');
copy(dtsSrc, path.join(BRO_ROOT, 'types', 'index.d.ts'), 'd.ts');

// 4. Natives
console.log('\n[Step 4] Copying the natives outputs to bro/src/bronze_host/natives/...');
const outNatives = path.join(BROSURFACE_ROOT, 'out', 'natives');
const broNatives = path.join(BRO_ROOT, 'src', 'bronze_host', 'natives');
for (const plan of plans) {
  const dir = path.join(outNatives, plan.subsystem);
  for (const f of fs.readdirSync(dir)) {
    copy(path.join(dir, f), path.join(broNatives, plan.subsystem, f), `natives:${plan.subsystem}`);
  }
}

console.log('\n════════════════════════════════════════════════════════════════════');
console.log(`🎉 Direct Sync Complete${isDryRun ? ' (dry run, nothing written)' : ''}!`);
console.log('════════════════════════════════════════════════════════════════════\n');
