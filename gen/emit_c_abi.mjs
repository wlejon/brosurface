// gen/emit_c_abi.mjs - Generic C-ABI and Native Manifest Emitter for brosurface
// Consumes validated IDL AST and generates:
// 1. Pure C header: include/bro/c_abi/bro_<subsystem>_c_abi.h
// 2. C++ forwarding implementation: src/c_abi/bro_<subsystem>_c_abi.cpp
// 3. Bronze Native Manifest JSON: out/c_abi/manifest/bro_<subsystem>_manifest.json
//
// 100% generic, zero QuickJS dependency, direct CPU calling convention.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenize } from '../schema/lexer.mjs';
import { parse } from '../schema/parser.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * Maps an IDL Type AST node to a pure C type.
 * @param {Object} typeNode
 * @returns {string}
 */
export function typeToC(typeNode) {
  if (!typeNode) return 'void';
  const name = typeNode.name;
  switch (name) {
    case 'void': return 'void';
    case 'boolean': return 'bool';
    case 'float':
    case 'float32':
      return 'float';
    case 'double':
    case 'unrestricted double':
    case 'number':
    case 'float64':
      return 'double';
    case 'short': return 'int16_t';
    case 'unsigned short': return 'uint16_t';
    case 'long':
    case 'int':
    case 'int32':
      return 'int32_t';
    case 'unsigned long':
    case 'uint':
    case 'uint32':
      return 'uint32_t';
    case 'long long':
    case 'int64':
      return 'int64_t';
    case 'unsigned long long':
    case 'uint64':
      return 'uint64_t';
    case 'DOMString':
    case 'ByteString':
    case 'USVString':
    case 'string':
      return 'const char*';
    default:
      return 'void*';
  }
}

/**
 * Maps an IDL Type AST node to a Bronze IL type.
 * @param {Object} typeNode
 * @returns {string}
 */
export function typeToBronze(typeNode) {
  if (!typeNode) return 'void';
  const name = typeNode.name;
  switch (name) {
    case 'void': return 'void';
    case 'boolean': return 'bool';
    case 'float':
    case 'float32':
    case 'double':
    case 'unrestricted double':
    case 'number':
    case 'float64':
      return 'f64';
    case 'short':
    case 'unsigned short':
    case 'long':
    case 'int':
    case 'int32':
    case 'unsigned long':
    case 'uint':
    case 'uint32':
      return 'i32';
    case 'DOMString':
    case 'ByteString':
    case 'USVString':
    case 'string':
      return 'str';
    default:
      return 'dynamic';
  }
}

/**
 * Generates C header, C++ forwarding implementation, and Bronze manifest for an IDL file AST.
 * @param {Object} fileAst
 * @param {string} subsystem
 * @param {Object} [config={}]
 * @returns {{ headerCode: string, cppCode: string, manifest: Object }}
 */
