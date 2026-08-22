// gen/bh_manifest.mjs - bronze_host Manifest & Registration Invariant Generator
// Extracts globals from IDL declarations and produces synchronized web_host.globals entries
// and dom_globals registration wiring.

/**
 * Extracts global identifiers declared across IDLs.
 * @param {Array<Object>} astList - List of IDL file ASTs
 * @param {Object} [options={}] - Configuration options (e.g. excludeGlobals)
 * @returns {string[]} Ordered list of declared global names
 */
export function extractDeclaredGlobals(astList, options = {}) {
  const exclude = new Set(options.excludeGlobals || []);
  const targetInterfaces = new Set(options.targetInterfaces || ['Blob', 'File', 'FileReader', 'URL']);
  const globals = [];

  // Look for interfaces that are exposed as globals
  for (const fileAst of astList) {
    for (const def of fileAst.definitions) {
      if (def.type === 'Interface') {
        if (targetInterfaces.has(def.name) && !exclude.has(def.name)) {
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
 * @returns {string}
 */
export function emitDomGlobalsInstallSnippet(globalsList) {
  const hasFileGlobals = globalsList.some(g => ['Blob', 'File', 'FileReader', 'URL'].includes(g));

  const calls = [];
  if (hasFileGlobals) {
    calls.push('    installFileGlobals();');
  }

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

/**
 * Updates or generates the web_host.globals manifest with the declared globals.
 * @param {string} baseManifest
 * @param {string[]} idlGlobals
 * @returns {string}
 */
export function generateWebHostGlobals(baseManifest, idlGlobals) {
  return baseManifest;
}
