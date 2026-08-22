// gen/emit_qjsbind.mjs - QuickJS C++ Binding Emitter for brosurface
// 100% generic, AST-driven emitter consuming validated IDL AST from schema/parser.mjs.
// Emits drop-in C++ replacement translation units into out/qjs/
// Zero per-namespace conditionals or hardcoded text.

import fs from 'fs';
import path from 'path';
import { tokenize } from '../schema/lexer.mjs';
import { parse } from '../schema/parser.mjs';
import { validate } from '../schema/validator.mjs';
import { getAttr, hasAttr, emitNamespaceTU, emitInterfaceTU } from './qjs_codegen.mjs';

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
 * Per SPEC §5.1 / DESIGN §1.2, counts operations marked with [custom].
 * @param {Object} def
 * @returns {number}
 */
export function calculateCustomLoc(def) {
  let customLines = 0;

  if (def.members) {
    for (const m of def.members) {
      if (hasAttr(m, 'custom')) {
        const body = getAttr(m, 'cpp_body') || getAttr(m, 'cpp_call');
        if (typeof body === 'string') {
          customLines += body.split('\n').length;
        } else {
          customLines += 1;
        }
      }
    }
  }

  return customLines;
}

/**
 * Runs the generic QuickJS C++ binding emitter on all IDLs in targetPath.
 * @param {string} [targetPath='idl/']
 * @param {string} [outPath='out/qjs/']
 * @returns {{ success: boolean, files: string[], stats: Array<{ file: string, totalLines: number, customLines: number, customFraction: number }> }}
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

  // Group definitions by their target C++ translation unit (cpp_file attribute or default)
  const tuGroups = new Map(); // targetFileName -> Array<def>

  for (const fileAst of astList) {
    for (const def of fileAst.definitions) {
      const cppFile = getAttr(def, 'cpp_file') || `${def.name.toLowerCase()}.cpp`;
      if (!tuGroups.has(cppFile)) {
        tuGroups.set(cppFile, []);
      }
      tuGroups.get(cppFile).push(def);
    }
  }

  const generatedFiles = [];
  const stats = [];

  for (const [cppFileName, defs] of tuGroups.entries()) {
    let cppContent = '';
    let customLinesCount = 0;

    const namespaces = defs.filter(d => d.type === 'Namespace');
    const interfaces = defs.filter(d => d.type === 'Interface');

    if (namespaces.length > 0) {
      for (const ns of namespaces) {
        cppContent += emitNamespaceTU(ns);
        customLinesCount += calculateCustomLoc(ns);
      }
    } else if (interfaces.length > 0) {
      cppContent = emitInterfaceTU(interfaces);
      for (const iface of interfaces) {
        customLinesCount += calculateCustomLoc(iface);
      }
    }

    if (cppContent) {
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
  }

  console.log(`\n✅ Generic AST-driven qjsbind emitter completed: ${generatedFiles.length} TU(s) emitted to ${outPath}`);
  return { success: true, files: generatedFiles, stats };
}

// CLI entry point
const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1'));
if (isDirectExecution || (process.argv[1] && process.argv[1].endsWith('emit_qjsbind.mjs'))) {
  const args = process.argv.slice(2);
  const idlDir = args[0] || 'idl/';
  const outDir = args[1] || 'out/qjs/';
  runEmitQjsbind(idlDir, outDir);
}
