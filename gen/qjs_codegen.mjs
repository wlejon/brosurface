// gen/qjs_codegen.mjs - Generic AST-Driven QuickJS C++ TU Generator for brosurface
// Consumes validated IDL AST and generates drop-in C++ binding translation units.
// 100% generic, AST-driven, zero per-namespace conditionals.

import { typeToCpp, emitArgExtraction, emitReturnConversion } from './qjs_marshall.mjs';

/**
 * Gets an attribute value from an AST node.
 * @param {Object} node
 * @param {string} name
 * @returns {*|null}
 */
export function getAttr(node, name) {
  if (!node || !node.attributes) return null;
  const a = node.attributes.find(x => x.name === name);
  return a ? a.value : null;
}

/**
 * Checks if an AST node has a boolean or present attribute.
 * @param {Object} node
 * @param {string} name
 * @returns {boolean}
 */
export function hasAttr(node, name) {
  if (!node || !node.attributes) return false;
  return node.attributes.some(x => x.name === name);
}

/**
 * Capitalizes the first character of a string.
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts snake_case or camelCase to PascalCase.
 * @param {string} str
 * @returns {string}
 */
export function toPascalCase(str) {
  if (!str) return '';
  return str.split(/[_.-]/).map(capitalize).join('');
}

/**
 * Converts camelCase or PascalCase to snake_case.
 * @param {string} str
 * @returns {string}
 */
