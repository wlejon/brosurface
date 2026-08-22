// gen/emit_bronze_host.mjs - Bronze Host C++ Binding and Manifest Emitter
// Consumes validated AST from schema/parser.mjs and emits drop-in replacement artifacts:
//   - out/bronze_host/host_file.cpp
//   - out/bronze_host/manifest_entries.txt
//   - out/bronze_host/dom_globals_install.cpp

import fs from 'fs';
import path from 'path';
import { tokenize } from '../schema/lexer.mjs';
import { parse } from '../schema/parser.mjs';
import { validate } from '../schema/validator.mjs';
import {
  emitBlobHelpers,
  emitBlobMethodsAndClasses,
  emitBlobPublicApi,
  emitBlobInstallBlock
} from './bh_file_blob.mjs';
import {
  emitReaderStateAndHelpers,
  emitReaderProto,
  emitReaderInstallBlock
} from './bh_file_reader.mjs';
import {
  emitUrlStaticFactories,
  emitUrlParserAndState,
  emitSearchParams,
  emitUrlValueAndProto,
  emitMimeForName,
  emitUrlInstallBlock
} from './bh_file_url.mjs';
import {
  extractDeclaredGlobals,
  emitManifestEntries,
  emitDomGlobalsInstallSnippet
} from './bh_manifest.mjs';

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
 * Emits host_file.cpp translation unit from AST.
 * @param {Array<Object>} astList
 * @param {Object} [options={}]
 * @returns {string}
 */
export function emitHostFileCpp(astList, options = {}) {
  const exclude = new Set(options.excludeGlobals || []);

  let blobDef = null;
  let fileDef = null;
  let readerDef = null;
  let urlDef = null;
  let searchParamsDef = null;

  for (const fileAst of astList) {
    for (const def of fileAst.definitions) {
      if (def.type === 'Interface') {
        if (def.name === 'Blob') blobDef = def;
        if (def.name === 'File') fileDef = def;
        if (def.name === 'FileReader') readerDef = def;
        if (def.name === 'URL') urlDef = def;
        if (def.name === 'URLSearchParams') searchParamsDef = def;
      }
    }
  }

  const out = [];

  // 1. File Header
  out.push(`// Blob, File, FileReader, and URL — bytes an app holds, and the names it gives
// them.

#include "bronze_host/bronze_host.h"
#include "bronze_host/gl_internal.h"
#include "bronze_host/host_internal.h"

#include "util/log.h"
#include "util/object_url.h"

#include <algorithm>
#include <atomic>
#include <cstdint>
#include <chrono>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <memory>
#include <system_error>
#include <utility>
#include <string>
#include <vector>

namespace bro::bronze_host {

namespace {
`);

  // 2. Blob / File Helpers
  out.push(emitBlobHelpers());

  // 3. Blob Methods & Classes
  out.push(emitBlobMethodsAndClasses(blobDef, fileDef));

  // 4. FileReader (if not excluded)
  if (!exclude.has('FileReader') && readerDef) {
    out.push(emitReaderStateAndHelpers());
    out.push(emitReaderProto(readerDef));
  }

  // 5. URL & URLSearchParams (if not excluded)
  if (!exclude.has('URL') && urlDef) {
    out.push(emitUrlStaticFactories());
    out.push(emitUrlParserAndState());
    if (searchParamsDef) {
      const sp = emitSearchParams(searchParamsDef);
      if (sp) out.push(sp);
    }
    out.push(emitUrlValueAndProto(urlDef));
  }

  // 6. MIME Helper
  out.push(emitMimeForName());

  // Close anonymous namespace
  out.push(`}  // namespace\n`);

  // 7. Public API functions
  out.push(emitBlobPublicApi());

  // 8. installFileGlobals()
  const installs = [];
  if (!exclude.has('Blob') && !exclude.has('File')) {
    installs.push(emitBlobInstallBlock());
  }
  if (!exclude.has('FileReader') && readerDef) {
    installs.push(emitReaderInstallBlock());
  }
  if (!exclude.has('URL') && urlDef) {
    installs.push(emitUrlInstallBlock());
  }

  out.push(`// ---------------------------------------------------------------------------
// install
// ---------------------------------------------------------------------------

void installFileGlobals() {
${installs.join('\n\n')}
}

}  // namespace bro::bronze_host
`);

  return out.join('\n');
}

/**
 * Runs the bronze_host emitter on target IDL directory.
 * @param {string} [targetPath='idl/']
 * @param {string} [outPath='out/bronze_host/']
 * @param {Object} [options={}]
 * @returns {{ success: boolean, files: string[], globals: string[] }}
 */
export function runEmitBronzeHost(targetPath = 'idl/', outPath = 'out/bronze_host/', options = {}) {
  console.log(`[brosurface bronze_host Emitter] Reading IDLs from: ${targetPath}`);

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

  // 1. host_file.cpp
  const hostFileCpp = emitHostFileCpp(astList, options);
  const hostFilePath = path.join(outPath, 'host_file.cpp');
  fs.writeFileSync(hostFilePath, hostFileCpp, 'utf8');
  const cppLines = hostFileCpp.split('\n').length;
  console.log(`  - Emitted: ${hostFilePath} (${cppLines} lines)`);
  generatedFiles.push(hostFilePath);

  // 2. manifest_entries.txt
  const globals = extractDeclaredGlobals(astList, options);
  const manifestText = emitManifestEntries(globals);
  const manifestPath = path.join(outPath, 'manifest_entries.txt');
  fs.writeFileSync(manifestPath, manifestText, 'utf8');
  console.log(`  - Emitted: ${manifestPath} (${globals.length} globals: ${globals.join(', ')})`);
  generatedFiles.push(manifestPath);

  // 3. dom_globals_install.cpp
  const installSnippet = emitDomGlobalsInstallSnippet(globals);
  const installPath = path.join(outPath, 'dom_globals_install.cpp');
  fs.writeFileSync(installPath, installSnippet, 'utf8');
  console.log(`  - Emitted: ${installPath}`);
  generatedFiles.push(installPath);

  console.log(`\nGenerated bronze_host C++ bindings & manifest in: ${outPath}`);
  return { success: true, files: generatedFiles, globals };
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('gen/emit_bronze_host.mjs')) {
  const args = process.argv.slice(2);
  const idlDir = args[0] || 'idl/';
  const outDir = args[1] || 'out/bronze_host/';
  runEmitBronzeHost(idlDir, outDir);
}
