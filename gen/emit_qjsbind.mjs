// gen/emit_qjsbind.mjs - QuickJS C++ Binding Emitter for brosurface pilots
// Consumes validated AST from schema/parser.mjs and emits drop-in C++ replacement TUs:
//   - out/qjs/time_bindings.cpp
//   - out/qjs/noise.cpp
//   - out/qjs/blob.cpp

import fs from 'fs';
import path from 'path';
import { tokenize } from '../schema/lexer.mjs';
import { parse } from '../schema/parser.mjs';
import { validate } from '../schema/validator.mjs';
import { emitTimeBindings } from './qjs_time.mjs';
import { emitNoiseBindings } from './qjs_noise.mjs';
import { emitBlobBindings } from './qjs_blob.mjs';

function findIdlFiles(dirOrFile) {
  const stat = fs.statSync(dirOrFile);
  if (stat.isFile()) {
    return [path.resolve(dirOrFile)];
  }
  const files = [];
  const entries = fs.readdirSync(dirOrFile, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirOrFile, entry.name);
    if (entry.isDirectory()) {
      files.push(...findIdlFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.idl')) {
      files.push(path.resolve(full));
    }
  }
  return files;
}

/**
 * Runs the QuickJS C++ binding emitter on all IDLs in targetPath.
 * @param {string} [targetPath='idl/']
 * @param {string} [outPath='out/qjs/']
 * @returns {{ success: boolean, files: string[] }}
 */
export function runEmitQjsbind(targetPath = 'idl/', outPath = 'out/qjs/') {
  console.log(`[brosurface qjsbind Emitter] Reading IDLs from: ${targetPath}`);

  if (!fs.existsSync(targetPath)) {
    console.error(`Target path does not exist: ${targetPath}`);
    process.exit(1);
  }

  const idlFiles = findIdlFiles(targetPath);
  const astList = [];
  const sourceMap = new Map();

  for (const f of idlFiles) {
    const rel = path.relative(process.cwd(), f).replace(/\\/g, '/');
    const src = fs.readFileSync(f, 'utf8');
    sourceMap.set(rel, src);
    const tokens = tokenize(src, rel);
    const fileAst = parse(tokens, rel);
    astList.push(fileAst);
  }

  // Semantic validation
  const valErrors = validate(astList, sourceMap);
  if (valErrors.length > 0) {
    console.error(`Validation failed with ${valErrors.length} error(s):`);
    for (const err of valErrors) {
      console.error(`  ${err.toString()}`);
    }
    process.exit(1);
  }

  fs.mkdirSync(outPath, { recursive: true });

  const generatedFiles = [];

  // 1. time_bindings.cpp
  const timeCpp = emitTimeBindings(astList);
  const timeFile = path.join(outPath, 'time_bindings.cpp');
  fs.writeFileSync(timeFile, timeCpp, 'utf8');
  const timeLines = timeCpp.split('\n').length;
  console.log(`  - Emitted: ${timeFile} (${timeLines} lines)`);
  generatedFiles.push(timeFile);

  // 2. noise.cpp
  const noiseCpp = emitNoiseBindings(astList);
  const noiseFile = path.join(outPath, 'noise.cpp');
  fs.writeFileSync(noiseFile, noiseCpp, 'utf8');
  const noiseLines = noiseCpp.split('\n').length;
  console.log(`  - Emitted: ${noiseFile} (${noiseLines} lines)`);
  generatedFiles.push(noiseFile);

  // 3. blob.cpp
  const blobCpp = emitBlobBindings(astList);
  const blobFile = path.join(outPath, 'blob.cpp');
  fs.writeFileSync(blobFile, blobCpp, 'utf8');
  const blobLines = blobCpp.split('\n').length;
  console.log(`  - Emitted: ${blobFile} (${blobLines} lines)`);
  generatedFiles.push(blobFile);

  console.log(`\n✅ Generated all 3 QuickJS binding TUs in: ${outPath}`);
  return { success: true, files: generatedFiles };
}

// CLI entry point
const args = process.argv.slice(2);
const idlDir = args[0] || 'idl/';
const outDir = args[1] || 'out/qjs/';
runEmitQjsbind(idlDir, outDir);
