#!/usr/bin/env node
/**
 * tools/sync_to_bro.mjs — Direct Generator Sync from brosurface to live bro
 *
 * Synchronizes emitted C-ABI headers, forwarders, Bronze Host TUs, docs, and TypeScript
 * definitions directly into the live bro tree (D:/projects/bro).
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
import { runEmitBronzeHost } from '../gen/emit_bronze_host.mjs';
import { runEmitStubs } from '../gen/emit_stubs.mjs';
import { runEmitCAbi } from '../gen/emit_c_abi.mjs';

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

// 1. Regenerate all targets from IDLs
console.log('[Step 1] Regenerating all targets from idl/...');
runEmitDocs(path.join(BROSURFACE_ROOT, 'idl/'), path.join(BROSURFACE_ROOT, 'out/docs/'));
runEmitDts(path.join(BROSURFACE_ROOT, 'idl/'), path.join(BROSURFACE_ROOT, 'out/types/index.d.ts'));
runEmitDts(path.join(BROSURFACE_ROOT, 'idl/'), path.join(BROSURFACE_ROOT, 'out/bro.d.ts'));
runEmitBronzeHost(path.join(BROSURFACE_ROOT, 'idl/'), path.join(BROSURFACE_ROOT, 'out/bronze_host/'));
runEmitStubs(path.join(BROSURFACE_ROOT, 'idl/'), path.join(BROSURFACE_ROOT, 'out/stubs/feature_stubs.cpp'));
runEmitCAbi(path.join(BROSURFACE_ROOT, 'idl/'), path.join(BROSURFACE_ROOT, 'out/c_abi/'));

// 2. Direct copy of emitted C-ABI headers and forwarders to bro
console.log('\n[Step 2] Copying emitted C-ABI headers and implementations to bro...');
const outCAbiInclude = path.join(BROSURFACE_ROOT, 'out', 'c_abi', 'include', 'bro', 'c_abi');
const broCAbiInclude = path.join(BRO_ROOT, 'include', 'bro', 'c_abi');
if (fs.existsSync(outCAbiInclude)) {
  if (!fs.existsSync(broCAbiInclude)) fs.mkdirSync(broCAbiInclude, { recursive: true });
  const headers = fs.readdirSync(outCAbiInclude).filter(f => f.endsWith('.h'));
  for (const h of headers) {
    const srcPath = path.join(outCAbiInclude, h);
    const dstPath = path.join(broCAbiInclude, h);
    if (!isDryRun) fs.copyFileSync(srcPath, dstPath);
    console.log(`  ✅ [c_abi:h] ${h} -> ${dstPath}`);
  }
}

const outCAbiSrc = path.join(BROSURFACE_ROOT, 'out', 'c_abi', 'src', 'c_abi');
const broCAbiSrc = path.join(BRO_ROOT, 'src', 'c_abi');
if (fs.existsSync(outCAbiSrc)) {
  if (!fs.existsSync(broCAbiSrc)) fs.mkdirSync(broCAbiSrc, { recursive: true });
  const sources = fs.readdirSync(outCAbiSrc).filter(f => f.endsWith('.cpp'));
  for (const s of sources) {
    const srcPath = path.join(outCAbiSrc, s);
    const dstPath = path.join(broCAbiSrc, s);
    if (!isDryRun) fs.copyFileSync(srcPath, dstPath);
    console.log(`  ✅ [c_abi:cpp] ${s} -> ${dstPath}`);
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