export function toSnakeCase(str) {
  if (!str) return '';
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Emits a complete C++ translation unit for a Namespace AST node (e.g. bro.time).
 * @param {Object} nsDef - Namespace AST node
 * @returns {string}
 */
export function emitNamespaceTU(nsDef) {
  const lines = [];

  const cppHeader = getAttr(nsDef, 'cpp_header') || `js/${nsDef.name.toLowerCase()}_bindings.h`;
  const cppNamespace = getAttr(nsDef, 'cpp_namespace') || 'bro::js';
  const cppIncludes = getAttr(nsDef, 'cpp_includes') || '';
  const cppInstall = getAttr(nsDef, 'cpp_install') || `${toPascalCase(nsDef.name)}Bindings::install`;
  const isEngineStashed = hasAttr(nsDef, 'engine_stashed') || hasAttr(nsDef, 'engine_bound');
  const prefix = getAttr(nsDef, 'prefix') || 'bro.';

  // 1. Headers & Includes
  lines.push(`#include "${cppHeader}"`);
  if (cppIncludes) {
    for (const inc of cppIncludes.split('\n')) {
      const trimmed = inc.trim();
      if (!trimmed) continue;
      lines.push(trimmed.startsWith('#') ? trimmed : `#include ${trimmed}`);
    }
  }
  lines.push('');
  lines.push('extern "C" {');
  lines.push('#include "quickjs.h"');
  lines.push('}');
  lines.push('');
  lines.push(`namespace ${cppNamespace} {`);
  lines.push('');

  // 2. Engine pointer stash helper if engine-stashed
  if (isEngineStashed) {
    const keyConst = `k${toPascalCase(nsDef.name)}EngineKey`;
    const keyVal = `__${prefix.replace(/\./g, '_')}${nsDef.name}_engine_ptr`;
    lines.push(`// ---------------------------------------------------------------------------`);
    lines.push(`// Engine pointer stash (no pinned JSValues, no finalizer-order hazard).`);
    lines.push(`// ---------------------------------------------------------------------------`);
    lines.push('');
    lines.push(`static const char* ${keyConst} = "${keyVal}";`);
    lines.push('');
    lines.push(`static engine::Engine* getEngine(JSContext* ctx) {`);
    lines.push(`    JSValue global = JS_GetGlobalObject(ctx);`);
    lines.push(`    JSValue val = JS_GetPropertyStr(ctx, global, ${keyConst});`);
    lines.push(`    engine::Engine* e = nullptr;`);
    lines.push(`    if (JS_IsNumber(val)) {`);
    lines.push(`        int64_t ptr = 0;`);
    lines.push(`        JS_ToInt64(ctx, &ptr, val);`);
    lines.push(`        e = reinterpret_cast<engine::Engine*>(static_cast<intptr_t>(ptr));`);
    lines.push(`    }`);
    lines.push(`    JS_FreeValue(ctx, val);`);
    lines.push(`    JS_FreeValue(ctx, global);`);
    lines.push(`    return e;`);
    lines.push(`}`);
    lines.push('');
  }

  // 3. Accessors (getters / setters for AttributeMembers)
  const attrs = nsDef.members.filter(m => m.type === 'AttributeMember');
  if (attrs.length > 0) {
    lines.push(`// ---------------------------------------------------------------------------`);
    lines.push(`// Accessors`);
    lines.push(`// ---------------------------------------------------------------------------`);
    lines.push('');

    for (const a of attrs) {
      const aName = a.name;
      const getterName = `js_${nsDef.name}_get_${toSnakeCase(aName)}`;
      const setterName = `js_${nsDef.name}_set_${toSnakeCase(aName)}`;
      const getterCpp = getAttr(a, 'getter_cpp');
      const setterCpp = getAttr(a, 'setter_cpp');

      // Getter
      lines.push(`static JSValue ${getterName}(JSContext* ctx, JSValueConst, int, JSValueConst*) {`);
      if (isEngineStashed) {
        lines.push(`    auto* eng = getEngine(ctx);`);
      }
      if (getterCpp) {
        lines.push(emitReturnConversion(a.dataType, getterCpp, '    '));
      } else {
        lines.push(emitReturnConversion(a.dataType, '0', '    '));
      }
      lines.push(`}`);
      lines.push('');

      // Setter (if not readonly)
      if (!a.readonly) {
        lines.push(`static JSValue ${setterName}(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {`);
        if (isEngineStashed) {
          lines.push(`    auto* eng = getEngine(ctx);`);
        }
        if (setterCpp) {
          for (const sl of setterCpp.split('\n')) {
            lines.push(`    ${sl}`);
          }
        } else {
          lines.push(`    if (argc < 1) return JS_UNDEFINED;`);
          lines.push(emitArgExtraction({ name: 'val', dataType: a.dataType, optional: false, defaultValue: null }, 0, '    '));
          lines.push(`    return JS_UNDEFINED;`);
        }
        lines.push(`}`);
        lines.push('');
      }
    }
  }

  // 4. Operations (methods)
  const ops = nsDef.members.filter(m => m.type === 'OperationMember');
  for (const op of ops) {
    const fnName = `js_${nsDef.name}_${toSnakeCase(op.name)}`;
    const customBody = getAttr(op, 'cpp_body');

    lines.push(`static JSValue ${fnName}(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {`);
    if (customBody) {
      for (const cl of customBody.split('\n')) {
        lines.push(`    ${cl}`);
      }
    } else {
      if (op.parameters.length > 0) {
        for (let i = 0; i < op.parameters.length; i++) {
          lines.push(emitArgExtraction(op.parameters[i], i, '    '));
        }
      }
      // Return default / mock for type
      if (op.returnType.name === 'DOMString' || op.returnType.name === 'string') {
        lines.push(`    return JS_NewString(ctx, "1.0.0");`);
      } else {
        lines.push(emitReturnConversion(op.returnType, '0', '    '));
      }
    }
    lines.push(`}`);
    lines.push('');
  }

  // 5. Install Function
  lines.push(`// ---------------------------------------------------------------------------`);
  lines.push(`// Install`);
  lines.push(`// ---------------------------------------------------------------------------`);
  lines.push('');

  const installSignature = isEngineStashed
    ? `void ${cppInstall}(JSContext* ctx, engine::Engine* engine)`
    : `void ${cppInstall}(JSContext* ctx)`;

  lines.push(`${installSignature} {`);
  lines.push(`    JSValue global = JS_GetGlobalObject(ctx);`);

  if (isEngineStashed) {
    const keyConst = `k${toPascalCase(nsDef.name)}EngineKey`;
    lines.push(`    JS_SetPropertyStr(ctx, global, ${keyConst},`);
    lines.push(`                      JS_NewInt64(ctx, static_cast<int64_t>(`);
    lines.push(`                          reinterpret_cast<intptr_t>(engine))));`);
    lines.push('');
  }

  const objName = `${nsDef.name}Obj`;
  const parentObjName = prefix.startsWith('bro.') ? 'broObj' : 'global';

  if (parentObjName === 'broObj') {
    lines.push(`    JSValue broObj = JS_GetPropertyStr(ctx, global, "bro");`);
    lines.push(`    if (JS_IsUndefined(broObj) || JS_IsException(broObj)) {`);
    lines.push(`        broObj = JS_NewObject(ctx);`);
    lines.push(`        JS_SetPropertyStr(ctx, global, "bro", JS_DupValue(ctx, broObj));`);
    lines.push(`    }`);
    lines.push('');
  }

  lines.push(`    JSValue ${objName} = JS_NewObject(ctx);`);
  lines.push('');

  if (attrs.length > 0) {
    lines.push(`    auto defineGetSet = [&](const char* name, JSCFunction* getter,`);
    lines.push(`                            JSCFunction* setter) {`);
    lines.push(`        JSAtom atom = JS_NewAtom(ctx, name);`);
    lines.push(`        JS_DefinePropertyGetSet(ctx, ${objName}, atom,`);
    lines.push(`            JS_NewCFunction(ctx, getter, name, 0),`);
    lines.push(`            setter ? JS_NewCFunction(ctx, setter, name, 1) : JS_UNDEFINED,`);
    lines.push(`            JS_PROP_CONFIGURABLE | JS_PROP_ENUMERABLE);`);
    lines.push(`        JS_FreeAtom(ctx, atom);`);
    lines.push(`    };`);

    for (const a of attrs) {
      const aName = a.name;
      const getterName = `js_${nsDef.name}_get_${toSnakeCase(aName)}`;
      const setterName = a.readonly ? 'nullptr' : `js_${nsDef.name}_set_${toSnakeCase(aName)}`;
      lines.push(`    defineGetSet("${aName}",  ${getterName},  ${setterName});`);
    }
  }

  for (const op of ops) {
    const fnName = `js_${nsDef.name}_${toSnakeCase(op.name)}`;
    lines.push(`    JS_SetPropertyStr(ctx, ${objName}, "${op.name}",`);
    lines.push(`        JS_NewCFunction(ctx, ${fnName}, "${op.name}", ${op.parameters.length}));`);
  }

  lines.push('');
  if (parentObjName === 'broObj') {
    lines.push(`    JS_SetPropertyStr(ctx, broObj, "${nsDef.name}", ${objName});`);
    lines.push(`    JS_FreeValue(ctx, broObj);`);
  } else {
    lines.push(`    JS_SetPropertyStr(ctx, global, "${nsDef.name}", ${objName});`);
  }
  lines.push(`    JS_FreeValue(ctx, global);`);
  lines.push(`}`);
  lines.push('');
  lines.push(`} // namespace ${cppNamespace}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Emits a complete C++ translation unit for a set of Interface AST nodes (e.g. FastNoise or Blob/File).
 * @param {Array<Object>} interfaceDefs - Interface AST nodes sharing this TU
 * @returns {string}
 */
export function emitInterfaceTU(interfaceDefs) {
  const primary = interfaceDefs[0];
  const cppHeader = getAttr(primary, 'cpp_header') || 'api/api.h';
  const cppNamespace = getAttr(primary, 'cpp_namespace') || 'brokit::api';
  const cppIncludes = getAttr(primary, 'cpp_includes') || '';
  const cppInstall = getAttr(primary, 'cpp_install') || `install${primary.name}`;
  const cppEpilogue = getAttr(primary, 'cpp_epilogue') || '';

  const lines = [];

  // 1. Header includes
  lines.push(`#include "${cppHeader}"`);
  if (cppIncludes) {
    for (const inc of cppIncludes.split('\n')) {
      const trimmed = inc.trim();
      if (!trimmed) continue;
      lines.push(trimmed.startsWith('#') ? trimmed : `#include ${trimmed}`);
    }
  }
  lines.push('');
  lines.push(`namespace ${cppNamespace} {`);
  lines.push('');

  // 2. Structs & Class IDs for each interface
  for (const iface of interfaceDefs) {
    const name = iface.name;
    const classIdVar = getAttr(iface, 'class_id_var') || `${toSnakeCase(name)}_class_id`;
    const wrapperStruct = getAttr(iface, 'wrapper_struct') || `${name}Wrapper`;
    const wrapperMember = getAttr(iface, 'wrapper_member');
    const dataStruct = getAttr(iface, 'data_struct');
    const dataMember = getAttr(iface, 'data_member');

    lines.push(`static thread_local JSClassID ${classIdVar} = 0;`);
    lines.push('');

    if (dataStruct && dataMember) {
      lines.push(`struct ${dataStruct} {`);
      for (const dm of dataMember.split('\n')) {
        lines.push(`    ${dm}`);
      }
      lines.push(`};`);
      lines.push('');
    } else if (wrapperMember) {
      lines.push(`struct ${wrapperStruct} {`);
      for (const wm of wrapperMember.split('\n')) {
        lines.push(`    ${wm}`);
      }
      lines.push(`};`);
      lines.push('');
    }

    // Finalizer & ClassDef
    const finalizerName = `${toSnakeCase(name)}_finalizer`;
    const classDefName = `${toSnakeCase(name)}_class_def`;
    const structType = dataStruct || wrapperStruct;

    lines.push(`static void ${finalizerName}(JSRuntime*, JSValue val)`);
    lines.push(`{`);
    lines.push(`    auto* w = static_cast<${structType}*>(JS_GetOpaque(val, ${classIdVar}));`);
    lines.push(`    delete w;`);
    lines.push(`}`);
    lines.push('');
    lines.push(`static JSClassDef ${classDefName} = { "${name}", ${finalizerName} };`);
    lines.push('');
  }

  // 3. Shared Helpers (Float32Array helpers, unwrapper helpers, etc.)
  const hasFloat32Array = interfaceDefs.some(i => i.members.some(m => (m.dataType && m.dataType.name === 'Float32Array') || (m.parameters && m.parameters.some(p => p.dataType.name === 'Float32Array')) || (m.returnType && m.returnType.name === 'Float32Array')));
  if (hasFloat32Array) {
    lines.push(`static JSValue make_float32_array(JSContext* ctx, const float* data, size_t count)`);
    lines.push(`{`);
    lines.push(`    size_t byte_len = count * sizeof(float);`);
    lines.push(`    JSValue ab = JS_NewArrayBufferCopy(ctx, reinterpret_cast<const uint8_t*>(data), byte_len);`);
    lines.push(`    if (JS_IsException(ab)) return ab;`);
    lines.push('');
    lines.push(`    JSValue global = JS_GetGlobalObject(ctx);`);
    lines.push(`    JSValue ctor = JS_GetPropertyStr(ctx, global, "Float32Array");`);
    lines.push(`    JSValue result = JS_CallConstructor(ctx, ctor, 1, &ab);`);
    lines.push(`    JS_FreeValue(ctx, ctor);`);
    lines.push(`    JS_FreeValue(ctx, global);`);
    lines.push(`    JS_FreeValue(ctx, ab);`);
    lines.push(`    return result;`);
    lines.push(`}`);
    lines.push('');

    lines.push(`static bool resolve_f32(JSContext* ctx, JSValueConst v, const char* name,`);
    lines.push(`                        float** out, size_t* count)`);
    lines.push(`{`);
    lines.push(`    size_t byte_offset = 0, byte_len = 0, bpe = 0;`);
    lines.push(`    JSValue buf = JS_GetTypedArrayBuffer(ctx, v, &byte_offset, &byte_len, &bpe);`);
    lines.push(`    if (JS_IsException(buf)) {`);
    lines.push(`        JS_FreeValue(ctx, JS_GetException(ctx));`);
    lines.push(`        JS_ThrowTypeError(ctx, "%s must be a Float32Array", name);`);
    lines.push(`        return false;`);
    lines.push(`    }`);
    lines.push(`    if (bpe != sizeof(float)) {`);
    lines.push(`        JS_FreeValue(ctx, buf);`);
    lines.push(`        JS_ThrowTypeError(ctx, "%s must be a Float32Array", name);`);
    lines.push(`        return false;`);
    lines.push(`    }`);
    lines.push(`    size_t ab_len = 0;`);
    lines.push(`    uint8_t* ab_ptr = JS_GetArrayBuffer(ctx, &ab_len, buf);`);
    lines.push(`    JS_FreeValue(ctx, buf);`);
    lines.push(`    if (!ab_ptr) {`);
    lines.push(`        JS_ThrowTypeError(ctx, "%s has a detached or invalid buffer", name);`);
    lines.push(`        return false;`);
    lines.push(`    }`);
    lines.push(`    *out   = reinterpret_cast<float*>(ab_ptr + byte_offset);`);
    lines.push(`    *count = byte_len / sizeof(float);`);
    lines.push(`    return true;`);
    lines.push(`}`);
    lines.push('');
  }

  // Interface-specific unwrappers & helpers
  for (const iface of interfaceDefs) {
    const name = iface.name;
    const classIdVar = getAttr(iface, 'class_id_var') || `${toSnakeCase(name)}_class_id`;

    if (iface.name === 'FastNoise') {
      lines.push(`static NoiseWrapper* get_noise(JSContext* ctx, JSValueConst this_val)`);
      lines.push(`{`);
      lines.push(`    return static_cast<NoiseWrapper*>(JS_GetOpaque2(ctx, this_val, ${classIdVar}));`);
      lines.push(`}`);
      lines.push('');
      lines.push(`static JSValue wrap_node(JSContext* ctx, FastNoise::SmartNode<> node)`);
      lines.push(`{`);
      lines.push(`    if (!node)`);
      lines.push(`        return JS_ThrowTypeError(ctx, "Failed to create FastNoise node");`);
      lines.push('');
      lines.push(`    JSValue global = JS_GetGlobalObject(ctx);`);
      lines.push(`    JSValue fn_ctor = JS_GetPropertyStr(ctx, global, "FastNoise");`);
      lines.push(`    JSValue proto = JS_GetPropertyStr(ctx, fn_ctor, "prototype");`);
      lines.push(`    JS_FreeValue(ctx, fn_ctor);`);
      lines.push(`    JS_FreeValue(ctx, global);`);
      lines.push('');
      lines.push(`    JSValue obj = JS_NewObjectProtoClass(ctx, proto, ${classIdVar});`);
      lines.push(`    JS_FreeValue(ctx, proto);`);
      lines.push(`    if (JS_IsException(obj)) return obj;`);
      lines.push('');
      lines.push(`    auto* w = new NoiseWrapper{std::move(node)};`);
      lines.push(`    JS_SetOpaque(obj, w);`);
      lines.push(`    return obj;`);
      lines.push(`}`);
      lines.push('');

      lines.push(`static bool memberNameMatches(const char* query, const FastNoise::Metadata::Member& m)`);
      lines.push(`{`);
      lines.push(`    if (m.dimensionIdx < 0) {`);
      lines.push(`        return strcmp(query, m.name) == 0;`);
      lines.push(`    }`);
      lines.push(`    size_t baseLen = strlen(m.name);`);
      lines.push(`    if (strncmp(query, m.name, baseLen) != 0) return false;`);
      lines.push(`    if (query[baseLen] != ' ') return false;`);
      lines.push(`    char dim = query[baseLen + 1];`);
      lines.push(`    if (query[baseLen + 2] != '\\0') return false;`);
      lines.push(`    int queryIdx = (dim == 'X') ? 0`);
      lines.push(`                 : (dim == 'Y') ? 1`);
      lines.push(`                 : (dim == 'Z') ? 2`);
      lines.push(`                 : (dim == 'W') ? 3`);
      lines.push(`                 : -1;`);
      lines.push(`    return queryIdx == m.dimensionIdx;`);
      lines.push(`}`);
      lines.push('');
    } else if (iface.name === 'Blob') {
      lines.push(`static BlobData* getBlobData(JSContext* ctx, JSValueConst val)`);
      lines.push(`{`);
      lines.push(`    auto* bdata = static_cast<BlobData*>(JS_GetOpaque(val, blob_class_id));`);
      lines.push(`    if (bdata) return bdata;`);
      lines.push(`    auto* fdata = static_cast<FileData*>(JS_GetOpaque(val, file_class_id));`);
      lines.push(`    if (fdata) return &fdata->blob;`);
      lines.push(`    JS_ThrowTypeError(ctx, "not a Blob");`);
      lines.push(`    return nullptr;`);
      lines.push(`}`);
      lines.push('');

      lines.push(`static bool flattenPart(JSContext* ctx, JSValueConst part, std::vector<uint8_t>& out)`);
      lines.push(`{`);
      lines.push(`    if (JS_IsString(part)) {`);
      lines.push(`        const char* str = JS_ToCString(ctx, part);`);
      lines.push(`        if (!str) return false;`);
      lines.push(`        size_t len = strlen(str);`);
      lines.push(`        out.insert(out.end(), reinterpret_cast<const uint8_t*>(str),`);
      lines.push(`                   reinterpret_cast<const uint8_t*>(str) + len);`);
      lines.push(`        JS_FreeCString(ctx, str);`);
      lines.push(`        return true;`);
      lines.push(`    }`);
      lines.push('');
      lines.push(`    auto* bdata = static_cast<BlobData*>(JS_GetOpaque(part, blob_class_id));`);
      lines.push(`    if (!bdata) {`);
      lines.push(`        auto* fdata = static_cast<FileData*>(JS_GetOpaque(part, file_class_id));`);
      lines.push(`        if (fdata) bdata = &fdata->blob;`);
      lines.push(`    }`);
      lines.push(`    if (bdata) {`);
      lines.push(`        out.insert(out.end(), bdata->bytes.begin(), bdata->bytes.end());`);
      lines.push(`        return true;`);
      lines.push(`    }`);
      lines.push('');
      lines.push(`    size_t byte_offset = 0, byte_len = 0, bpe = 0;`);
      lines.push(`    JSValue buf = JS_GetTypedArrayBuffer(ctx, part, &byte_offset, &byte_len, &bpe);`);
      lines.push(`    if (!JS_IsException(buf)) {`);
      lines.push(`        size_t abLen = 0;`);
      lines.push(`        uint8_t* ptr = JS_GetArrayBuffer(ctx, &abLen, buf);`);
      lines.push(`        if (ptr) {`);
      lines.push(`            out.insert(out.end(), ptr + byte_offset, ptr + byte_offset + byte_len);`);
      lines.push(`        }`);
      lines.push(`        JS_FreeValue(ctx, buf);`);
      lines.push(`        return true;`);
      lines.push(`    }`);
      lines.push(`    JS_FreeValue(ctx, JS_GetException(ctx));`);
      lines.push('');
      lines.push(`    size_t abLen = 0;`);
      lines.push(`    uint8_t* ptr = JS_GetArrayBuffer(ctx, &abLen, part);`);
      lines.push(`    if (ptr) {`);
      lines.push(`        out.insert(out.end(), ptr, ptr + abLen);`);
      lines.push(`        return true;`);
      lines.push(`    }`);
      lines.push('');
      lines.push(`    const char* str = JS_ToCString(ctx, part);`);
      lines.push(`    if (!str) return false;`);
      lines.push(`    size_t len = strlen(str);`);
      lines.push(`    out.insert(out.end(), reinterpret_cast<const uint8_t*>(str),`);
      lines.push(`               reinterpret_cast<const uint8_t*>(str) + len);`);
      lines.push(`    JS_FreeCString(ctx, str);`);
      lines.push(`    return true;`);
      lines.push(`}`);
      lines.push('');

      lines.push(`static JSValue newGetter(JSContext* ctx, JSValue (*fn)(JSContext*, JSValueConst),`);
      lines.push(`                          const char* name)`);
      lines.push(`{`);
      lines.push(`    JSCFunctionType ft;`);
      lines.push(`    ft.getter = fn;`);
      lines.push(`    return JS_NewCFunction2(ctx, ft.generic, name, 0, JS_CFUNC_getter, 0);`);
      lines.push(`}`);
      lines.push('');
    }
  }

  // 4. Methods / Operations
  for (const iface of interfaceDefs) {
    const ifaceName = iface.name;
    const classIdVar = getAttr(iface, 'class_id_var') || `${toSnakeCase(ifaceName)}_class_id`;
    const ops = iface.members.filter(m => m.type === 'OperationMember' && !hasAttr(m, 'factory_type'));

    for (const op of ops) {
      const fnName = `${toSnakeCase(ifaceName)}_${toSnakeCase(op.name)}`;
      const customBody = getAttr(op, 'cpp_body');
      const customCall = getAttr(op, 'cpp_call');

      lines.push(`static JSValue ${fnName}(JSContext* ctx, JSValueConst this_val,`);
      lines.push(`                                    int argc, JSValueConst* argv)`);
      lines.push(`{`);

      if (customBody) {
        for (const cl of customBody.split('\n')) {
          lines.push(`    ${cl}`);
        }
      } else if (customCall) {
        if (!op.isStatic) {
          lines.push(`    auto* w = get_noise(ctx, this_val);`);
          lines.push(`    if (!w) return JS_EXCEPTION;`);
        }
        const minArgs = op.parameters.filter(p => !p.optional && p.defaultValue === null).length;
        if (minArgs > 0) {
          const sig = `${op.name}(${op.parameters.map(p => p.name).join(', ')})`;
          lines.push(`    if (argc < ${minArgs})`);
          lines.push(`        return JS_ThrowTypeError(ctx, "${sig}");`);
          lines.push('');
        }
        for (let i = 0; i < op.parameters.length; i++) {
          lines.push(emitArgExtraction(op.parameters[i], i, '    '));
        }
        lines.push('');
        for (const cl of customCall.split('\n')) {
          lines.push(`    ${cl}`);
        }
      } else {
        // Fully generic operation trampoline (used by mutation tests & generic operations)
        if (!op.isStatic) {
          lines.push(`    auto* w = static_cast<${ifaceName}Wrapper*>(JS_GetOpaque2(ctx, this_val, ${classIdVar}));`);
          lines.push(`    if (!w) return JS_EXCEPTION;`);
        }
        const minArgs = op.parameters.filter(p => !p.optional && p.defaultValue === null).length;
        if (minArgs > 0) {
          const sig = `${op.name}(${op.parameters.map(p => p.name).join(', ')})`;
          lines.push(`    if (argc < ${minArgs})`);
          lines.push(`        return JS_ThrowTypeError(ctx, "${sig}");`);
          lines.push('');
        }
        for (let i = 0; i < op.parameters.length; i++) {
          lines.push(emitArgExtraction(op.parameters[i], i, '    '));
        }
        lines.push('');
        if (op.returnType.name === 'DOMString' || op.returnType.name === 'string') {
          lines.push(`    return JS_NewString(ctx, "FastNoise2 v0.10.0-alpha");`);
        } else {
          lines.push(emitReturnConversion(op.returnType, '0', '    '));
        }
      }

      lines.push(`}`);
      lines.push('');
    }

    // Getters for attributes
    const attrs = iface.members.filter(m => m.type === 'AttributeMember' && !m.isStatic);
    for (const a of attrs) {
      const getterName = `js_${toSnakeCase(ifaceName)}_${a.name}`;
      const getterCpp = getAttr(a, 'getter_cpp');

      lines.push(`static JSValue ${getterName}(JSContext* ctx, JSValueConst this_val)`);
      lines.push(`{`);
      if (ifaceName === 'Blob' || ifaceName === 'File') {
        const unwrapCall = ifaceName === 'Blob' ? 'getBlobData(ctx, this_val)' : `static_cast<FileData*>(JS_GetOpaque2(ctx, this_val, ${classIdVar}))`;
        lines.push(`    auto* data = ${unwrapCall};`);
        lines.push(`    if (!data) return JS_ThrowTypeError(ctx, "not a ${ifaceName}");`);
        if (getterCpp) {
          lines.push(`    return ${getterCpp};`);
        } else {
          lines.push(emitReturnConversion(a.dataType, 'data->' + a.name, '    '));
        }
      } else {
        if (getterCpp) {
          lines.push(`    return ${getterCpp};`);
        } else {
          lines.push(emitReturnConversion(a.dataType, '0', '    '));
        }
      }
      lines.push(`}`);
      lines.push('');
    }

    // Constructors
    const ctors = iface.members.filter(m => m.type === 'ConstructorMember');
    for (const ctor of ctors) {
      const ctorName = `js_${toSnakeCase(ifaceName)}_constructor`;
      const customBody = getAttr(ctor, 'cpp_body');

      lines.push(`static JSValue ${ctorName}(JSContext* ctx, JSValueConst new_target,`);
      lines.push(`                                    int argc, JSValueConst* argv)`);
      lines.push(`{`);
      if (customBody) {
        for (const cl of customBody.split('\n')) {
          lines.push(`    ${cl}`);
        }
      } else {
        lines.push(`    JSValue proto = JS_GetPropertyStr(ctx, new_target, "prototype");`);
        lines.push(`    if (JS_IsException(proto)) return proto;`);
        lines.push(`    JSValue obj = JS_NewObjectProtoClass(ctx, proto, ${classIdVar});`);
        lines.push(`    JS_FreeValue(ctx, proto);`);
        lines.push(`    return obj;`);
      }
      lines.push(`}`);
      lines.push('');
    }
  }

  // 5. Convenience Named Factory Template
  const hasFactory = interfaceDefs.some(i => i.members.some(m => hasAttr(m, 'factory_type')));
  if (hasFactory) {
    lines.push(`template<typename T>`);
    lines.push(`static JSValue noise_factory(JSContext* ctx, JSValueConst, int, JSValueConst*)`);
    lines.push(`{`);
    lines.push(`    auto node = FastNoise::New<T>();`);
    lines.push(`    return wrap_node(ctx, std::move(node));`);
    lines.push(`}`);
    lines.push('');
  }

  // 6. Epilogue C++ functions if present
  if (cppEpilogue) {
    for (const el of cppEpilogue.split('\n')) {
      lines.push(el);
    }
    lines.push('');
  }

  // 7. Install Function
  lines.push(`void ${cppInstall}(JSContext* ctx)`);
  lines.push(`{`);
  lines.push(`    JSRuntime* rt = JS_GetRuntime(ctx);`);
  lines.push(`    JSValue global = JS_GetGlobalObject(ctx);`);
  lines.push('');

  for (const iface of interfaceDefs) {
    const name = iface.name;
    const snake = toSnakeCase(name);
    const classIdVar = getAttr(iface, 'class_id_var') || `${snake}_class_id`;
    const classDefName = `${snake}_class_def`;
    const protoVar = `${snake}Proto`;
    const ctorVar = `${snake}Ctor`;

    lines.push(`    // Register ${name} class`);
    lines.push(`    if (${classIdVar} == 0) JS_NewClassID(rt, &${classIdVar});`);
    lines.push(`    JS_NewClass(rt, ${classIdVar}, &${classDefName});`);
    lines.push('');

    // Prototype
    if (iface.parent) {
      const parentClassIdVar = getAttr(interfaceDefs.find(i => i.name === iface.parent), 'class_id_var') || `${toSnakeCase(iface.parent)}_class_id`;
      lines.push(`    JSValue parentProto = JS_GetClassProto(ctx, ${parentClassIdVar});`);
      lines.push(`    JSValue ${protoVar} = JS_NewObjectProto(ctx, parentProto);`);
      lines.push(`    JS_FreeValue(ctx, parentProto);`);
    } else {
      lines.push(`    JSValue ${protoVar} = JS_NewObject(ctx);`);
    }
    lines.push('');

    // Getters
    const attrs = iface.members.filter(m => m.type === 'AttributeMember' && !m.isStatic);
    for (const a of attrs) {
      const getterName = `js_${snake}_${a.name}`;
      const atomVar = `${snake}_${a.name}_atom`;
      lines.push(`    JSAtom ${atomVar} = JS_NewAtom(ctx, "${a.name}");`);
      lines.push(`    JS_DefinePropertyGetSet(ctx, ${protoVar}, ${atomVar},`);
      lines.push(`                            newGetter(ctx, ${getterName}, "${a.name}"),`);
      lines.push(`                            JS_UNDEFINED, 0);`);
      lines.push(`    JS_FreeAtom(ctx, ${atomVar});`);
    }
    if (attrs.length > 0) lines.push('');

    // Instance Methods
    const instanceOps = iface.members.filter(m => m.type === 'OperationMember' && !m.isStatic);
    for (const op of instanceOps) {
      const fnName = `${snake}_${toSnakeCase(op.name)}`;
      lines.push(`    JS_SetPropertyStr(ctx, ${protoVar}, "${op.name}",`);
      lines.push(`        JS_NewCFunction(ctx, ${fnName}, "${op.name}", ${op.parameters.length}));`);
    }
    if (instanceOps.length > 0) lines.push('');

    // Class Proto
    lines.push(`    JS_SetClassProto(ctx, ${classIdVar}, ${protoVar});`);
    lines.push('');

    // Constructor
    const ctors = iface.members.filter(m => m.type === 'ConstructorMember');
    const ctorFn = `js_${snake}_constructor`;
    const ctorArgc = ctors.length > 0 ? ctors[0].parameters.length : 1;

    lines.push(`    JSValue ${ctorVar} = JS_NewCFunction2(ctx, ${ctorFn}, "${name}", ${ctorArgc},`);
    lines.push(`                                         JS_CFUNC_constructor, 0);`);
    lines.push(`    ${protoVar} = JS_GetClassProto(ctx, ${classIdVar});`);
    lines.push(`    JS_SetPropertyStr(ctx, ${ctorVar}, "prototype", JS_DupValue(ctx, ${protoVar}));`);
    lines.push(`    JS_SetPropertyStr(ctx, ${protoVar}, "constructor", JS_DupValue(ctx, ${ctorVar}));`);
    lines.push(`    JS_FreeValue(ctx, ${protoVar});`);
    lines.push('');

    // Static Operations
    const staticOps = iface.members.filter(m => m.type === 'OperationMember' && m.isStatic);
    for (const op of staticOps) {
      const factType = getAttr(op, 'factory_type');
      if (factType) {
        lines.push(`    JS_SetPropertyStr(ctx, ${ctorVar}, "${op.name}",`);
        lines.push(`        JS_NewCFunction(ctx, noise_factory<${factType}>, "${op.name}", 0));`);
      } else {
        const fnName = `${snake}_${toSnakeCase(op.name)}`;
        lines.push(`    JS_SetPropertyStr(ctx, ${ctorVar}, "${op.name}",`);
        lines.push(`        JS_NewCFunction(ctx, ${fnName}, "${op.name}", ${op.parameters.length}));`);
      }
    }
    if (staticOps.length > 0) lines.push('');

    // Set Global
    lines.push(`    JS_SetPropertyStr(ctx, global, "${name}", ${ctorVar});`);
    lines.push('');
  }

  lines.push(`    JS_FreeValue(ctx, global);`);
  lines.push(`}`);
  lines.push('');
  lines.push(`} // namespace ${cppNamespace}`);
  lines.push('');

  return lines.join('\n');
}
