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
 * Natives go only to the subsystems bro CARRIES: the ones whose generated
 * register TU, bro/src/bronze_host/natives/<sub>/native_<sub>_register.cpp,
 * is already there (bro's CMakeLists names it). Today that is every entry of
 * idl/natives.list; the check stays so that a subsystem added to the list
 * before bro adopts it is not copied into a directory nothing compiles.
 * Adopting a subsystem in bro is a bro change (the register TU and its
 * include dir in CMakeLists.txt) that this tool then follows. A sibling
 * library's surface is not on the list at all: its natives are hand-written
 * in the sibling's own src/api/.
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

// The generators write LF. On an autocrlf checkout bro's copies sit in the
// working tree as CRLF, and overwriting them with LF bytes makes git list
// every synced file as modified with an empty diff. So a copy keeps the
// destination's line endings when it already exists.
function copy(src, dst, tag) {
  if (!isDryRun) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    let text = fs.readFileSync(src, 'utf8');
    if (fs.existsSync(dst) && fs.readFileSync(dst, 'utf8').includes('\r\n')) {
      text = text.replace(/\r?\n/g, '\r\n');
    }
    fs.writeFileSync(dst, text, 'utf8');
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
const skipped = [];
for (const plan of plans) {
  const sub = plan.subsystem;
  if (!fs.existsSync(path.join(broNatives, sub, `native_${sub}_register.cpp`))) {
    skipped.push(sub);
    continue;
  }
  const dir = path.join(outNatives, sub);
  for (const f of fs.readdirSync(dir)) {
    copy(path.join(dir, f), path.join(broNatives, sub, f), `natives:${sub}`);
  }
}
if (skipped.length) {
  console.log(`  ⏭  not carried by bro (no natives/<sub>/native_<sub>_register.cpp there), left alone: ${skipped.join(', ')}`);
}

console.log('\n════════════════════════════════════════════════════════════════════');
console.log(`🎉 Direct Sync Complete${isDryRun ? ' (dry run, nothing written)' : ''}!`);
console.log('════════════════════════════════════════════════════════════════════\n');