export function generateCAbiForSubsystem(fileAst, subsystem, config = {}) {
  const headerLines = [];
  const cppLines = [];
  const manifest = {
    version: '1.0.0',
    subsystem,
    namespaces: {},
    classes: {},
    symbols: []
  };

  const guardMacro = `BRO_${subsystem.toUpperCase()}_C_ABI_H`;

  headerLines.push('// =============================================================================');
  headerLines.push(`// bro_${subsystem}_c_abi.h — Pure C-ABI declarations for bro.${subsystem}`);
  headerLines.push('// Generated automatically by brosurface (gen/emit_c_abi.mjs).');
  headerLines.push('// Zero dynamic boxing, zero JSContext, direct native CPU register call.');
  headerLines.push('// =============================================================================');
  headerLines.push('');
  headerLines.push(`#ifndef ${guardMacro}`);
  headerLines.push(`#define ${guardMacro}`);
  headerLines.push('');
  headerLines.push('#include <stdint.h>');
  headerLines.push('#include <stdbool.h>');
  headerLines.push('#include <stddef.h>');
  headerLines.push('');
  headerLines.push('#ifdef __cplusplus');
  headerLines.push('extern "C" {');
  headerLines.push('#endif');
  headerLines.push('');

  cppLines.push('// =============================================================================');
  cppLines.push(`// bro_${subsystem}_c_abi.cpp — C++ forwarding implementations for bro.${subsystem}`);
  cppLines.push('// Generated automatically by brosurface (gen/emit_c_abi.mjs).');
  cppLines.push('// =============================================================================');
  cppLines.push('');
  cppLines.push(`#include "bro/c_abi/bro_${subsystem}_c_abi.h"`);

  // Process definitions
  for (const def of fileAst.definitions) {
    if (def.type === 'Namespace') {
      const nsName = `bro.${def.name}`;
      manifest.namespaces[nsName] = { functions: {}, properties: {} };

      headerLines.push(`// --- Namespace ${nsName} ---`);
      for (const m of def.members) {
        if (m.type === 'OperationMember') {
          const fnName = m.name;
          const symName = `bro_${def.name}_${fnName}`;
          const retC = typeToC(m.returnType);
          const retBronze = typeToBronze(m.returnType);
          const paramsC = [];
          const paramsBronze = [];

          for (const p of m.parameters) {
            paramsC.push(`${typeToC(p.dataType)} ${p.name}`);
            paramsBronze.push(typeToBronze(p.dataType));
          }

          const paramDecl = paramsC.length > 0 ? paramsC.join(', ') : 'void';
          headerLines.push(`${retC} ${symName}(${paramDecl});`);

          manifest.namespaces[nsName].functions[fnName] = {
            symbol: symName,
            returnType: retBronze,
            paramTypes: paramsBronze
          };
          manifest.symbols.push({
            kind: 'function',
            jsPath: `${nsName}.${fnName}`,
            symbol: symName,
            returnType: retBronze,
            paramTypes: paramsBronze
          });

          if (Array.isArray(config.aliases)) {
            for (const alias of config.aliases) {
              const aliasPath = alias ? `${alias}.${fnName}` : fnName;
              manifest.symbols.push({
                kind: 'function',
                jsPath: aliasPath,
                symbol: symName,
                returnType: retBronze,
                paramTypes: paramsBronze
              });
            }
          }
        } else if (m.type === 'AttributeMember') {
          const propName = m.name;
          const getSym = `bro_${def.name}_get_${propName}`;
          const retC = typeToC(m.dataType);
          const retBronze = typeToBronze(m.dataType);
          headerLines.push(`${retC} ${getSym}(void);`);

          let setSym = null;
          if (!m.readonly) {
            setSym = `bro_${def.name}_set_${propName}`;
            headerLines.push(`void ${setSym}(${retC} val);`);
          }

          manifest.namespaces[nsName].properties[propName] = {
            getter: getSym,
            setter: setSym,
            returnType: retBronze
          };
          manifest.symbols.push({
            kind: 'property',
            jsPath: `${nsName}.${propName}`,
            getter: getSym,
            setter: setSym,
            returnType: retBronze
          });

          if (Array.isArray(config.aliases)) {
            for (const alias of config.aliases) {
              const aliasPath = alias ? `${alias}.${propName}` : propName;
              manifest.symbols.push({
                kind: 'property',
                jsPath: aliasPath,
                getter: getSym,
                setter: setSym,
                returnType: retBronze
              });
            }
          }
        }
      }
      headerLines.push('');
    } else if (def.type === 'Interface') {
      const clsName = `bro.${subsystem}.${def.name}`;
      const shortName = def.name;
      manifest.classes[clsName] = {
        name: def.name,
        methods: {},
        properties: {}
      };
      manifest.classes[shortName] = manifest.classes[clsName];

      headerLines.push(`// --- Interface ${clsName} ---`);

      // Constructor
      const ctorSym = config.constructorSymbol || `bro_${def.name}_create`;
      const dtorSym = `bro_${def.name}_destroy`;
      let ctorParamsC = [];
      let ctorParamsBronze = [];

      const ctorMember = def.members.find(m => m.type === 'ConstructorMember');
      if (ctorMember) {
        for (const p of ctorMember.parameters) {
          ctorParamsC.push(`${typeToC(p.dataType)} ${p.name}`);
          ctorParamsBronze.push(typeToBronze(p.dataType));
        }
      }

      const ctorParamDecl = ctorParamsC.length > 0 ? ctorParamsC.join(', ') : 'void';
      headerLines.push(`void* ${ctorSym}(${ctorParamDecl});`);
      headerLines.push(`void  ${dtorSym}(void* self);`);

      manifest.classes[clsName].constructor = {
        symbol: ctorSym,
        returnType: 'dynamic',
        paramTypes: ctorParamsBronze
      };
      manifest.classes[clsName].destructor = {
        symbol: dtorSym
      };

      // Methods and attributes
      for (const m of def.members) {
        if (m.type === 'OperationMember') {
          const isStatic = Boolean(m.isStatic || m.special === 'static');
          const fnName = m.name === '_int' ? 'int' : m.name;
          const symName = `bro_${def.name}_${fnName}`;
          const retC = typeToC(m.returnType);
          const retBronze = typeToBronze(m.returnType);
          const returnClass = (retBronze === 'dynamic' && m.returnType && m.returnType.name)
            ? m.returnType.name
            : ((m.returnType && m.returnType.name === def.name) ? def.name : undefined);
          let paramsC = isStatic ? [] : ['void* self'];
          let paramsBronze = isStatic ? [] : ['dynamic'];

          const special = config.specialMethods && config.specialMethods[fnName];
          if (special) {
            paramsC = special.paramTypesC || paramsC;
            paramsBronze = special.paramTypesBronze || paramsBronze;
          } else {
            for (const p of m.parameters) {
              paramsC.push(`${typeToC(p.dataType)} ${p.name}`);
              paramsBronze.push(typeToBronze(p.dataType));
            }
          }

          const paramDecl = paramsC.length > 0 ? paramsC.join(', ') : 'void';
          headerLines.push(`${retC} ${symName}(${paramDecl});`);

          if (isStatic) {
            manifest.symbols.push({
              kind: 'function',
              jsPath: `${def.name}.${fnName}`,
              symbol: symName,
              returnType: retBronze,
              returnClass: returnClass,
              paramTypes: paramsBronze
            });
            manifest.symbols.push({
              kind: 'function',
              jsPath: `${clsName}.${fnName}`,
              symbol: symName,
              returnType: retBronze,
              returnClass: returnClass,
              paramTypes: paramsBronze
            });
            manifest.symbols.push({
              kind: 'function',
              jsPath: `bro.${subsystem}.${fnName}`,
              symbol: symName,
              returnType: retBronze,
              returnClass: returnClass,
              paramTypes: paramsBronze
            });
          } else {
            manifest.classes[clsName].methods[fnName] = {
              symbol: symName,
              returnType: retBronze,
              returnClass: returnClass,
              paramTypes: paramsBronze
            };
            manifest.symbols.push({
              kind: 'method',
              receiver: clsName,
              name: fnName,
              symbol: symName,
              returnType: retBronze,
              returnClass: returnClass,
              paramTypes: paramsBronze
            });
          }
        } else if (m.type === 'AttributeMember') {
          const propName = m.name;
          const getSym = `bro_${def.name}_get_${propName}`;
          const retC = typeToC(m.dataType);
          const retBronze = typeToBronze(m.dataType);
          const propReturnClass = (retBronze === 'dynamic' && m.dataType && m.dataType.name)
            ? m.dataType.name
            : undefined;

          headerLines.push(`${retC} ${getSym}(void* self);`);

          let setSym = null;
          if (!m.readonly) {
            setSym = `bro_${def.name}_set_${propName}`;
            headerLines.push(`void ${setSym}(void* self, ${retC} val);`);
          }

          manifest.classes[clsName].properties[propName] = {
            getter: getSym,
            setter: setSym,
            returnType: retBronze,
            returnClass: propReturnClass
          };
        }
      }

      if (Array.isArray(config.extraMethods)) {
        for (const em of config.extraMethods) {
          if (em.declaration) {
            headerLines.push(em.declaration);
          }
          const rec = em.receiver || clsName;
          if (manifest.classes[rec]) {
            manifest.classes[rec].methods[em.name] = {
              symbol: em.symbol,
              returnType: em.returnType,
              paramTypes: em.paramTypes
            };
          }
          manifest.symbols.push({
            kind: 'method',
            receiver: rec,
            name: em.name,
            symbol: em.symbol,
            returnType: em.returnType,
            paramTypes: em.paramTypes
          });
        }
      }
      headerLines.push('');
    }
  }

  headerLines.push('#ifdef __cplusplus');
  headerLines.push('}');
  headerLines.push('#endif');
  headerLines.push('');
  headerLines.push(`#endif // ${guardMacro}`);
  headerLines.push('');

  // Append forwarder C++ body if provided
  if (config.forwarderCpp) {
    cppLines.push(config.forwarderCpp);
  }

  return {
    headerCode: headerLines.join('\n'),
    cppCode: cppLines.join('\n'),
    manifest
  };
}

