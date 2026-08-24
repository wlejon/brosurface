#!/usr/bin/env node
/**
 * tools/sync_to_bro.mjs — Direct Generator Sync from brosurface to live bro
 *
 * Applies all generator outputs (QuickJS bindings, docs, stubs, and TypeScript definitions)
 * directly into the live bro tree (D:/projects/bro).
 *
 * Usage:
 *   node tools/sync_to_bro.mjs [--dry-run] [--accept-drift]
 *
 * Refuses to run when bro holds changes this sync would overwrite; see
 * tools/drift.mjs. --accept-drift overwrites them deliberately.
 *   npm run sync-to-bro
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { runEmitDocs } from '../gen/emit_docs.mjs';
import { runEmitDts } from '../gen/emit_dts.mjs';
import { runEmitQjsbind } from '../gen/emit_qjsbind.mjs';
import { runEmitBronzeHost } from '../gen/emit_bronze_host.mjs';
import { runEmitStubs } from '../gen/emit_stubs.mjs';
import { collectDrift } from './drift.mjs';
import { ownerOf } from './ownership.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BROSURFACE_ROOT = path.resolve(__dirname, '..');
const BRO_ROOT = path.resolve(BROSURFACE_ROOT, '..', 'bro');
const BROKIT_ROOT = path.resolve(BROSURFACE_ROOT, '..', 'brokit');

const isDryRun = process.argv.includes('--dry-run');
const acceptDrift = process.argv.includes('--accept-drift');

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║         brosurface -> bro Direct Generator Sync Tool               ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

if (!fs.existsSync(BRO_ROOT)) {
  console.error(`❌ bro directory not found at: ${BRO_ROOT}`);
  process.exit(1);
}

// 1. Regenerate all targets from IDLs
console.log('[Step 1] Regenerating all targets from idl/...');
runEmitDocs(path.join(BROSURFACE_ROOT, 'idl/'), path.join(BROSURFACE_ROOT, 'out/docs/'));
runEmitDts(path.join(BROSURFACE_ROOT, 'idl/'), path.join(BROSURFACE_ROOT, 'out/types/index.d.ts'));
runEmitQjsbind(path.join(BROSURFACE_ROOT, 'idl/'), path.join(BROSURFACE_ROOT, 'out/qjs/'));
runEmitBronzeHost(path.join(BROSURFACE_ROOT, 'idl/'), path.join(BROSURFACE_ROOT, 'out/bronze_host/'));
runEmitStubs(path.join(BROSURFACE_ROOT, 'idl/'), path.join(BROSURFACE_ROOT, 'out/stubs/feature_stubs.cpp'));

// 1b. Refuse to overwrite a file bro has moved on from.
//
// This copies emitted TUs straight over bro/src/js. A file that bro has fixed
// by hand, where the fix was never folded back into the IDL, is reverted by
// that copy — silently, inside a commit that reads like a routine
// regeneration. Two such reverts have already reached main and turned CI red
// on all three platforms.
//
// So compare first, and make overwriting drifted files something the operator
// says out loud. Drift is not automatically wrong (bro is often simply
// behind); it just must never be a surprise.
if (!acceptDrift) {
  const drift = collectDrift();
  // Only the files this sync will actually write, and only where writing them
  // would delete something. Reordering and re-indentation are not worth
  // stopping for -- drift.mjs already separates the two -- but a file that has
  // grown past what the IDL models is, and that is the case that has twice
  // reached main as a red build.
  const blocking = (drift ? drift.drifted : []).filter(d =>
    d.copied && d.owner === 'generator' &&
    (d.loss.code.length || d.loss.comment.length));
  if (blocking.length) {
    console.log(`\n[Step 1b] ${blocking.length} file(s) in bro hold work this sync would delete:\n`);
    const width = Math.max(...blocking.map(d => d.broPath.length));
    for (const d of blocking) {
      const bits = [];
      if (d.loss.code.length) bits.push(`${d.loss.code.length} code`);
      if (d.loss.comment.length) bits.push(`${d.loss.comment.length} comment`);
      console.log(`  ${d.broPath.padEnd(width)}  ${bits.join(', ')} line(s)`);
    }
    console.log('\nRead them with');
    console.log('    node tools/drift.mjs --lost <name>');
    console.log('then fold them back with `node tools/refold.mjs <name>`, or');
    console.log('re-run with --accept-drift to overwrite them deliberately.\n');
    process.exit(1);
  }
  console.log('\n[Step 1b] No lossy drift: this sync deletes nothing bro has.');
}

// 2. Direct copy of emitted QuickJS bindings to bro/src/js
console.log('\n[Step 2] Copying emitted QuickJS bindings to bro/src/js/...');
const outQjsDir = path.join(BROSURFACE_ROOT, 'out', 'qjs');
if (fs.existsSync(outQjsDir)) {
  const qjsFiles = fs.readdirSync(outQjsDir).filter(f => f.endsWith('.cpp'));
  const newToBro = [];
  for (const f of qjsFiles) {
    const srcPath = path.join(outQjsDir, f);
    // tools/ownership.mjs is the single list of who owns bro's copy. A file
    // this generator cannot reproduce is not ours to overwrite, and the skip
    // says which it is rather than leaving a silent gap in the log.
    const { owner, why } = ownerOf('qjs', f);
    if (owner !== 'generator') {
      console.log(`  ⏭  [${owner}] ${f} - ${why}`);
      continue;
    }
    const dst = path.join(BRO_ROOT, 'src', 'js', f);
    // Update what bro has; do not invent what it does not. Twenty-eight of the
    // emitted TUs have never existed in bro -- per-class files the IDL splits
    // out that bro keeps folded into a larger binding. Dropping them into
    // src/js/ leaves untracked source that no CMakeLists compiles and that the
    // next `git add` sweeps up by accident. Adding a translation unit to bro is
    // a decision with a build-system half; a copy loop does not get to make it.
    if (!fs.existsSync(dst)) {
      newToBro.push(f);
      continue;
    }
    if (!isDryRun) fs.copyFileSync(srcPath, dst);
    console.log(`  ✅ [bro] ${f} -> ${dst}`);
  }
  if (newToBro.length) {
    console.log(`\n  ${newToBro.length} emitted TU(s) bro does not have, left alone:`);
    console.log(`    ${newToBro.join(', ')}`);
    console.log('    Add one to bro by hand, with its CMakeLists entry, if it is wanted.');
  }
}

// 3. Direct copy of docs to bro/docs
console.log('\n[Step 3] Copying emitted docs to bro/docs/...');
const outDocsDir = path.join(BROSURFACE_ROOT, 'out', 'docs');
if (fs.existsSync(outDocsDir)) {
  const docFiles = fs.readdirSync(outDocsDir).filter(f => f.endsWith('.js') || f.endsWith('.md'));
  for (const f of docFiles) {
    const srcPath = path.join(outDocsDir, f);
    const dst = path.join(BRO_ROOT, 'docs', f);
    if (!isDryRun) fs.copyFileSync(srcPath, dst);
    console.log(`  ✅ [doc] ${f} -> ${dst}`);
  }
}

// 4. Sync TypeScript Definitions to bro/docs/bro.d.ts and bro/types/index.d.ts
console.log('\n[Step 4] Emitting global TypeScript definition files to bro...');
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
  }
}

console.log('\n════════════════════════════════════════════════════════════════════');
console.log('🎉 Direct Sync Complete!');
console.log('════════════════════════════════════════════════════════════════════\n');
