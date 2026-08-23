// gen/emit_stubs.mjs - Availability-Stub C++ Emitter for brosurface
// Consumes validated AST from schema/parser.mjs and emits C++ availability-stub blocks
// matching the scheme in bro/src/js/feature_stubs.cpp and bro/src/js/feature_stub.h.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tokenize } from '../schema/lexer.mjs';
import { parse } from '../schema/parser.mjs';
import { validate } from '../schema/validator.mjs';

/**
 * Finds all .idl files in a directory or returns the file itself.
 * @param {string} dirOrFile
 * @returns {string[]}
 */
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
 * Capitalizes the first character of a string (e.g. 'foo' -> 'Foo', 'sample' -> 'Sample').
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Finds an attribute by name on an AST node.
 * @param {Object} node
 * @param {string} attrName
 * @returns {Object|null}
 */
function getAttribute(node, attrName) {
  if (!node || !node.attributes) return null;
  return node.attributes.find((a) => a.name === attrName) || null;
}

/**
 * Generates the availability-stub C++ source code from a list of IDL ASTs.
 * @param {Array<Object>} astList - List of IDLFile AST nodes
 * @returns {{ code: string, stubCount: number, gatedSymbols: string[] }}
 */
export function generateFeatureStubs(astList) {
  const gatedDefs = [];

  for (const fileAst of astList) {
    for (const def of fileAst.definitions) {
      const gateAttr = getAttribute(def, 'gate');
      if (gateAttr && gateAttr.value) {
        gatedDefs.push({
          def,
          gate: String(gateAttr.value),
          file: fileAst.path || '<unknown>',
        });
      }
    }
  }

  const lines = [];
  lines.push('// =============================================================================');
  lines.push('// Generated Availability Stubs (brosurface)');
  lines.push('//');
  lines.push('// Feature stubs for optional subsystems (AI tower + Tier-1 renderer/service).');
  lines.push('// Each block below is compiled only when its BRO_WITH_* flag is OFF (0),');
  lines.push('// and defines the same install entry point that the real binding defines.');
  lines.push('//');
  lines.push('// When a subsystem is compiled out, the stub installs an unavailable');
  lines.push('// namespace reporting `available === false` wrapped in a throwing Proxy.');
  lines.push('//');
  lines.push('// Code Anchor: bro/src/js/feature_stubs.cpp & bro/src/js/feature_stub.h');
  lines.push('// =============================================================================');
  lines.push('');
  lines.push('#include "js/feature_stub.h"');
  lines.push('');

  // Include binding headers for gated symbols
  const headerIncludes = new Set();
  for (const { def } of gatedDefs) {
    const headerAttr = getAttribute(def, 'header');
    if (headerAttr && headerAttr.value) {
      headerIncludes.add(String(headerAttr.value));
    } else {
      headerIncludes.add(`js/${def.name.toLowerCase()}_bindings.h`);
    }
  }

  for (const h of headerIncludes) {
    lines.push(`#include "${h}"`);
  }

  lines.push('');
  lines.push('namespace bro::js {');
  lines.push('');

  const gatedSymbols = [];

  for (const { def, gate } of gatedDefs) {
    const symbolKey = def.name;
    const bannerName = def.name.toUpperCase();
    gatedSymbols.push(symbolKey);

    lines.push(`// ── ${bannerName} ───────────────────────────────────────────────────────────────────────`);
    lines.push(`#if !${gate}`);

    const customInstall = getAttribute(def, 'install_fn');
    const customStubBody = getAttribute(def, 'stub_body');

    let fnSig;
    if (customInstall && customInstall.value) {
      fnSig = String(customInstall.value);
    } else {
      const capName = capitalize(def.name);
      fnSig = `void install${capName}Bindings(JSContext* ctx)`;
    }

    lines.push(`${fnSig} {`);
    if (customStubBody && customStubBody.value) {
      lines.push(`    ${customStubBody.value}`);
    } else {
      lines.push(`    installUnavailableNamespace(ctx, "${def.name}", "${gate}");`);
    }
    lines.push('}');
    lines.push('#endif');
    lines.push('');
  }

  lines.push('} // namespace bro::js');
  lines.push('');

  return {
    code: lines.join('\n'),
    stubCount: gatedDefs.length,
    gatedSymbols,
  };
}

/**
 * Runs the availability-stub emitter on all IDLs in targetPath.
 * @param {string} [targetPath='idl/']
 * @param {string} [outFile='out/stubs/feature_stubs.cpp']
 * @returns {{ success: boolean, outFile: string, stubCount: number, gatedSymbols: string[] }}
 */
export function runEmitStubs(targetPath = 'idl/', outFile = 'out/stubs/feature_stubs.cpp') {
  console.log(`[brosurface Availability-Stub Emitter] Reading IDLs from: ${targetPath}`);

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

  // Validate ASTs
  const valErrors = validate(astList, sourceMap);
  if (valErrors.length > 0) {
    console.error(`Validation failed with ${valErrors.length} error(s):`);
    for (const err of valErrors) {
      console.error(`  ${err.toString()}`);
    }
    process.exit(1);
  }

  const { code, stubCount, gatedSymbols } = generateFeatureStubs(astList);

  const outDir = path.dirname(outFile);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, code, 'utf8');

  const lineCount = code.split('\n').length;
  console.log(`  - Emitted stub blocks for ${stubCount} gated symbol(s): [${gatedSymbols.join(', ')}]`);
  console.log(`  - Wrote output to: ${outFile} (${lineCount} lines)`);
  console.log(`\n✅ Generated availability stubs successfully in: ${outFile}`);

  return {
    success: true,
    outFile,
    stubCount,
    gatedSymbols,
  };
}

// CLI entry point
const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectExecution || (process.argv[1] && process.argv[1].endsWith('emit_stubs.mjs'))) {
  const args = process.argv.slice(2);
  const target = args[0] || 'idl/';
  const out = args[1] || 'out/stubs/feature_stubs.cpp';
  runEmitStubs(target, out);
}