/**
 * Runs the C-ABI emitter across target IDLs.
 */
export function runEmitCAbi(idlPath = 'idl/', outDir = 'out/c_abi/') {
  console.log(`[brosurface Native C-ABI Emitter] Reading from: ${idlPath}`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, 'include', 'bro', 'c_abi'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'src', 'c_abi'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'manifest'), { recursive: true });

  const idlFiles = findIdlFiles(idlPath);
  const astList = [];
  const sourceMap = new Map();

  for (const f of idlFiles) {
    const rel = path.relative(process.cwd(), f).replace(/\\/g, '/');
    const src = fs.readFileSync(f, 'utf8');
    sourceMap.set(rel, src);
    const tokens = tokenize(src, rel);
    const fileAst = parse(tokens, rel);
    astList.push({ fileAst, rel, f });
  }

  const generatedFiles = [];
  const fwdDir = path.resolve(__dirname, '..', 'c_abi_forwarders');

  for (const item of astList) {
    const baseName = path.basename(item.f, '.idl');
    const fwdFile = path.join(fwdDir, `${baseName}.cpp`);
    if (!fs.existsSync(fwdFile)) {
      continue;
    }

    const forwarderCpp = fs.readFileSync(fwdFile, 'utf8');
    let config = { forwarderCpp };
    const configFile = path.join(fwdDir, `${baseName}.json`);
    if (fs.existsSync(configFile)) {
      try {
        const extraConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        config = { ...config, ...extraConfig };
      } catch (err) {
        console.error(`Failed to parse config ${configFile}:`, err);
      }
    }

    const { headerCode, cppCode, manifest } = generateCAbiForSubsystem(item.fileAst, baseName, config);

    const headerPath = path.join(outDir, 'include', 'bro', 'c_abi', `bro_${baseName}_c_abi.h`);
    fs.writeFileSync(headerPath, headerCode, 'utf8');
    generatedFiles.push(headerPath);

    const cppPath = path.join(outDir, 'src', 'c_abi', `bro_${baseName}_c_abi.cpp`);
    fs.writeFileSync(cppPath, cppCode, 'utf8');
    generatedFiles.push(cppPath);

    const manifestPath = path.join(outDir, 'manifest', `bro_${baseName}_manifest.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    generatedFiles.push(manifestPath);

    console.log(`  - Emitted C Header: ${headerPath} (${headerCode.split('\n').length} lines)`);
    console.log(`  - Emitted C++ Forwarding: ${cppPath} (${cppCode.split('\n').length} lines)`);
    console.log(`  - Emitted Bronze Manifest: ${manifestPath} (${manifest.symbols.length} symbols)`);
  }

  console.log(`\n✅ Native C-ABI generation completed: ${generatedFiles.length} file(s) emitted.`);
  return { success: true, files: generatedFiles };
}

// CLI entry point
const isDirect = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirect || (process.argv[1] && process.argv[1].endsWith('emit_c_abi.mjs'))) {
  const args = process.argv.slice(2);
  const idlDir = args[0] || 'idl/';
  const outDir = args[1] || 'out/c_abi/';
  runEmitCAbi(idlDir, outDir);
}
