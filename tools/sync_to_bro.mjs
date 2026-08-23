#!/usr/bin/env node
/**
 * tools/sync_to_bro.mjs — Direct Generator Sync from brosurface to live bro
 *
 * Applies all generator outputs (QuickJS bindings, docs, stubs, and TypeScript definitions)
 * directly into the live bro tree (D:/projects/bro).
 *
 * Usage:
 *   node tools/sync_to_bro.mjs [--dry-run]
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BROSURFACE_ROOT = path.resolve(__dirname, '..');
const BRO_ROOT = path.resolve(BROSURFACE_ROOT, '..', 'bro');
const BROKIT_ROOT = path.resolve(BROSURFACE_ROOT, '..', 'brokit');

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
runEmitQjsbind(path.join(BROSURFACE_ROOT, 'idl/'), path.join(BROSURFACE_ROOT, 'out/qjs/'));
runEmitBronzeHost(path.join(BROSURFACE_ROOT, 'idl/'), path.join(BROSURFACE_ROOT, 'out/bronze_host/'));
runEmitStubs(path.join(BROSURFACE_ROOT, 'idl/'), path.join(BROSURFACE_ROOT, 'out/stubs/feature_stubs.cpp'));

// 2. Direct copy of emitted QuickJS bindings to bro/src/js
console.log('\n[Step 2] Copying emitted QuickJS bindings to bro/src/js/...');
const outQjsDir = path.join(BROSURFACE_ROOT, 'out', 'qjs');
if (fs.existsSync(outQjsDir)) {
  const qjsFiles = fs.readdirSync(outQjsDir).filter(f => f.endsWith('.cpp'));
  for (const f of qjsFiles) {
    const srcPath = path.join(outQjsDir, f);
    if (f === 'blob.cpp' || f === 'noise.cpp' || f === 'intl.cpp' || f === 'vendor_globals.cpp' || f === 'image_gpu.cpp') {
      // These live in brokit standalone or polyfills - skip copying to preserve bro integrity
      continue;
    } else {
      const dst = path.join(BRO_ROOT, 'src', 'js', f);
      if (!isDryRun) fs.copyFileSync(srcPath, dst);
      console.log(`  ✅ [bro] ${f} -> ${dst}`);
    }
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
