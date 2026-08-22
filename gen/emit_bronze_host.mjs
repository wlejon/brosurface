// gen/emit_bronze_host.mjs - Bronze Host C++ Binding and Manifest Emitter for brosurface
// 100% generic, AST-driven emitter consuming validated IDL AST from schema/parser.mjs.
// Emits drop-in C++ replacement translation units into out/bronze_host/
// Zero per-namespace conditionals or hardcoded text.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tokenize } from '../schema/lexer.mjs';
import { parse } from '../schema/parser.mjs';
import { validate } from '../schema/validator.mjs';
import { getAttr, hasAttr, emitBronzeHostTU } from './bh_codegen.mjs';
import { extractDeclaredGlobals, emitManifestEntries, emitDomGlobalsInstallSnippet } from './bh_manifest.mjs';

/**
 * Finds all .idl files recursively within a directory or single file path.
 * @param {string} dirOrFile
 * @returns {string[]}
 */
export function findIdlFiles(dirOrFile) {
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
 * Calculates custom escape-hatch LOC lines within an AST node or its members.
 * Honest accounting: counts ALL hand-written lines in IDLs (prologue, epilogue, custom bodies, getters, setters).
 * @param {Object} def
 * @returns {number}
 */
export function calculateCustomLoc(def) {
  let customLines = 0;

  // 1. Definition-level custom code attributes for bronze_host
  const defAttrs = ['bh_prologue', 'bh_epilogue', 'bh_state_body'];
  for (const attrName of defAttrs) {
    const val = getAttr(def, attrName);
    if (typeof val === 'string' && val.trim().length > 0) {
      customLines += val.split('\n').length;
    }
  }

  // 2. Member-level custom code attributes for bronze_host
  if (def.members) {
    for (const m of def.members) {
      const memberAttrs = ['bh_body', 'bh_call', 'bh_getter', 'bh_setter', 'bh_static_body', 'bh_static_call', 'bh_ctor'];
      let memberHandled = false;
      for (const attrName of memberAttrs) {
        const val = getAttr(m, attrName);
        if (typeof val === 'string' && val.trim().length > 0) {
          customLines += val.split('\n').length;
          memberHandled = true;
        }
      }
      if (!memberHandled && (hasAttr(m, 'custom') || hasAttr(m, 'bh_custom'))) {
        customLines += 1;
      }
    }
  }

  return customLines;
}

/**
 * Runs the generic Bronze Host C++ binding emitter on all IDLs in targetPath.
 * @param {string} [targetPath='idl/']
 * @param {string} [outPath='out/bronze_host/']
 * @param {Object} [options={}]
 * @returns {{ success: boolean, files: string[], globals: string[], stats: Array<{ file: string, totalLines: number, customLines: number, customFraction: number }> }}
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

  // Group definitions by their target C++ translation unit (bh_file or cpp_file attribute or default)
  const tuGroups = new Map(); // targetFileName -> Array<def>

  for (const fileAst of astList) {
    for (const def of fileAst.definitions) {
      const bhFile = getAttr(def, 'bh_file');
      if (bhFile) {
        if (!tuGroups.has(bhFile)) {
          tuGroups.set(bhFile, []);
        }
        tuGroups.get(bhFile).push(def);
      }
    }
  }

  // If no bh_file specified on any def, group all interfaces/namespaces into host_file.cpp
  if (tuGroups.size === 0) {
    const allDefs = [];
    for (const fileAst of astList) {
      for (const def of fileAst.definitions) {
        if (def.type === 'Interface' || def.type === 'Namespace') {
          allDefs.push(def);
        }
      }
    }
    tuGroups.set('host_file.cpp', allDefs);
  }

  const generatedFiles = [];
  const stats = [];

  for (const [cppFileName, defs] of tuGroups.entries()) {
    const cppContent = emitBronzeHostTU(defs, options);
    if (!cppContent) continue;

    let customLinesCount = 0;
    for (const def of defs) {
      customLinesCount += calculateCustomLoc(def);
    }

    const outFilePath = path.join(outPath, cppFileName);
    fs.writeFileSync(outFilePath, cppContent, 'utf8');
    const totalLines = cppContent.split('\n').length;
    const customFraction = (customLinesCount / totalLines) * 100;

    console.log(`  - Emitted: ${outFilePath} (${totalLines} lines, custom: ${customLinesCount} lines / ${customFraction.toFixed(2)}%)`);
    generatedFiles.push(outFilePath);
    stats.push({
      file: cppFileName,
      totalLines,
      customLines: customLinesCount,
      customFraction,
    });
  }

  // 2. manifest_entries.txt
  const globals = extractDeclaredGlobals(astList, options);
  const manifestText = emitManifestEntries(globals);
  const manifestPath = path.join(outPath, 'manifest_entries.txt');
  fs.writeFileSync(manifestPath, manifestText, 'utf8');
  console.log(`  - Emitted: ${manifestPath} (${globals.length} globals: ${globals.join(', ')})`);
  generatedFiles.push(manifestPath);

  // 3. dom_globals_install.cpp
  const installSnippet = emitDomGlobalsInstallSnippet(globals, astList);
  const installPath = path.join(outPath, 'dom_globals_install.cpp');
  fs.writeFileSync(installPath, installSnippet, 'utf8');
  console.log(`  - Emitted: ${installPath}`);
  generatedFiles.push(installPath);

  console.log(`\n✅ Generic AST-driven bronze_host emitter completed: ${generatedFiles.length} artifact(s) emitted to ${outPath}`);
  return { success: true, files: generatedFiles, globals, stats };
}

// CLI entry point
const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectExecution || (process.argv[1] && process.argv[1].endsWith('emit_bronze_host.mjs'))) {
  const args = process.argv.slice(2);
  const idlDir = args[0] || 'idl/';
  const outDir = args[1] || 'out/bronze_host/';
  runEmitBronzeHost(idlDir, outDir);
}
