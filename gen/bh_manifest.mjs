// gen/bh_manifest.mjs - bronze_host Manifest & Registration Invariant Generator
// Extracts globals from IDL declarations and produces synchronized web_host.globals entries
// and dom_globals registration wiring.
// 100% generic, AST-driven, zero per-namespace conditionals.

import { getAttr, hasAttr } from './bh_codegen.mjs';

/**
 * Extracts global identifiers declared across IDLs for bronze_host.
 * @param {Array<Object>} astList - List of IDL file ASTs
 * @param {Object} [options={}] - Configuration options (e.g. excludeGlobals, targetFile, targetInterfaces)
 * @returns {string[]} Ordered list of declared global names
 */
export function extractDeclaredGlobals(astList, options = {}) {
  const exclude = new Set(options.excludeGlobals || []);
  const globals = [];

  for (const fileAst of astList) {
    for (const def of fileAst.definitions) {
      if (def.type === 'Interface' || def.type === 'Namespace') {
        if (hasAttr(def, 'internal')) continue;
        if (exclude.has(def.name)) continue;

        // In bronze_host, only interfaces/namespaces targeting bronze_host are globals
        const bhFile = getAttr(def, 'bh_file');
        if (!bhFile && !hasAttr(def, 'global') && !hasAttr(def, 'bh_global')) continue;

        // If targetFile is specified, check bh_file
        if (options.targetFile && bhFile && bhFile !== options.targetFile) continue;

        // If targetInterfaces is specified in options, respect it
        if (options.targetInterfaces && !options.targetInterfaces.includes(def.name)) {
          continue;
        }

        if (!globals.includes(def.name)) {
          globals.push(def.name);
        }
      }
    }
  }

  return globals;
}

/**
 * Emits manifest_entries.txt content (one identifier per line).
 * @param {string[]} globalsList
 * @returns {string}
 */
export function emitManifestEntries(globalsList) {
  return globalsList.join('\n') + '\n';
}

/**
 * Emits dom_globals_install.cpp snippet showing registration wiring.
 * @param {string[]} globalsList
 * @param {Array<Object>} [astList=[]]
 * @returns {string}
 */
export function emitDomGlobalsInstallSnippet(globalsList, astList = []) {
  const installFns = new Set();

  for (const fileAst of astList) {
    for (const def of fileAst.definitions) {
      if (globalsList.includes(def.name)) {
        const installFn = getAttr(def, 'bh_install') || 'installFileGlobals';
        installFns.add(installFn);
      }
    }
  }

  if (installFns.size === 0 && globalsList.length > 0) {
    installFns.add('installFileGlobals');
  }

  const calls = Array.from(installFns).map(fn => `    ${fn}();`);

  return `// dom_globals_install.cpp - Generated bronze_host Globals Registration Wiring
// Emitted in lockstep with web_host.globals manifest from IDL declarations.

#pragma once

namespace bro::bronze_host {

// Registered host globals:
// ${globalsList.join(', ')}

inline void installDeclaredWebHostGlobals() {
${calls.join('\n')}
}

}  // namespace bro::bronze_host
`;
}
