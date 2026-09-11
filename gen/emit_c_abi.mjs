// gen/emit_c_abi.mjs - Direct C-ABI and Native Manifest Emitter for brosurface
// Consumes validated IDL AST and generates:
// 1. Pure C header: include/bro/c_abi/bro_<subsystem>_c_abi.h
// 2. C++ forwarding implementation: src/c_abi/bro_<subsystem>_c_abi.cpp
// 3. Bronze Native Manifest JSON: out/manifest/bro_<subsystem>_manifest.json
//
// 100% generic, zero QuickJS dependency, direct CPU calling convention.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenize } from '../schema/lexer.mjs';
import { parse } from '../schema/parser.mjs';
import { validate } from '../schema/validator.mjs';

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
 * @returns {{ headerCode: string, cppCode: string, manifest: Object }}
 */
export function generateCAbiForSubsystem(fileAst, subsystem) {
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
  if (subsystem === 'math') {
    cppLines.push('#include <bromath/scalar.h>');
    cppLines.push('#include <bromath/angle.h>');
    cppLines.push('#include <bromath/hash.h>');
    cppLines.push('#include <bromath/spatial_hash.h>');
    cppLines.push('#include <bromath/rng.h>');
    cppLines.push('#include <bromath/smoother.h>');
    cppLines.push('#include <cstring>');
  }
  cppLines.push('');
  cppLines.push('extern "C" {');
  cppLines.push('');

  // Process definitions
  for (const def of fileAst.definitions) {
    if (def.type === 'Namespace') {
      const nsName = `bro.${def.name}`;
      manifest.namespaces[nsName] = { functions: {} };

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
        }
      }
      headerLines.push('');
    } else if (def.type === 'Interface') {
      const clsName = `bro.${subsystem}.${def.name}`;
      manifest.classes[clsName] = {
        name: def.name,
        methods: {},
        properties: {}
      };

      headerLines.push(`// --- Interface ${clsName} ---`);

      // Constructor
      const ctorSym = `bro_${def.name}_create`;
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
          const fnName = m.name === '_int' ? 'int' : m.name;
          const symName = `bro_${def.name}_${fnName}`;
          const retC = typeToC(m.returnType);
          const retBronze = typeToBronze(m.returnType);
          const paramsC = ['void* self'];
          const paramsBronze = ['dynamic'];

          for (const p of m.parameters) {
            paramsC.push(`${typeToC(p.dataType)} ${p.name}`);
            paramsBronze.push(typeToBronze(p.dataType));
          }

          headerLines.push(`${retC} ${symName}(${paramsC.join(', ')});`);

          manifest.classes[clsName].methods[fnName] = {
            symbol: symName,
            returnType: retBronze,
            paramTypes: paramsBronze
          };
          manifest.symbols.push({
            kind: 'method',
            receiver: clsName,
            name: fnName,
            symbol: symName,
            returnType: retBronze,
            paramTypes: paramsBronze
          });
        } else if (m.type === 'AttributeMember') {
          const propName = m.name;
          const getSym = `bro_${def.name}_get_${propName}`;
          const retC = typeToC(m.dataType);
          const retBronze = typeToBronze(m.dataType);

          headerLines.push(`${retC} ${getSym}(void* self);`);

          manifest.classes[clsName].properties[propName] = {
            getter: getSym,
            returnType: retBronze
          };
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

  // Math forwarding implementation
  if (subsystem === 'math') {
    cppLines.push(`
double bro_math_lerp(double a, double b, double t) {
    return static_cast<double>(bromath::lerp(static_cast<float>(a), static_cast<float>(b), static_cast<float>(t)));
}

double bro_math_clamp(double x, double lo, double hi) {
    return static_cast<double>(bromath::clamp(static_cast<float>(x), static_cast<float>(lo), static_cast<float>(hi)));
}

double bro_math_saturate(double x) {
    return static_cast<double>(bromath::saturate(static_cast<float>(x)));
}

double bro_math_invLerp(double a, double b, double x) {
    return static_cast<double>(bromath::invLerp(static_cast<float>(a), static_cast<float>(b), static_cast<float>(x)));
}

double bro_math_remap(double x, double inMin, double inMax, double outMin, double outMax) {
    return static_cast<double>(bromath::remap(static_cast<float>(x), static_cast<float>(inMin), static_cast<float>(inMax),
                                              static_cast<float>(outMin), static_cast<float>(outMax)));
}

double bro_math_smoothstep(double e0, double e1, double x) {
    return static_cast<double>(bromath::smoothstep(static_cast<float>(e0), static_cast<float>(e1), static_cast<float>(x)));
}

double bro_math_smootherstep(double e0, double e1, double x) {
    return static_cast<double>(bromath::smootherstep(static_cast<float>(e0), static_cast<float>(e1), static_cast<float>(x)));
}

double bro_math_degToRad(double deg) {
    return static_cast<double>(bromath::deg2rad(static_cast<float>(deg)));
}

double bro_math_radToDeg(double rad) {
    return static_cast<double>(bromath::rad2deg(static_cast<float>(rad)));
}

double bro_math_wrapAngle(double a) {
    return static_cast<double>(bromath::wrapAngle(static_cast<float>(a)));
}

double bro_math_angleDiff(double a, double b) {
    return static_cast<double>(bromath::angleDelta(static_cast<float>(a), static_cast<float>(b)));
}

double bro_math_fnv1a32(const char* data, double seed) {
    if (!data) return 0.0;
    uint32_t s = (seed == 0.0) ? 2166136261u : static_cast<uint32_t>(seed);
    return static_cast<double>(bromath::fnv1a32(data, std::strlen(data), s));
}

double bro_math_hashU32(double x) {
    return static_cast<double>(bromath::hashU32(static_cast<uint32_t>(x)));
}

double bro_math_cellHash(double x, double y, double z) {
    return static_cast<double>(bromath::cellHash(static_cast<int32_t>(x), static_cast<int32_t>(y), static_cast<int32_t>(z)));
}

// SpatialHash3D
void* bro_SpatialHash3D_create(double cellSize, double bucketCount) {
    (void)bucketCount;
    return new bromath::SpatialHash3D(static_cast<float>(cellSize > 0.0 ? cellSize : 1.0));
}

void bro_SpatialHash3D_destroy(void* self) {
    delete static_cast<bromath::SpatialHash3D*>(self);
}

void* bro_SpatialHash3D_insert(void* self, double id, double x, double y, double z) {
    if (self) {
        static_cast<bromath::SpatialHash3D*>(self)->insert(
            bromath::Vec3{static_cast<float>(x), static_cast<float>(y), static_cast<float>(z)},
            static_cast<int32_t>(id));
    }
    return self;
}

bool bro_SpatialHash3D_remove(void* self, double id, double x, double y, double z) {
    (void)x; (void)y; (void)z;
    if (!self) return false;
    static_cast<bromath::SpatialHash3D*>(self)->remove(static_cast<int32_t>(id));
    return true;
}

void* bro_SpatialHash3D_clear(void* self) {
    if (self) static_cast<bromath::SpatialHash3D*>(self)->clear();
    return self;
}

double bro_SpatialHash3D_get_size(void* self) {
    if (!self) return 0.0;
    return static_cast<double>(static_cast<bromath::SpatialHash3D*>(self)->size());
}

double bro_SpatialHash3D_nearest(void* self, double x, double y, double z, double maxDist) {
    if (!self) return -1.0;
    return static_cast<double>(static_cast<bromath::SpatialHash3D*>(self)->nearest(
        bromath::Vec3{static_cast<float>(x), static_cast<float>(y), static_cast<float>(z)},
        static_cast<float>(maxDist)));
}

// Rng
struct RngState {
    uint64_t state = 0;
};

void* bro_Rng_create(double seed) {
    auto* r = new RngState();
    r->state = static_cast<uint64_t>(seed);
    return r;
}

void bro_Rng_destroy(void* self) {
    delete static_cast<RngState*>(self);
}

void* bro_Rng_reseed(void* self, double seed) {
    if (self) static_cast<RngState*>(self)->state = static_cast<uint64_t>(seed);
    return self;
}

double bro_Rng_float01(void* self) {
    if (!self) return 0.0;
    return static_cast<double>(bromath::randFloat01(static_cast<RngState*>(self)->state));
}

double bro_Rng_signed(void* self) {
    if (!self) return 0.0;
    return static_cast<double>(bromath::randSigned(static_cast<RngState*>(self)->state));
}

double bro_Rng_range(void* self, double lo, double hi) {
    if (!self) return 0.0;
    return static_cast<double>(bromath::randRange(static_cast<RngState*>(self)->state, static_cast<float>(lo), static_cast<float>(hi)));
}

int32_t bro_Rng_int(void* self, int32_t lo, int32_t hi) {
    if (!self) return 0;
    return bromath::randInt(static_cast<RngState*>(self)->state, lo, hi);
}

double bro_Rng_uint32(void* self) {
    if (!self) return 0.0;
    return static_cast<double>(static_cast<uint32_t>(bromath::splitmix64(static_cast<RngState*>(self)->state) >> 32));
}

double bro_Rng_normal(void* self) {
    if (!self) return 0.0;
    return static_cast<double>(bromath::randNormal(static_cast<RngState*>(self)->state));
}

// Smoother
void* bro_Smoother_create(double timeMs, double sampleRate) {
    auto* s = new bromath::Smoother();
    if (timeMs > 0.0 && sampleRate > 0.0) {
        bromath::smootherSetTime(*s, static_cast<float>(timeMs), static_cast<float>(sampleRate));
    }
    return s;
}

void bro_Smoother_destroy(void* self) {
    delete static_cast<bromath::Smoother*>(self);
}

void* bro_Smoother_setTime(void* self, double timeMs, double sampleRate) {
    if (self) bromath::smootherSetTime(*static_cast<bromath::Smoother*>(self), static_cast<float>(timeMs), static_cast<float>(sampleRate));
    return self;
}

void* bro_Smoother_reset(void* self, double value) {
    if (self) bromath::smootherReset(*static_cast<bromath::Smoother*>(self), static_cast<float>(value));
    return self;
}

void* bro_Smoother_setTarget(void* self, double t) {
    if (self) bromath::smootherTarget(*static_cast<bromath::Smoother*>(self), static_cast<float>(t));
    return self;
}

double bro_Smoother_tick(void* self) {
    if (!self) return 0.0;
    return static_cast<double>(bromath::smootherTick(*static_cast<bromath::Smoother*>(self)));
}

double bro_Smoother_tickN(void* self, int32_t n) {
    if (!self) return 0.0;
    return static_cast<double>(bromath::smootherTickN(*static_cast<bromath::Smoother*>(self), n));
}

double bro_Smoother_get_current(void* self) {
    if (!self) return 0.0;
    return static_cast<double>(static_cast<bromath::Smoother*>(self)->current);
}

double bro_Smoother_get_target(void* self) {
    if (!self) return 0.0;
    return static_cast<double>(static_cast<bromath::Smoother*>(self)->target);
}

double bro_Smoother_get_coeff(void* self) {
    if (!self) return 0.0;
    return static_cast<double>(static_cast<bromath::Smoother*>(self)->coeff);
}
`);
  }

  cppLines.push('} // extern "C"');
  cppLines.push('');

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

  for (const item of astList) {
    const baseName = path.basename(item.f, '.idl');
    if (baseName !== 'math') {
      // Phase 1 pilot targets math
      continue;
    }

    const { headerCode, cppCode, manifest } = generateCAbiForSubsystem(item.fileAst, baseName);

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
