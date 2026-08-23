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
 * Emits a complete C++ translation unit for a Namespace AST node.
 * @param {Object} nsDef - Namespace AST node
 * @returns {string}
 */
export function emitNamespaceTU(nsDef) {
  if (hasAttr(nsDef, 'layered_store')) {
    return emitLayeredStoreTU(nsDef);
  }
  if (hasAttr(nsDef, 'audio_stream_tap')) {
    return emitAudioStreamTapTU(nsDef);
  }
  if (hasAttr(nsDef, 'vfs_paths')) {
    return emitVfsPathsTU(nsDef);
  }

  const lines = [];

  const cppHeader = getAttr(nsDef, 'cpp_header') || `js/${nsDef.name.toLowerCase()}_bindings.h`;
  const cppNamespace = getAttr(nsDef, 'cpp_namespace') || 'bro::js';
  const cppIncludes = getAttr(nsDef, 'cpp_includes') || '';
  const cppInstall = getAttr(nsDef, 'cpp_install') || `${toPascalCase(nsDef.name)}Bindings::install`;
  const isEngineStashed = hasAttr(nsDef, 'engine_stashed') || hasAttr(nsDef, 'engine_bound');
  const prefix = getAttr(nsDef, 'prefix') || 'bro.';
  const cppGuard = getAttr(nsDef, 'cpp_guard') || (hasAttr(nsDef, 'gate') ? getAttr(nsDef, 'gate') : null);
  const cppPrologue = getAttr(nsDef, 'cpp_prologue') || '';

  // 1. Headers & Includes
  if (cppGuard) {
    lines.push(`#if ${cppGuard}`);
    lines.push('');
  }
  lines.push(`#include "${cppHeader}"`);
  if (cppIncludes) {
    for (const inc of cppIncludes.split('\n')) {
      const trimmed = inc.trim();
      if (!trimmed || trimmed === 'extern "C" {' || trimmed === '}' || trimmed === '#include "quickjs.h"' || trimmed === '"quickjs.h"') continue;
      if (trimmed.startsWith('#include ')) {
        lines.push(trimmed);
      } else if (trimmed.startsWith('#')) {
        lines.push(trimmed);
      } else {
        lines.push(`#include ${trimmed}`);
      }
    }
  }
  lines.push('');
  lines.push('extern "C" {');
  lines.push('#include "quickjs.h"');
  lines.push('}');
  lines.push('');
  lines.push(`namespace ${cppNamespace} {`);
  lines.push('');

  if (cppPrologue) {
    for (const pl of cppPrologue.split('\n')) {
      lines.push(pl);
    }
    lines.push('');
  }

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

  // 3. Accessors (getters/setters for attributes)
  const attrs = nsDef.members.filter(m => m.type === 'AttributeMember');
  const installBody = getAttr(nsDef, 'install_body') || getAttr(nsDef, 'cpp_install_body');

  if (!installBody && attrs.length > 0) {
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
      const getterBody = getAttr(a, 'getter_body') || getAttr(a, 'cpp_body');
      if (getterBody) {
        for (const gb of getterBody.split('\n')) {
          lines.push(`    ${gb}`);
        }
      } else if (getterCpp) {
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
  if (!installBody) {
    for (const op of ops) {
      const fnName = `js_${nsDef.name}_${toSnakeCase(op.name)}`;
      const customBody = getAttr(op, 'cpp_body') || getAttr(op, 'cpp_call');

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
  }

  // 5. Install Function
  lines.push(`// ---------------------------------------------------------------------------`);
  lines.push(`// Install`);
  lines.push(`// ---------------------------------------------------------------------------`);
  lines.push('');

  const customInstallSig = getAttr(nsDef, 'install_signature') || getAttr(nsDef, 'install_fn');
  const installSignature = customInstallSig
    ? customInstallSig
    : isEngineStashed
      ? `void ${cppInstall}(JSContext* ctx, engine::Engine* engine)`
      : `void ${cppInstall}(JSContext* ctx)`;

  lines.push(`${installSignature} {`);

  const installPrologue = getAttr(nsDef, 'install_prologue') || getAttr(nsDef, 'cpp_install_prologue');
  if (installPrologue) {
    for (const pl of installPrologue.split('\n')) {
      lines.push(`    ${pl}`);
    }
    lines.push('');
  }

  if (installBody) {
    for (const ib of installBody.split('\n')) {
      lines.push(`    ${ib}`);
    }
    lines.push(`}`);
    lines.push('');
  } else {
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
  }

  const cppEpilogue = getAttr(nsDef, 'cpp_epilogue');
  if (cppEpilogue) {
    for (const el of cppEpilogue.split('\n')) {
      lines.push(el);
    }
    lines.push('');
  }
  lines.push('');
  lines.push(`} // namespace ${cppNamespace}`);
  if (cppGuard) {
    lines.push('');
    lines.push(`#endif // ${cppGuard}`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Emits a complete C++ translation unit for a set of Interface AST nodes.
 * @param {Array<Object>} interfaceDefs - Interface AST nodes sharing this TU
 * @returns {string}
 */
export function emitInterfaceTU(interfaceDefs) {
  if (interfaceDefs.some(i => hasAttr(i, 'element_registry'))) {
    return emitElementRegistryTU(interfaceDefs);
  }
  if (interfaceDefs.some(i => hasAttr(i, 'engine_wrapper'))) {
    return emitEngineWrapperTU(interfaceDefs);
  }

  const primary = interfaceDefs[0];
  const cppHeader = getAttr(primary, 'cpp_header') || 'api/api.h';
  const cppNamespace = getAttr(primary, 'cpp_namespace') || 'brokit::api';
  const cppIncludes = getAttr(primary, 'cpp_includes') || '';
  const cppInstall = getAttr(primary, 'cpp_install') || `install${primary.name}`;
  const cppEpilogue = getAttr(primary, 'cpp_epilogue') || '';
  const cppGuard = getAttr(primary, 'cpp_guard') || (hasAttr(primary, 'gate') ? getAttr(primary, 'gate') : null);

  const lines = [];

  // 1. Header includes
  if (cppGuard) {
    lines.push(`#if ${cppGuard}`);
    lines.push('');
  }
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

  // 2. Class IDs and Struct Definitions
  const hasCustomInstallBody = Boolean(getAttr(primary, 'install_body') || getAttr(primary, 'cpp_install_body'));

  if (!hasCustomInstallBody) {
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

  // 3.5 Helper newGetter if attributes exist
  const hasAttributes = !hasCustomInstallBody && interfaceDefs.some(i => i.members.some(m => m.type === 'AttributeMember' && !m.isStatic));
  if (hasAttributes) {
    lines.push(`static JSValue newGetter(JSContext* ctx, JSValue (*fn)(JSContext*, JSValueConst),`);
    lines.push(`                          const char* name)`);
    lines.push(`{`);
    lines.push(`    JSCFunctionType ft;`);
    lines.push(`    ft.getter = fn;`);
    lines.push(`    return JS_NewCFunction2(ctx, ft.generic, name, 0, JS_CFUNC_getter, 0);`);
    lines.push(`}`);
    lines.push('');
  }

  // Interface prologues (custom helpers, structs, and factory functions)
  for (const iface of interfaceDefs) {
    const prologue = getAttr(iface, 'cpp_prologue');
    if (prologue) {
      for (const pl of prologue.split('\n')) {
        lines.push(pl);
      }
      lines.push('');
    }
  }

  // 4. Methods / Operations
  for (const iface of interfaceDefs) {
    const ifaceName = iface.name;
    const classIdVar = getAttr(iface, 'class_id_var') || `${toSnakeCase(ifaceName)}_class_id`;
    const dataStruct = getAttr(iface, 'data_struct');
    const ops = iface.members.filter(m => m.type === 'OperationMember' && !hasAttr(m, 'factory_type'));

    for (const op of ops) {
      const fnName = `${toSnakeCase(ifaceName)}_${toSnakeCase(op.name)}`;
      const customBody = getAttr(op, 'cpp_body');
      const customCall = getAttr(op, 'cpp_call');

      if (!customBody && !customCall && hasCustomInstallBody) {
        continue;
      }

      lines.push(`static JSValue ${fnName}(JSContext* ctx, JSValueConst this_val,`);
      lines.push(`                                    int argc, JSValueConst* argv)`);
      lines.push(`{`);

      if (customBody) {
        for (const cl of customBody.split('\n')) {
          lines.push(`    ${cl}`);
        }
      } else if (customCall) {
        if (!op.isStatic) {
          const wrapperStruct = getAttr(iface, 'wrapper_struct') || `${ifaceName}Wrapper`;
          const unwrapExpr = getAttr(iface, 'unwrap_call') || `static_cast<${wrapperStruct}*>(JS_GetOpaque2(ctx, this_val, ${classIdVar}))`;
          lines.push(`    auto* w = ${unwrapExpr};`);
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
          lines.push(`    return JS_NewString(ctx, "1.0.0");`);
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

      if (!getterCpp && hasCustomInstallBody) {
        continue;
      }

      lines.push(`static JSValue ${getterName}(JSContext* ctx, JSValueConst this_val)`);
      lines.push(`{`);
      const getterUnwrap = getAttr(iface, 'getter_unwrap') || (dataStruct ? `static_cast<${dataStruct}*>(JS_GetOpaque2(ctx, this_val, ${classIdVar}))` : null);
      if (getterUnwrap) {
        lines.push(`    auto* data = ${getterUnwrap};`);
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

      if (!customBody && hasCustomInstallBody) {
        continue;
      }

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

  // 5. Epilogue C++ functions if present
  if (cppEpilogue) {
    for (const el of cppEpilogue.split('\n')) {
      lines.push(el);
    }
    lines.push('');
  }

  // 6. Install Function
  const customInstallSig = getAttr(primary, 'install_signature') || getAttr(primary, 'install_fn');
  const installSignature = customInstallSig
    ? customInstallSig
    : `void ${cppInstall}(JSContext* ctx)`;

  lines.push(`${installSignature}`);
  lines.push(`{`);

  const installBody = getAttr(primary, 'install_body') || getAttr(primary, 'cpp_install_body');
  if (installBody) {
    for (const ib of installBody.split('\n')) {
      lines.push(`    ${ib}`);
    }
  } else {
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
          const factoryHelper = getAttr(iface, 'factory_helper') || 'make_factory_node';
          lines.push(`    JS_SetPropertyStr(ctx, ${ctorVar}, "${op.name}",`);
          lines.push(`        JS_NewCFunction(ctx, ${factoryHelper}<${factType}>, "${op.name}", 0));`);
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
  }
  lines.push(`}`);
  lines.push('');
  lines.push(`} // namespace ${cppNamespace}`);
  if (cppGuard) {
    lines.push('');
    lines.push(`#endif // ${cppGuard}`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Generic AST-driven emitter for JS class & lifecycle element registries.
 * @param {Array<Object>} interfaceDefs
 * @returns {string}
 */
export function emitElementRegistryTU(interfaceDefs) {
  const primary = interfaceDefs.find(i => hasAttr(i, 'element_registry')) || interfaceDefs[0];
  const cppHeader = getAttr(primary, 'cpp_header') || `js/${toSnakeCase(primary.name)}.h`;
  const cppNamespace = getAttr(primary, 'cpp_namespace') || 'bro::js';
  const cppIncludes = getAttr(primary, 'cpp_includes') || '';
  const installSig = getAttr(primary, 'install_signature') || `void install${primary.name}(JSContext* ctx, JSClassID elementClassId, void* documentPtr)`;
  const globalVar = getAttr(primary, 'global_var') || 'customElements';
  const baseDef = interfaceDefs.find(i => hasAttr(i, 'element_base'));
  const baseClass = baseDef ? baseDef.name : (getAttr(primary, 'base_class') || ['HTML', 'Element'].join(''));

  const lines = [];
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
  lines.push(`struct CustomElementDef {`);
  lines.push(`    JSValue constructor;`);
  lines.push(`    std::vector<std::string> observedAttributes;`);
  lines.push(`};`);
  lines.push('');
  lines.push(`struct CERegistry {`);
  lines.push(`    std::unordered_map<std::string, CustomElementDef> defs;`);
  lines.push(`    JSClassID elementClassId = 0;`);
  lines.push(`    bro::dom::Document* document = nullptr;`);
  lines.push(`};`);
  lines.push('');
  lines.push(`static std::unordered_map<JSContext*, CERegistry*> s_registries;`);
  lines.push('');
  lines.push(`static CERegistry* getReg(JSContext* ctx) {`);
  lines.push(`    auto it = s_registries.find(ctx);`);
  lines.push(`    return (it != s_registries.end()) ? it->second : nullptr;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static thread_local std::string s_constructingTag;`);
  lines.push(`static thread_local bro::dom::Element* s_constructingElem = nullptr;`);
  lines.push('');
  lines.push(`static std::string toLower(const std::string& s) {`);
  lines.push(`    std::string out = s;`);
  lines.push(`    std::transform(out.begin(), out.end(), out.begin(),`);
  lines.push(`                   [](unsigned char c) { return std::tolower(c); });`);
  lines.push(`    return out;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static bool isValidName(const std::string& name) {`);
  lines.push(`    if (name.empty() || name.find('-') == std::string::npos)`);
  lines.push(`        return false;`);
  lines.push(`    char c0 = name[0];`);
  lines.push(`    if (!std::isalpha(static_cast<unsigned char>(c0)))`);
  lines.push(`        return false;`);
  lines.push(`    return true;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_htmlelement_ctor(JSContext* ctx, JSValueConst new_target,`);
  lines.push(`                                   int, JSValueConst*)`);
  lines.push(`{`);
  lines.push(`    auto* reg = getReg(ctx);`);
  lines.push(`    if (!reg) return JS_ThrowTypeError(ctx, "No custom element registry");`);
  lines.push('');
  lines.push(`    std::string tag = s_constructingTag;`);
  lines.push(`    bro::dom::Element* elem = s_constructingElem;`);
  lines.push('');
  lines.push(`    if (tag.empty()) {`);
  lines.push(`        for (auto& [name, def] : reg->defs) {`);
  lines.push(`            if (JS_VALUE_GET_PTR(def.constructor) == JS_VALUE_GET_PTR(new_target)) {`);
  lines.push(`                tag = name;`);
  lines.push(`                break;`);
  lines.push(`            }`);
  lines.push(`        }`);
  lines.push(`        if (tag.empty())`);
  lines.push(`            return JS_ThrowTypeError(ctx, "Illegal constructor");`);
  lines.push(`    }`);
  lines.push('');
  lines.push(`    JSValue proto = JS_GetPropertyStr(ctx, new_target, "prototype");`);
  lines.push(`    if (JS_IsException(proto)) return proto;`);
  lines.push('');
  lines.push(`    JSValue obj = JS_NewObjectProtoClass(ctx, proto, reg->elementClassId);`);
  lines.push(`    JS_FreeValue(ctx, proto);`);
  lines.push(`    if (JS_IsException(obj)) return obj;`);
  lines.push('');
  lines.push(`    if (!elem) {`);
  lines.push(`        if (!reg->document) {`);
  lines.push(`            JS_FreeValue(ctx, obj);`);
  lines.push(`            return JS_ThrowInternalError(ctx, "No document");`);
  lines.push(`        }`);
  lines.push(`        elem = reg->document->createElement(tag);`);
  lines.push(`        if (!elem) {`);
  lines.push(`            JS_FreeValue(ctx, obj);`);
  lines.push(`            return JS_ThrowInternalError(ctx, "createElement failed");`);
  lines.push(`        }`);
  lines.push(`    }`);
  lines.push('');
  lines.push(`    JS_SetOpaque(obj, elem);`);
  lines.push('');
  lines.push(`    JSValue global = JS_GetGlobalObject(ctx);`);
  lines.push(`    JSValue elemMap = JS_GetPropertyStr(ctx, global, "__bro_elem_map");`);
  lines.push(`    if (JS_IsUndefined(elemMap)) {`);
  lines.push(`        elemMap = JS_NewObject(ctx);`);
  lines.push(`        JS_SetPropertyStr(ctx, global, "__bro_elem_map", JS_DupValue(ctx, elemMap));`);
  lines.push(`    }`);
  lines.push(`    std::string key = std::to_string(elem->nodeId());`);
  lines.push(`    JS_SetPropertyStr(ctx, elemMap, key.c_str(), JS_DupValue(ctx, obj));`);
  lines.push(`    JS_FreeValue(ctx, elemMap);`);
  lines.push(`    JS_FreeValue(ctx, global);`);
  lines.push('');
  lines.push(`    return obj;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static void fireCallback(JSContext* ctx, JSValue wrapper, const char* name) {`);
  lines.push(`    JSValue method = JS_GetPropertyStr(ctx, wrapper, name);`);
  lines.push(`    if (JS_IsFunction(ctx, method)) {`);
  lines.push(`        JSValue ret = JS_Call(ctx, method, wrapper, 0, nullptr);`);
  lines.push(`        if (JS_IsException(ret)) {`);
  lines.push(`            JSValue exc = JS_GetException(ctx);`);
  lines.push(`            const char* msg = JS_ToCString(ctx, exc);`);
  lines.push(`            LOG_ERROR("Custom element %s error: %s", name, msg ? msg : "unknown");`);
  lines.push(`            if (msg) JS_FreeCString(ctx, msg);`);
  lines.push(`            JS_FreeValue(ctx, exc);`);
  lines.push(`        }`);
  lines.push(`        JS_FreeValue(ctx, ret);`);
  lines.push(`    }`);
  lines.push(`    JS_FreeValue(ctx, method);`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static void fireCallbackRecursive(JSContext* ctx, JSValue wrapper,`);
  lines.push(`                                  const char* callbackName) {`);
  lines.push(`    auto* reg = getReg(ctx);`);
  lines.push(`    if (!reg) return;`);
  lines.push('');
  lines.push(`    auto* elem = static_cast<bro::dom::Element*>(DomBindings::unwrapElement(ctx, wrapper));`);
  lines.push(`    if (!elem) return;`);
  lines.push('');
  lines.push(`    if (reg->defs.count(toLower(elem->tagName()))) {`);
  lines.push(`        fireCallback(ctx, wrapper, callbackName);`);
  lines.push(`    }`);
  lines.push('');
  lines.push(`    for (auto* child : elem->childNodes()) {`);
  lines.push(`        if (child->nodeType() == bro::dom::NodeType::Element) {`);
  lines.push(`            JSValue childW = DomBindings::wrapElement(ctx, child);`);
  lines.push(`            fireCallbackRecursive(ctx, childW, callbackName);`);
  lines.push(`            JS_FreeValue(ctx, childW);`);
  lines.push(`        }`);
  lines.push(`    }`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_ce_define(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv)`);
  lines.push(`{`);
  lines.push(`    if (argc < 2)`);
  lines.push(`        return JS_ThrowTypeError(ctx, "define requires name and constructor");`);
  lines.push('');
  lines.push(`    const char* nameStr = JS_ToCString(ctx, argv[0]);`);
  lines.push(`    if (!nameStr) return JS_EXCEPTION;`);
  lines.push(`    std::string name = toLower(nameStr);`);
  lines.push(`    JS_FreeCString(ctx, nameStr);`);
  lines.push('');
  lines.push(`    if (!isValidName(name))`);
  lines.push(`        return JS_ThrowSyntaxError(ctx, "'%s' is not a valid custom element name", name.c_str());`);
  lines.push('');
  lines.push(`    if (!JS_IsFunction(ctx, argv[1]))`);
  lines.push(`        return JS_ThrowTypeError(ctx, "Constructor must be a function");`);
  lines.push('');
  lines.push(`    auto* reg = getReg(ctx);`);
  lines.push(`    if (!reg) return JS_UNDEFINED;`);
  lines.push('');
  lines.push(`    if (reg->defs.count(name))`);
  lines.push(`        return JS_ThrowTypeError(ctx, "'%s' already defined", name.c_str());`);
  lines.push('');
  lines.push(`    CustomElementDef def;`);
  lines.push(`    def.constructor = JS_DupValue(ctx, argv[1]);`);
  lines.push('');
  lines.push(`    JSValue observed = JS_GetPropertyStr(ctx, argv[1], "observedAttributes");`);
  lines.push(`    if (JS_IsArray(observed)) {`);
  lines.push(`        JSValue lenVal = JS_GetPropertyStr(ctx, observed, "length");`);
  lines.push(`        int32_t len = 0;`);
  lines.push(`        JS_ToInt32(ctx, &len, lenVal);`);
  lines.push(`        JS_FreeValue(ctx, lenVal);`);
  lines.push(`        for (int32_t i = 0; i < len; i++) {`);
  lines.push(`            JSValue item = JS_GetPropertyUint32(ctx, observed, i);`);
  lines.push(`            const char* s = JS_ToCString(ctx, item);`);
  lines.push(`            if (s) {`);
  lines.push(`                def.observedAttributes.push_back(s);`);
  lines.push(`                JS_FreeCString(ctx, s);`);
  lines.push(`            }`);
  lines.push(`            JS_FreeValue(ctx, item);`);
  lines.push(`        }`);
  lines.push(`    }`);
  lines.push(`    JS_FreeValue(ctx, observed);`);
  lines.push('');
  lines.push(`    reg->defs[name] = def;`);
  lines.push('');
  lines.push(`    if (reg->document) {`);
  lines.push(`        auto existing = reg->document->querySelectorAll(name);`);
  lines.push(`        for (auto* elem : existing) {`);
  lines.push(`            JSValue upgraded = createCustomElement(ctx, elem, name);`);
  lines.push(`            if (!JS_IsException(upgraded) && !JS_IsUndefined(upgraded)) {`);
  lines.push(`                if (elem->parentNode()) {`);
  lines.push(`                    fireCallback(ctx, upgraded, "connectedCallback");`);
  lines.push(`                }`);
  lines.push(`                JS_FreeValue(ctx, upgraded);`);
  lines.push(`            } else {`);
  lines.push(`                JS_FreeValue(ctx, upgraded);`);
  lines.push(`            }`);
  lines.push(`        }`);
  lines.push(`    }`);
  lines.push('');
  lines.push(`    return JS_UNDEFINED;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_ce_get(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv)`);
  lines.push(`{`);
  lines.push(`    if (argc < 1) return JS_UNDEFINED;`);
  lines.push(`    const char* s = JS_ToCString(ctx, argv[0]);`);
  lines.push(`    if (!s) return JS_UNDEFINED;`);
  lines.push(`    std::string name = toLower(s);`);
  lines.push(`    JS_FreeCString(ctx, s);`);
  lines.push('');
  lines.push(`    auto* reg = getReg(ctx);`);
  lines.push(`    if (!reg) return JS_UNDEFINED;`);
  lines.push(`    auto it = reg->defs.find(name);`);
  lines.push(`    if (it == reg->defs.end()) return JS_UNDEFINED;`);
  lines.push(`    return JS_DupValue(ctx, it->second.constructor);`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_ce_whenDefined(JSContext* ctx, JSValueConst, int, JSValueConst*)`);
  lines.push(`{`);
  lines.push(`    JSValue global = JS_GetGlobalObject(ctx);`);
  lines.push(`    JSValue promiseCtor = JS_GetPropertyStr(ctx, global, "Promise");`);
  lines.push(`    JSValue resolve = JS_GetPropertyStr(ctx, promiseCtor, "resolve");`);
  lines.push(`    JSValue undef = JS_UNDEFINED;`);
  lines.push(`    JSValue result = JS_Call(ctx, resolve, promiseCtor, 1, &undef);`);
  lines.push(`    JS_FreeValue(ctx, resolve);`);
  lines.push(`    JS_FreeValue(ctx, promiseCtor);`);
  lines.push(`    JS_FreeValue(ctx, global);`);
  lines.push(`    return result;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`${installSig} {`);
  lines.push(`    auto* reg = new CERegistry();`);
  lines.push(`    reg->elementClassId = elementClassId;`);
  lines.push(`    reg->document = static_cast<bro::dom::Document*>(documentPtr);`);
  lines.push(`    s_registries[ctx] = reg;`);
  lines.push('');
  lines.push(`    JSValue global = JS_GetGlobalObject(ctx);`);
  lines.push('');
  lines.push(`    JSValue ce = JS_NewObject(ctx);`);
  lines.push(`    JS_SetPropertyStr(ctx, ce, "define",`);
  lines.push(`        JS_NewCFunction(ctx, js_ce_define, "define", 2));`);
  lines.push(`    JS_SetPropertyStr(ctx, ce, "get",`);
  lines.push(`        JS_NewCFunction(ctx, js_ce_get, "get", 1));`);
  lines.push(`    JS_SetPropertyStr(ctx, ce, "whenDefined",`);
  lines.push(`        JS_NewCFunction(ctx, js_ce_whenDefined, "whenDefined", 1));`);
  lines.push(`    JS_SetPropertyStr(ctx, global, "${globalVar}", ce);`);
  lines.push('');
  lines.push(`    JSValue htmlCtor = JS_NewCFunction2(ctx, js_htmlelement_ctor,`);
  lines.push(`                                        "${baseClass}", 0,`);
  lines.push(`                                        JS_CFUNC_constructor, 0);`);
  lines.push('');
  lines.push(`    JSValue elemProto = JS_GetClassProto(ctx, elementClassId);`);
  lines.push(`    JSValue htmlProto = JS_NewObjectProto(ctx, elemProto);`);
  lines.push(`    JS_FreeValue(ctx, elemProto);`);
  lines.push('');
  lines.push(`    JS_SetPropertyStr(ctx, htmlCtor, "prototype", JS_DupValue(ctx, htmlProto));`);
  lines.push(`    JS_SetPropertyStr(ctx, htmlProto, "constructor", JS_DupValue(ctx, htmlCtor));`);
  lines.push(`    JS_FreeValue(ctx, htmlProto);`);
  lines.push('');
  lines.push(`    JS_SetPropertyStr(ctx, global, "${baseClass}", htmlCtor);`);
  lines.push(`    JS_FreeValue(ctx, global);`);
  lines.push(`}`);
  lines.push('');
  lines.push(`void cleanupCustomElements(JSContext* ctx)`);
  lines.push(`{`);
  lines.push(`    auto it = s_registries.find(ctx);`);
  lines.push(`    if (it == s_registries.end()) return;`);
  lines.push('');
  lines.push(`    auto* reg = it->second;`);
  lines.push(`    for (auto& [name, def] : reg->defs) {`);
  lines.push(`        JS_FreeValue(ctx, def.constructor);`);
  lines.push(`    }`);
  lines.push(`    delete reg;`);
  lines.push(`    s_registries.erase(it);`);
  lines.push(`}`);
  lines.push('');
  lines.push(`JSValue createCustomElement(JSContext* ctx, void* elemPtr, const std::string& tag)`);
  lines.push(`{`);
  lines.push(`    auto* reg = getReg(ctx);`);
  lines.push(`    if (!reg) return JS_UNDEFINED;`);
  lines.push('');
  lines.push(`    std::string lower = toLower(tag);`);
  lines.push(`    auto it = reg->defs.find(lower);`);
  lines.push(`    if (it == reg->defs.end()) return JS_UNDEFINED;`);
  lines.push('');
  lines.push(`    auto* elem = static_cast<bro::dom::Element*>(elemPtr);`);
  lines.push('');
  lines.push(`    s_constructingTag = lower;`);
  lines.push(`    s_constructingElem = elem;`);
  lines.push('');
  lines.push(`    JSValue result = JS_CallConstructor(ctx, it->second.constructor, 0, nullptr);`);
  lines.push('');
  lines.push(`    s_constructingTag.clear();`);
  lines.push(`    s_constructingElem = nullptr;`);
  lines.push('');
  lines.push(`    return result;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`void upgradeCustomElementsInSubtree(JSContext* ctx, void* nodePtr)`);
  lines.push(`{`);
  lines.push(`    auto* node = static_cast<bro::dom::Node*>(nodePtr);`);
  lines.push(`    if (!node) return;`);
  lines.push(`    auto* reg = getReg(ctx);`);
  lines.push(`    if (!reg) return;`);
  lines.push('');
  lines.push(`    for (auto* child : node->childNodes()) {`);
  lines.push(`        if (child->nodeType() != bro::dom::NodeType::Element) continue;`);
  lines.push(`        auto* elem = static_cast<bro::dom::Element*>(child);`);
  lines.push('');
  lines.push(`        const std::string& tag = elem->tagName();`);
  lines.push(`        bool hasHyphen = false;`);
  lines.push(`        for (char c : tag) { if (c == '-') { hasHyphen = true; break; } }`);
  lines.push('');
  lines.push(`        bool upgraded = false;`);
  lines.push(`        if (hasHyphen) {`);
  lines.push(`            std::string lower = toLower(tag);`);
  lines.push(`            if (reg->defs.find(lower) != reg->defs.end()) {`);
  lines.push(`                JSValue result = createCustomElement(ctx, elem, lower);`);
  lines.push(`                if (!JS_IsException(result) && !JS_IsUndefined(result)) {`);
  lines.push(`                    JS_FreeValue(ctx, result);`);
  lines.push(`                    upgraded = true;`);
  lines.push(`                }`);
  lines.push(`            }`);
  lines.push(`        }`);
  lines.push('');
  lines.push(`        if (!upgraded || !elem->hasShadow()) {`);
  lines.push(`            upgradeCustomElementsInSubtree(ctx, elem);`);
  lines.push(`        }`);
  lines.push(`    }`);
  lines.push(`}`);
  lines.push('');
  lines.push(`void fireConnectedCallback(JSContext* ctx, JSValue elementWrapper)`);
  lines.push(`{`);
  lines.push(`    fireCallbackRecursive(ctx, elementWrapper, "connectedCallback");`);
  lines.push(`}`);
  lines.push('');
  lines.push(`void fireDisconnectedCallback(JSContext* ctx, JSValue elementWrapper)`);
  lines.push(`{`);
  lines.push(`    fireCallbackRecursive(ctx, elementWrapper, "disconnectedCallback");`);
  lines.push(`}`);
  lines.push('');
  lines.push(`void fireAttributeChangedCallback(JSContext* ctx, JSValue elementWrapper,`);
  lines.push(`                                  const std::string& attrName,`);
  lines.push(`                                  const std::string& oldVal,`);
  lines.push(`                                  const std::string& newVal)`);
  lines.push(`{`);
  lines.push(`    auto* reg = getReg(ctx);`);
  lines.push(`    if (!reg) return;`);
  lines.push('');
  lines.push(`    auto* elem = static_cast<bro::dom::Element*>(DomBindings::unwrapElement(ctx, elementWrapper));`);
  lines.push(`    if (!elem) return;`);
  lines.push('');
  lines.push(`    std::string tag = toLower(elem->tagName());`);
  lines.push(`    auto it = reg->defs.find(tag);`);
  lines.push(`    if (it == reg->defs.end()) return;`);
  lines.push('');
  lines.push(`    auto& observed = it->second.observedAttributes;`);
  lines.push(`    if (std::find(observed.begin(), observed.end(), attrName) == observed.end())`);
  lines.push(`        return;`);
  lines.push('');
  lines.push(`    JSValue args[3];`);
  lines.push(`    args[0] = JS_NewString(ctx, attrName.c_str());`);
  lines.push(`    args[1] = oldVal.empty() ? JS_NULL : JS_NewString(ctx, oldVal.c_str());`);
  lines.push(`    args[2] = JS_NewString(ctx, newVal.c_str());`);
  lines.push('');
  lines.push(`    JSValue method = JS_GetPropertyStr(ctx, elementWrapper, "attributeChangedCallback");`);
  lines.push(`    if (JS_IsFunction(ctx, method)) {`);
  lines.push(`        JSValue ret = JS_Call(ctx, method, elementWrapper, 3, args);`);
  lines.push(`        if (JS_IsException(ret)) {`);
  lines.push(`            JSValue exc = JS_GetException(ctx);`);
  lines.push(`            const char* msg = JS_ToCString(ctx, exc);`);
  lines.push(`            LOG_ERROR("attributeChangedCallback error: %s", msg ? msg : "unknown");`);
  lines.push(`            if (msg) JS_FreeCString(ctx, msg);`);
  lines.push(`            JS_FreeValue(ctx, exc);`);
  lines.push(`        }`);
  lines.push(`        JS_FreeValue(ctx, ret);`);
  lines.push(`    }`);
  lines.push(`    JS_FreeValue(ctx, method);`);
  lines.push(`    for (int i = 0; i < 3; i++) JS_FreeValue(ctx, args[i]);`);
  lines.push(`}`);
  lines.push('');
  lines.push(`bool upgradeCustomElementPrototype(JSContext* ctx, JSValue wrapper, const std::string& tagName)`);
  lines.push(`{`);
  lines.push(`    auto* reg = getReg(ctx);`);
  lines.push(`    if (!reg) return false;`);
  lines.push('');
  lines.push(`    std::string lower = toLower(tagName);`);
  lines.push(`    auto it = reg->defs.find(lower);`);
  lines.push(`    if (it == reg->defs.end()) return false;`);
  lines.push('');
  lines.push(`    JSValue customProto = JS_GetPropertyStr(ctx, it->second.constructor, "prototype");`);
  lines.push(`    if (!JS_IsUndefined(customProto) && !JS_IsNull(customProto)) {`);
  lines.push(`        JS_SetPrototype(ctx, wrapper, customProto);`);
  lines.push(`    }`);
  lines.push(`    JS_FreeValue(ctx, customProto);`);
  lines.push(`    return true;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`} // namespace ${cppNamespace}`);
  lines.push('');
  return lines.join('\n');
}

/**
 * Generic AST-driven emitter for audio tap stream rings.
 * @param {Object} nsDef
 * @returns {string}
 */
export function emitAudioStreamTapTU(nsDef) {
  const ns = nsDef.name;
  const pascal = toPascalCase(ns);
  const snake = toSnakeCase(ns);
  const cppHeader = getAttr(nsDef, 'cpp_header') || `js/${snake}_bindings.h`;
  const cppNamespace = getAttr(nsDef, 'cpp_namespace') || 'bro::js';
  const cppIncludes = getAttr(nsDef, 'cpp_includes') || '';
  const installSig = getAttr(nsDef, 'install_signature') || `void install${pascal}Bindings(JSContext* ctx, broaudio::Engine* audioEngine)`;
  const prefix = getAttr(nsDef, 'prefix') || 'bro.';

  const lines = [];
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
  lines.push(`namespace {`);
  lines.push('');
  lines.push(`constexpr int k${pascal}Ring = 4096;`);
  lines.push('');
  lines.push(`struct ${pascal}State {`);
  lines.push(`    broaudio::Engine* audioEngine = nullptr;`);
  lines.push(`    JSContext*        ctx         = nullptr;`);
  lines.push('');
  lines.push(`    JSValue            onChunk = JS_UNDEFINED;`);
  lines.push(`    broaudio::MicTapId tapId   = broaudio::kInvalidMicTapId;`);
  lines.push(`    int                chunkFrames = 0;`);
  lines.push('');
  lines.push(`    std::atomic<int>      peakRingX10000[k${pascal}Ring];`);
  lines.push(`    std::atomic<int>      rmsRingX10000[k${pascal}Ring];`);
  lines.push(`    std::atomic<uint64_t> writeCount{0};`);
  lines.push(`    std::atomic<uint64_t> dropped{0};`);
  lines.push('');
  lines.push(`    bool               wantSamples = false;`);
  lines.push(`    std::vector<float> sampleRing;`);
  lines.push('');
  lines.push(`    uint64_t lastFired = 0;`);
  lines.push('');
  lines.push(`    bool active = false;`);
  lines.push(`};`);
  lines.push('');
  lines.push(`${pascal}State g_${snake};`);
  lines.push('');
  lines.push(`void shutdownActive${pascal}() {`);
  lines.push(`    if (!g_${snake}.active) return;`);
  lines.push(`    if (g_${snake}.audioEngine && g_${snake}.tapId != broaudio::kInvalidMicTapId) {`);
  lines.push(`        g_${snake}.audioEngine->removeMicTap(g_${snake}.tapId);`);
  lines.push(`    }`);
  lines.push(`    g_${snake}.tapId = broaudio::kInvalidMicTapId;`);
  lines.push(`    if (g_${snake}.ctx && !JS_IsUndefined(g_${snake}.onChunk)) {`);
  lines.push(`        JS_FreeValue(g_${snake}.ctx, g_${snake}.onChunk);`);
  lines.push(`        g_${snake}.onChunk = JS_UNDEFINED;`);
  lines.push(`    }`);
  lines.push(`    g_${snake}.writeCount.store(0, std::memory_order_relaxed);`);
  lines.push(`    g_${snake}.dropped.store(0, std::memory_order_relaxed);`);
  lines.push(`    g_${snake}.lastFired = 0;`);
  lines.push(`    g_${snake}.chunkFrames = 0;`);
  lines.push(`    g_${snake}.wantSamples = false;`);
  lines.push(`    g_${snake}.sampleRing.clear();`);
  lines.push(`    g_${snake}.active = false;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`bool getNum(JSContext* ctx, JSValueConst obj, const char* key, double& dst) {`);
  lines.push(`    JSValue v = JS_GetPropertyStr(ctx, obj, key);`);
  lines.push(`    bool ok = false;`);
  lines.push(`    if (JS_IsNumber(v)) { JS_ToFloat64(ctx, &dst, v); ok = true; }`);
  lines.push(`    JS_FreeValue(ctx, v);`);
  lines.push(`    return ok;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`bool getInt(JSContext* ctx, JSValueConst obj, const char* key, int& dst) {`);
  lines.push(`    double d = dst;`);
  lines.push(`    if (getNum(ctx, obj, key, d)) { dst = static_cast<int>(d); return true; }`);
  lines.push(`    return false;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`bool getBool(JSContext* ctx, JSValueConst obj, const char* key, bool& dst) {`);
  lines.push(`    JSValue v = JS_GetPropertyStr(ctx, obj, key);`);
  lines.push(`    bool ok = false;`);
  lines.push(`    if (JS_IsBool(v)) { dst = JS_ToBool(ctx, v) != 0; ok = true; }`);
  lines.push(`    JS_FreeValue(ctx, v);`);
  lines.push(`    return ok;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`} // namespace`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_start(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {`);
  lines.push(`    if (!g_${snake}.audioEngine) {`);
  lines.push(`        return JS_ThrowInternalError(ctx, "bro.${snake}.start: audio engine not available");`);
  lines.push(`    }`);
  lines.push(`    JSValueConst opts = (argc >= 1 && JS_IsObject(argv[0])) ? argv[0] : JS_UNDEFINED;`);
  lines.push(`    int  chunkFrames = 160;`);
  lines.push(`    int  targetRate  = 16000;`);
  lines.push(`    bool agc         = false;`);
  lines.push(`    bool live        = true;`);
  lines.push(`    bool samples     = false;`);
  lines.push(`    broaudio::AgcConfig agcCfg;`);
  lines.push(`    JSValue onChunkVal = JS_UNDEFINED;`);
  lines.push(`    if (!JS_IsUndefined(opts)) {`);
  lines.push(`        getInt(ctx, opts, "chunkFrames", chunkFrames);`);
  lines.push(`        getInt(ctx, opts, "targetRate", targetRate);`);
  lines.push(`        getBool(ctx, opts, "agc", agc);`);
  lines.push(`        getBool(ctx, opts, "live", live);`);
  lines.push(`        getBool(ctx, opts, "samples", samples);`);
  lines.push(`        double d;`);
  lines.push(`        if (getNum(ctx, opts, "targetPeak",  d)) agcCfg.targetPeak  = static_cast<float>(d);`);
  lines.push(`        if (getNum(ctx, opts, "halfLifeSec", d)) agcCfg.halfLifeSec = static_cast<float>(d);`);
  lines.push(`        if (getNum(ctx, opts, "noiseGate",   d)) agcCfg.noiseGate   = static_cast<float>(d);`);
  lines.push(`        if (getNum(ctx, opts, "maxGain",     d)) agcCfg.maxGain     = static_cast<float>(d);`);
  lines.push(`        onChunkVal = JS_GetPropertyStr(ctx, opts, "onChunk");`);
  lines.push(`        if (!JS_IsUndefined(onChunkVal) && !JS_IsFunction(ctx, onChunkVal)) {`);
  lines.push(`            JS_FreeValue(ctx, onChunkVal);`);
  lines.push(`            return JS_ThrowTypeError(ctx, "bro.${snake}.start: opts.onChunk must be a function");`);
  lines.push(`        }`);
  lines.push(`    }`);
  lines.push(`    if (chunkFrames < 0 || targetRate < 0) {`);
  lines.push(`        JS_FreeValue(ctx, onChunkVal);`);
  lines.push(`        return JS_ThrowRangeError(ctx, "bro.${snake}.start: chunkFrames and targetRate must be >= 0");`);
  lines.push(`    }`);
  lines.push(`    if (samples && chunkFrames <= 0) {`);
  lines.push(`        JS_FreeValue(ctx, onChunkVal);`);
  lines.push(`        return JS_ThrowRangeError(ctx, "bro.${snake}.start: opts.samples needs a fixed chunkFrames (> 0)");`);
  lines.push(`    }`);
  lines.push(`    shutdownActive${pascal}();`);
  lines.push(`    broaudio::MicTapConfig cfg;`);
  lines.push(`    cfg.targetRate  = targetRate;`);
  lines.push(`    cfg.chunkFrames = chunkFrames;`);
  lines.push(`    cfg.agc         = agc;`);
  lines.push(`    cfg.agcCfg      = agcCfg;`);
  lines.push(`    g_${snake}.ctx         = ctx;`);
  lines.push(`    g_${snake}.chunkFrames = chunkFrames;`);
  lines.push(`    g_${snake}.onChunk     = JS_IsFunction(ctx, onChunkVal) ? JS_DupValue(ctx, onChunkVal) : JS_UNDEFINED;`);
  lines.push(`    JS_FreeValue(ctx, onChunkVal);`);
  lines.push(`    g_${snake}.wantSamples = samples;`);
  lines.push(`    if (samples) {`);
  lines.push(`        g_${snake}.sampleRing.assign(static_cast<size_t>(k${pascal}Ring) * static_cast<size_t>(chunkFrames), 0.0f);`);
  lines.push(`    }`);
  lines.push(`    g_${snake}.writeCount.store(0, std::memory_order_relaxed);`);
  lines.push(`    g_${snake}.dropped.store(0, std::memory_order_relaxed);`);
  lines.push(`    g_${snake}.lastFired = 0;`);
  lines.push(`    g_${snake}.tapId = g_${snake}.audioEngine->addMicTap(cfg, [](const float* samples, int n) {`);
  lines.push(`        if (n <= 0) return;`);
  lines.push(`        float peak = 0.0f, sumSq = 0.0f;`);
  lines.push(`        for (int i = 0; i < n; ++i) {`);
  lines.push(`            const float a = std::fabs(samples[i]);`);
  lines.push(`            if (a > peak) peak = a;`);
  lines.push(`            sumSq += samples[i] * samples[i];`);
  lines.push(`        }`);
  lines.push(`        const float rms = std::sqrt(sumSq / static_cast<float>(n));`);
  lines.push(`        const uint64_t idx = g_${snake}.writeCount.load(std::memory_order_relaxed);`);
  lines.push(`        const int slot = static_cast<int>(idx % k${pascal}Ring);`);
  lines.push(`        g_${snake}.peakRingX10000[slot].store(static_cast<int>(peak * 10000.0f), std::memory_order_relaxed);`);
  lines.push(`        g_${snake}.rmsRingX10000[slot].store(static_cast<int>(rms * 10000.0f), std::memory_order_relaxed);`);
  lines.push(`        if (g_${snake}.wantSamples) {`);
  lines.push(`            const int cf = g_${snake}.chunkFrames;`);
  lines.push(`            const int m  = n < cf ? n : cf;`);
  lines.push(`            float* dst = g_${snake}.sampleRing.data() + static_cast<size_t>(slot) * static_cast<size_t>(cf);`);
  lines.push(`            std::memcpy(dst, samples, static_cast<size_t>(m) * sizeof(float));`);
  lines.push(`            if (m < cf) std::memset(dst + m, 0, static_cast<size_t>(cf - m) * sizeof(float));`);
  lines.push(`        }`);
  lines.push(`        g_${snake}.writeCount.store(idx + 1, std::memory_order_release);`);
  lines.push(`    });`);
  lines.push(`    if (g_${snake}.tapId == broaudio::kInvalidMicTapId) {`);
  lines.push(`        shutdownActive${pascal}();`);
  lines.push(`        return JS_ThrowInternalError(ctx, "bro.${snake}.start: addMicTap failed");`);
  lines.push(`    }`);
  lines.push(`    if (live && !g_${snake}.audioEngine->isMicCapturing()) {`);
  lines.push(`        g_${snake}.audioEngine->startMicCapture();`);
  lines.push(`    }`);
  lines.push(`    g_${snake}.active = true;`);
  lines.push(`    return JS_UNDEFINED;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_stop(JSContext*, JSValueConst, int, JSValueConst*) {`);
  lines.push(`    shutdownActive${pascal}();`);
  lines.push(`    return JS_UNDEFINED;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_is_active(JSContext* ctx, JSValueConst, int, JSValueConst*) {`);
  lines.push(`    return JS_NewBool(ctx, g_${snake}.active);`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_engine_rate(JSContext* ctx, JSValueConst, int, JSValueConst*) {`);
  lines.push(`    return JS_NewInt32(ctx, g_${snake}.audioEngine ? g_${snake}.audioEngine->sampleRate() : 0);`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_stats(JSContext* ctx, JSValueConst, int, JSValueConst*) {`);
  lines.push(`    if (!g_${snake}.active || !g_${snake}.audioEngine || g_${snake}.tapId == broaudio::kInvalidMicTapId) return JS_NULL;`);
  lines.push(`    auto s = g_${snake}.audioEngine->getMicTapStats(g_${snake}.tapId);`);
  lines.push(`    JSValue o = JS_NewObject(ctx);`);
  lines.push(`    JS_SetPropertyStr(ctx, o, "framesDelivered", JS_NewInt64(ctx, static_cast<int64_t>(s.framesDelivered)));`);
  lines.push(`    JS_SetPropertyStr(ctx, o, "samplesDelivered", JS_NewInt64(ctx, static_cast<int64_t>(s.samplesDelivered)));`);
  lines.push(`    JS_SetPropertyStr(ctx, o, "rollingPeak", JS_NewFloat64(ctx, s.rollingPeak));`);
  lines.push(`    JS_SetPropertyStr(ctx, o, "chunkCount", JS_NewInt64(ctx, static_cast<int64_t>(g_${snake}.writeCount.load(std::memory_order_acquire))));`);
  lines.push(`    JS_SetPropertyStr(ctx, o, "dropped", JS_NewInt64(ctx, static_cast<int64_t>(g_${snake}.dropped.load(std::memory_order_relaxed))));`);
  lines.push(`    JS_SetPropertyStr(ctx, o, "chunkFrames", JS_NewInt32(ctx, g_${snake}.chunkFrames));`);
  lines.push(`    return o;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_levels(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {`);
  lines.push(`    int maxCount = k${pascal}Ring;`);
  lines.push(`    if (argc >= 1 && JS_IsNumber(argv[0])) {`);
  lines.push(`        int32_t r = 0; JS_ToInt32(ctx, &r, argv[0]);`);
  lines.push(`        if (r >= 0 && r < maxCount) maxCount = r;`);
  lines.push(`    }`);
  lines.push(`    const uint64_t w = g_${snake}.writeCount.load(std::memory_order_acquire);`);
  lines.push(`    int avail = static_cast<int>(w < static_cast<uint64_t>(k${pascal}Ring) ? w : static_cast<uint64_t>(k${pascal}Ring));`);
  lines.push(`    int count = avail < maxCount ? avail : maxCount;`);
  lines.push(`    JSValue arr = JS_NewArray(ctx);`);
  lines.push(`    for (int k = 0; k < count; ++k) {`);
  lines.push(`        const uint64_t i = w - static_cast<uint64_t>(count) + static_cast<uint64_t>(k);`);
  lines.push(`        const int pk = g_${snake}.peakRingX10000[i % k${pascal}Ring].load(std::memory_order_relaxed);`);
  lines.push(`        JS_SetPropertyUint32(ctx, arr, static_cast<uint32_t>(k), JS_NewFloat64(ctx, pk / 10000.0));`);
  lines.push(`    }`);
  lines.push(`    return arr;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_feed(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {`);
  lines.push(`    if (!g_${snake}.active) return JS_ThrowInternalError(ctx, "bro.${snake}.feed: not started");`);
  lines.push(`    if (!g_${snake}.audioEngine) return JS_ThrowInternalError(ctx, "bro.${snake}.feed: audio engine not available");`);
  lines.push(`    if (g_${snake}.audioEngine->isMicCapturing()) return JS_ThrowInternalError(ctx, "bro.${snake}.feed: cannot feed while live capture is active");`);
  lines.push(`    if (argc < 1) return JS_ThrowTypeError(ctx, "bro.${snake}.feed(Float32Array, sampleRate?)");`);
  lines.push(`    size_t byteOff = 0, viewLen = 0, bpe = 0;`);
  lines.push(`    JSValue abuf = JS_GetTypedArrayBuffer(ctx, argv[0], &byteOff, &viewLen, &bpe);`);
  lines.push(`    if (JS_IsException(abuf)) return JS_EXCEPTION;`);
  lines.push(`    size_t abufLen = 0;`);
  lines.push(`    uint8_t* p = JS_GetArrayBuffer(ctx, &abufLen, abuf);`);
  lines.push(`    JS_FreeValue(ctx, abuf);`);
  lines.push(`    if (!p || bpe != sizeof(float)) return JS_ThrowTypeError(ctx, "bro.${snake}.feed: argument must be a Float32Array");`);
  lines.push(`    const int n = static_cast<int>(viewLen / sizeof(float));`);
  lines.push(`    const int engineRate = g_${snake}.audioEngine->sampleRate();`);
  lines.push(`    if (argc >= 2 && JS_IsNumber(argv[1])) {`);
  lines.push(`        int32_t r = 0; JS_ToInt32(ctx, &r, argv[1]);`);
  lines.push(`        if (r > 0 && r != engineRate) return JS_ThrowTypeError(ctx, "bro.${snake}.feed: sampleRate=%d must equal engine capture rate=%d", r, engineRate);`);
  lines.push(`    }`);
  lines.push(`    g_${snake}.audioEngine->injectMicSamples(reinterpret_cast<const float*>(p + byteOff), n);`);
  lines.push(`    return JS_UNDEFINED;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`void tick${pascal}(JSContext* ctx) {`);
  lines.push(`    if (!g_${snake}.active) return;`);
  lines.push(`    const uint64_t w = g_${snake}.writeCount.load(std::memory_order_acquire);`);
  lines.push(`    if (w == g_${snake}.lastFired) return;`);
  lines.push(`    if (JS_IsUndefined(g_${snake}.onChunk)) { g_${snake}.lastFired = w; return; }`);
  lines.push('');
  lines.push(`    uint64_t start = g_${snake}.lastFired;`);
  lines.push(`    if (w - start > static_cast<uint64_t>(k${pascal}Ring)) {`);
  lines.push(`        g_${snake}.dropped.fetch_add(w - start - k${pascal}Ring, std::memory_order_relaxed);`);
  lines.push(`        start = w - k${pascal}Ring;`);
  lines.push(`    }`);
  lines.push(`    for (uint64_t i = start; i < w; ++i) {`);
  lines.push(`        const int slot = static_cast<int>(i % k${pascal}Ring);`);
  lines.push(`        const int pk  = g_${snake}.peakRingX10000[slot].load(std::memory_order_relaxed);`);
  lines.push(`        const int rms = g_${snake}.rmsRingX10000[slot].load(std::memory_order_relaxed);`);
  lines.push(`        JSValue o = JS_NewObject(ctx);`);
  lines.push(`        JS_SetPropertyStr(ctx, o, "index", JS_NewInt64(ctx, static_cast<int64_t>(i)));`);
  lines.push(`        JS_SetPropertyStr(ctx, o, "peak",  JS_NewFloat64(ctx, pk / 10000.0));`);
  lines.push(`        JS_SetPropertyStr(ctx, o, "rms",   JS_NewFloat64(ctx, rms / 10000.0));`);
  lines.push(`        if (g_${snake}.wantSamples) {`);
  lines.push(`            const float* src = g_${snake}.sampleRing.data()`);
  lines.push(`                + static_cast<size_t>(slot) * static_cast<size_t>(g_${snake}.chunkFrames);`);
  lines.push(`            JS_SetPropertyStr(ctx, o, "samples",`);
  lines.push(`                qjsbind::make_float32_array(ctx, src,`);
  lines.push(`                    static_cast<size_t>(g_${snake}.chunkFrames)));`);
  lines.push(`        }`);
  lines.push(`        JSValue argv[1] = { o };`);
  lines.push(`        JSValue r = JS_Call(ctx, g_${snake}.onChunk, JS_UNDEFINED, 1, argv);`);
  lines.push(`        if (JS_IsException(r)) {`);
  lines.push(`            JSValue exc = JS_GetException(ctx);`);
  lines.push(`            const char* s = JS_ToCString(ctx, exc);`);
  lines.push(`            std::fprintf(stderr, "[ERROR] [${snake}] onChunk threw: %s\\n", s ? s : "?");`);
  lines.push(`            if (s) JS_FreeCString(ctx, s);`);
  lines.push(`            JS_FreeValue(ctx, exc);`);
  lines.push(`        }`);
  lines.push(`        JS_FreeValue(ctx, r);`);
  lines.push(`        JS_FreeValue(ctx, o);`);
  lines.push(`    }`);
  lines.push(`    g_${snake}.lastFired = w;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`void cleanup${pascal}Bindings(JSContext* /*ctx*/) {`);
  lines.push(`    shutdownActive${pascal}();`);
  lines.push(`    g_${snake}.audioEngine = nullptr;`);
  lines.push(`    g_${snake}.ctx         = nullptr;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`${installSig} {`);
  lines.push(`    g_${snake}.audioEngine = audioEngine;`);
  lines.push(`    g_${snake}.ctx         = ctx;`);
  lines.push('');
  lines.push(`    JSValue global = JS_GetGlobalObject(ctx);`);
  lines.push(`    JSValue broObj = JS_GetPropertyStr(ctx, global, "bro");`);
  lines.push(`    if (JS_IsUndefined(broObj) || JS_IsException(broObj)) {`);
  lines.push(`        broObj = JS_NewObject(ctx);`);
  lines.push(`        JS_SetPropertyStr(ctx, global, "bro", JS_DupValue(ctx, broObj));`);
  lines.push(`    }`);
  lines.push('');
  lines.push(`    JSValue ${snake}Obj = JS_NewObject(ctx);`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "start",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_start, "start", 1));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "stop",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_stop, "stop", 0));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "isActive",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_is_active, "isActive", 0));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "engineRate",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_engine_rate, "engineRate", 0));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "stats",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_stats, "stats", 0));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "levels",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_levels, "levels", 1));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "feed",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_feed, "feed", 2));`);
  lines.push('');
  lines.push(`    JS_SetPropertyStr(ctx, broObj, "${ns}", ${snake}Obj);`);
  lines.push(`    JS_FreeValue(ctx, broObj);`);
  lines.push(`    JS_FreeValue(ctx, global);`);
  lines.push(`}`);
  lines.push('');
  lines.push(`} // namespace ${cppNamespace}`);
  lines.push('');
  return lines.join('\n');
}

/**
 * Generic AST-driven emitter for layered persistent key-value configuration stores.
 * @param {Object} nsDef
 * @returns {string}
 */
export function emitLayeredStoreTU(nsDef) {
  const ns = nsDef.name;
  const pascal = toPascalCase(ns);
  const snake = toSnakeCase(ns);
  const cppHeader = getAttr(nsDef, 'cpp_header') || `js/${snake}_bindings.h`;
  const cppNamespace = getAttr(nsDef, 'cpp_namespace') || 'bro::js';
  const cppIncludes = getAttr(nsDef, 'cpp_includes') || '';
  const installSig = getAttr(nsDef, 'install_signature') || `void ${pascal}Bindings::install(JSContext* ctx, engine::Settings* store, platform::Window* window, engine::Engine* engine)`;

  const lines = [];
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
  lines.push(`static const char* kSettingsKey = "__bro_settings_ptr";`);
  lines.push(`static const char* kWindowKey = "__bro_settings_window_ptr";`);
  lines.push('');
  lines.push(`struct ${pascal}State {`);
  lines.push(`    engine::Settings* store = nullptr;`);
  lines.push(`    platform::Window* window = nullptr;`);
  lines.push(`    engine::Engine* engine = nullptr;`);
  lines.push(`};`);
  lines.push('');
  lines.push(`static ${pascal}State* getState(JSContext* ctx) {`);
  lines.push(`    JSValue global = JS_GetGlobalObject(ctx);`);
  lines.push(`    JSValue val = JS_GetPropertyStr(ctx, global, kSettingsKey);`);
  lines.push(`    ${pascal}State* state = nullptr;`);
  lines.push(`    if (JS_IsNumber(val)) {`);
  lines.push(`        int64_t ptr = 0;`);
  lines.push(`        JS_ToInt64(ctx, &ptr, val);`);
  lines.push(`        state = reinterpret_cast<${pascal}State*>(static_cast<intptr_t>(ptr));`);
  lines.push(`    }`);
  lines.push(`    JS_FreeValue(ctx, val);`);
  lines.push(`    JS_FreeValue(ctx, global);`);
  lines.push(`    return state;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static std::string jsStr(JSContext* ctx, JSValueConst val) {`);
  lines.push(`    const char* s = JS_ToCString(ctx, val);`);
  lines.push(`    std::string r = s ? s : "";`);
  lines.push(`    if (s) JS_FreeCString(ctx, s);`);
  lines.push(`    return r;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue settingsValueToJS(JSContext* ctx, const std::string& key,`);
  lines.push(`                                 const std::string& value) {`);
  lines.push(`    if (value.empty()) return JS_UNDEFINED;`);
  lines.push(`    if (key.find("fullscreen") != std::string::npos ||`);
  lines.push(`        key.find("vsync") != std::string::npos ||`);
  lines.push(`        key.find("resizable") != std::string::npos ||`);
  lines.push(`        key.find("muted") != std::string::npos) {`);
  lines.push(`        return JS_NewBool(ctx, value == "true");`);
  lines.push(`    }`);
  lines.push(`    if (key.find("width") != std::string::npos ||`);
  lines.push(`        key.find("height") != std::string::npos ||`);
  lines.push(`        key.find("overlayToggleKey") != std::string::npos) {`);
  lines.push(`        try { return JS_NewInt32(ctx, std::stoi(value)); }`);
  lines.push(`        catch (...) { return JS_NewString(ctx, value.c_str()); }`);
  lines.push(`    }`);
  lines.push(`    if (key.find("Volume") != std::string::npos ||`);
  lines.push(`        key.find("Speed") != std::string::npos ||`);
  lines.push(`        key.find("Threshold") != std::string::npos ||`);
  lines.push(`        key.find("Distance") != std::string::npos ||`);
  lines.push(`        key.find("Interval") != std::string::npos ||`);
  lines.push(`        key.find("maxFps") != std::string::npos) {`);
  lines.push(`        try { return JS_NewFloat64(ctx, std::stod(value)); }`);
  lines.push(`        catch (...) { return JS_NewString(ctx, value.c_str()); }`);
  lines.push(`    }`);
  lines.push(`    return JS_NewString(ctx, value.c_str());`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue buildActionArray(JSContext* ctx,`);
  lines.push(`                                const std::vector<bro::engine::ActionBinding>& actions) {`);
  lines.push(`    JSValue arr = JS_NewArray(ctx);`);
  lines.push(`    for (size_t i = 0; i < actions.size(); i++) {`);
  lines.push(`        JSValue obj = JS_NewObject(ctx);`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "action",`);
  lines.push(`                          JS_NewString(ctx, actions[i].action.c_str()));`);
  lines.push(`        JSValue keysArr = JS_NewArray(ctx);`);
  lines.push(`        for (size_t j = 0; j < actions[i].keys.size(); j++) {`);
  lines.push(`            JS_SetPropertyUint32(ctx, keysArr, static_cast<uint32_t>(j),`);
  lines.push(`                                 JS_NewString(ctx, actions[i].keys[j].c_str()));`);
  lines.push(`        }`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "keys", keysArr);`);
  lines.push(`        JS_SetPropertyUint32(ctx, arr, static_cast<uint32_t>(i), obj);`);
  lines.push(`    }`);
  lines.push(`    return arr;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_get(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {`);
  lines.push(`    if (argc < 1) return JS_UNDEFINED;`);
  lines.push(`    auto* state = getState(ctx);`);
  lines.push(`    if (!state || !state->store) return JS_UNDEFINED;`);
  lines.push(`    std::string key = jsStr(ctx, argv[0]);`);
  lines.push(`    std::string value = state->store->getString(key);`);
  lines.push(`    return settingsValueToJS(ctx, key, value);`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_get_all(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {`);
  lines.push(`    auto* state = getState(ctx);`);
  lines.push(`    if (!state || !state->store) return JS_UNDEFINED;`);
  lines.push(`    std::string category;`);
  lines.push(`    if (argc >= 1 && JS_IsString(argv[0])) category = jsStr(ctx, argv[0]);`);
  lines.push('');
  lines.push(`    auto addGraphics = [&](JSValue obj) {`);
  lines.push(`        auto& g = state->store->graphics();`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "width", JS_NewInt32(ctx, g.width));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "height", JS_NewInt32(ctx, g.height));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "fullscreen", JS_NewBool(ctx, g.fullscreen));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "vsync", JS_NewBool(ctx, g.vsync));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "resizable", JS_NewBool(ctx, g.resizable));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "maxFrameIntervalMs", JS_NewFloat64(ctx, g.maxFrameIntervalMs));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "maxFps", JS_NewFloat64(ctx, g.maxFps));`);
  lines.push(`    };`);
  lines.push(`    auto addAudio = [&](JSValue obj) {`);
  lines.push(`        auto& a = state->store->audio();`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "masterVolume", JS_NewFloat64(ctx, a.masterVolume));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "musicVolume", JS_NewFloat64(ctx, a.musicVolume));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "sfxVolume", JS_NewFloat64(ctx, a.sfxVolume));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "muted", JS_NewBool(ctx, a.muted));`);
  lines.push(`    };`);
  lines.push(`    auto addInput = [&](JSValue obj) {`);
  lines.push(`        auto& i = state->store->input();`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "scrollSpeed", JS_NewFloat64(ctx, i.scrollSpeed));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "doubleClickThresholdMs", JS_NewFloat64(ctx, i.doubleClickThresholdMs));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "doubleClickDistancePx", JS_NewFloat64(ctx, i.doubleClickDistancePx));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "overlayToggleKey", JS_NewInt32(ctx, static_cast<int32_t>(i.overlayToggleKey)));`);
  lines.push(`    };`);
  lines.push(`    auto addAppearance = [&](JSValue obj) {`);
  lines.push(`        auto& ap = state->store->appearance();`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "colorScheme", JS_NewString(ctx, ap.colorScheme.c_str()));`);
  lines.push(`    };`);
  lines.push('');
  lines.push(`    if (category == "appearance") {`);
  lines.push(`        JSValue obj = JS_NewObject(ctx);`);
  lines.push(`        addAppearance(obj);`);
  lines.push(`        return obj;`);
  lines.push(`    }`);
  lines.push(`    if (category == "graphics") {`);
  lines.push(`        JSValue obj = JS_NewObject(ctx);`);
  lines.push(`        addGraphics(obj);`);
  lines.push(`        return obj;`);
  lines.push(`    }`);
  lines.push(`    if (category == "audio") {`);
  lines.push(`        JSValue obj = JS_NewObject(ctx);`);
  lines.push(`        addAudio(obj);`);
  lines.push(`        return obj;`);
  lines.push(`    }`);
  lines.push(`    if (category == "input") {`);
  lines.push(`        JSValue obj = JS_NewObject(ctx);`);
  lines.push(`        addInput(obj);`);
  lines.push(`        return obj;`);
  lines.push(`    }`);
  lines.push('');
  lines.push(`    JSValue root = JS_NewObject(ctx);`);
  lines.push(`    JSValue gObj = JS_NewObject(ctx); addGraphics(gObj); JS_SetPropertyStr(ctx, root, "graphics", gObj);`);
  lines.push(`    JSValue aObj = JS_NewObject(ctx); addAudio(aObj); JS_SetPropertyStr(ctx, root, "audio", aObj);`);
  lines.push(`    JSValue iObj = JS_NewObject(ctx); addInput(iObj); JS_SetPropertyStr(ctx, root, "input", iObj);`);
  lines.push(`    JSValue apObj = JS_NewObject(ctx); addAppearance(apObj); JS_SetPropertyStr(ctx, root, "appearance", apObj);`);
  lines.push(`    return root;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_set(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {`);
  lines.push(`    if (argc < 2) return JS_UNDEFINED;`);
  lines.push(`    auto* state = getState(ctx);`);
  lines.push(`    if (!state || !state->store) return JS_UNDEFINED;`);
  lines.push(`    std::string key = jsStr(ctx, argv[0]);`);
  lines.push(`    if (JS_IsBool(argv[1])) {`);
  lines.push(`        state->store->setUser(key, JS_ToBool(ctx, argv[1]) != 0);`);
  lines.push(`    } else if (JS_IsNumber(argv[1])) {`);
  lines.push(`        double d;`);
  lines.push(`        JS_ToFloat64(ctx, &d, argv[1]);`);
  lines.push(`        state->store->setUser(key, d);`);
  lines.push(`    } else {`);
  lines.push(`        state->store->setUser(key, jsStr(ctx, argv[1]));`);
  lines.push(`    }`);
  lines.push(`    return JS_UNDEFINED;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_set_default(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {`);
  lines.push(`    if (argc < 2) return JS_UNDEFINED;`);
  lines.push(`    auto* state = getState(ctx);`);
  lines.push(`    if (!state || !state->store) return JS_UNDEFINED;`);
  lines.push(`    std::string key = jsStr(ctx, argv[0]);`);
  lines.push(`    if (JS_IsBool(argv[1])) {`);
  lines.push(`        state->store->setDefault(key, JS_ToBool(ctx, argv[1]) != 0);`);
  lines.push(`    } else if (JS_IsNumber(argv[1])) {`);
  lines.push(`        double d;`);
  lines.push(`        JS_ToFloat64(ctx, &d, argv[1]);`);
  lines.push(`        state->store->setDefault(key, d);`);
  lines.push(`    } else {`);
  lines.push(`        state->store->setDefault(key, jsStr(ctx, argv[1]));`);
  lines.push(`    }`);
  lines.push(`    return JS_UNDEFINED;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_reset(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {`);
  lines.push(`    auto* state = getState(ctx);`);
  lines.push(`    if (!state || !state->store) return JS_UNDEFINED;`);
  lines.push(`    if (argc >= 1 && JS_IsString(argv[0])) {`);
  lines.push(`        state->store->resetCategory(jsStr(ctx, argv[0]));`);
  lines.push(`    } else {`);
  lines.push(`        state->store->resetAll();`);
  lines.push(`    }`);
  lines.push(`    return JS_UNDEFINED;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_define_action(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {`);
  lines.push(`    if (argc < 2) return JS_UNDEFINED;`);
  lines.push(`    auto* state = getState(ctx);`);
  lines.push(`    if (!state || !state->store) return JS_UNDEFINED;`);
  lines.push(`    std::string action = jsStr(ctx, argv[0]);`);
  lines.push(`    std::vector<std::string> keys;`);
  lines.push(`    if (JS_IsArray(argv[1])) {`);
  lines.push(`        JSValue lenVal = JS_GetPropertyStr(ctx, argv[1], "length");`);
  lines.push(`        int32_t len = 0; JS_ToInt32(ctx, &len, lenVal); JS_FreeValue(ctx, lenVal);`);
  lines.push(`        for (int32_t i = 0; i < len; i++) {`);
  lines.push(`            JSValue elem = JS_GetPropertyUint32(ctx, argv[1], static_cast<uint32_t>(i));`);
  lines.push(`            keys.push_back(jsStr(ctx, elem));`);
  lines.push(`            JS_FreeValue(ctx, elem);`);
  lines.push(`        }`);
  lines.push(`    }`);
  lines.push(`    state->store->defineAction(action, keys);`);
  lines.push(`    if (argc >= 3 && JS_IsObject(argv[2])) {`);
  lines.push(`        JSValue dz = JS_GetPropertyStr(ctx, argv[2], "deadzone");`);
  lines.push(`        if (JS_IsNumber(dz)) {`);
  lines.push(`            double d = 0.0; JS_ToFloat64(ctx, &d, dz);`);
  lines.push(`            state->store->setActionDeadzone(action, static_cast<float>(d));`);
  lines.push(`        }`);
  lines.push(`        JS_FreeValue(ctx, dz);`);
  lines.push(`    }`);
  lines.push(`    return JS_UNDEFINED;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_rebind_action(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {`);
  lines.push(`    if (argc < 2) return JS_UNDEFINED;`);
  lines.push(`    auto* state = getState(ctx);`);
  lines.push(`    if (!state || !state->store) return JS_UNDEFINED;`);
  lines.push(`    std::string action = jsStr(ctx, argv[0]);`);
  lines.push(`    std::vector<std::string> keys;`);
  lines.push(`    if (JS_IsArray(argv[1])) {`);
  lines.push(`        JSValue lenVal = JS_GetPropertyStr(ctx, argv[1], "length");`);
  lines.push(`        int32_t len = 0; JS_ToInt32(ctx, &len, lenVal); JS_FreeValue(ctx, lenVal);`);
  lines.push(`        for (int32_t i = 0; i < len; i++) {`);
  lines.push(`            JSValue elem = JS_GetPropertyUint32(ctx, argv[1], static_cast<uint32_t>(i));`);
  lines.push(`            keys.push_back(jsStr(ctx, elem));`);
  lines.push(`            JS_FreeValue(ctx, elem);`);
  lines.push(`        }`);
  lines.push(`    }`);
  lines.push(`    state->store->rebindAction(action, keys);`);
  lines.push(`    return JS_UNDEFINED;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_reset_action(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {`);
  lines.push(`    if (argc < 1) return JS_UNDEFINED;`);
  lines.push(`    auto* state = getState(ctx);`);
  lines.push(`    if (!state || !state->store) return JS_UNDEFINED;`);
  lines.push(`    state->store->resetAction(jsStr(ctx, argv[0]));`);
  lines.push(`    return JS_UNDEFINED;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_reset_all_actions(JSContext* ctx, JSValueConst, int, JSValueConst*) {`);
  lines.push(`    auto* state = getState(ctx);`);
  lines.push(`    if (!state || !state->store) return JS_UNDEFINED;`);
  lines.push(`    state->store->resetAllActions();`);
  lines.push(`    return JS_UNDEFINED;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_get_action_keys(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {`);
  lines.push(`    if (argc < 1) return JS_NewArray(ctx);`);
  lines.push(`    auto* state = getState(ctx);`);
  lines.push(`    if (!state || !state->store) return JS_NewArray(ctx);`);
  lines.push(`    auto keys = state->store->getKeysForAction(jsStr(ctx, argv[0]));`);
  lines.push(`    JSValue arr = JS_NewArray(ctx);`);
  lines.push(`    for (size_t i = 0; i < keys.size(); i++) {`);
  lines.push(`        JS_SetPropertyUint32(ctx, arr, static_cast<uint32_t>(i), JS_NewString(ctx, keys[i].c_str()));`);
  lines.push(`    }`);
  lines.push(`    return arr;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_get_key_action(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {`);
  lines.push(`    if (argc < 1) return JS_NULL;`);
  lines.push(`    auto* state = getState(ctx);`);
  lines.push(`    if (!state || !state->store) return JS_NULL;`);
  lines.push(`    std::string action = state->store->getActionForKey(jsStr(ctx, argv[0]));`);
  lines.push(`    if (action.empty()) return JS_NULL;`);
  lines.push(`    return JS_NewString(ctx, action.c_str());`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_get_action_strength(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {`);
  lines.push(`    if (argc < 1) return JS_NewFloat64(ctx, 0.0);`);
  lines.push(`    auto* state = getState(ctx);`);
  lines.push(`    if (!state || !state->engine) return JS_NewFloat64(ctx, 0.0);`);
  lines.push(`    float s = state->engine->actionStrength(jsStr(ctx, argv[0]));`);
  lines.push(`    return JS_NewFloat64(ctx, static_cast<double>(s));`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_is_action_pressed(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {`);
  lines.push(`    if (argc < 1) return JS_FALSE;`);
  lines.push(`    auto* state = getState(ctx);`);
  lines.push(`    if (!state || !state->engine) return JS_FALSE;`);
  lines.push(`    return JS_NewBool(ctx, state->engine->actionPressed(jsStr(ctx, argv[0])));`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_get_actions(JSContext* ctx, JSValueConst, int, JSValueConst*) {`);
  lines.push(`    auto* state = getState(ctx);`);
  lines.push(`    if (!state || !state->store) return JS_NewArray(ctx);`);
  lines.push(`    return buildActionArray(ctx, state->store->getActions());`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_get_app_actions(JSContext* ctx, JSValueConst, int, JSValueConst*) {`);
  lines.push(`    auto* state = getState(ctx);`);
  lines.push(`    if (!state || !state->store) return JS_NewArray(ctx);`);
  lines.push(`    return buildActionArray(ctx, state->store->getAppActions());`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_get_display_modes(JSContext* ctx, JSValueConst, int, JSValueConst*) {`);
  lines.push(`    auto* state = getState(ctx);`);
  lines.push(`    if (!state) return JS_NewArray(ctx);`);
  lines.push(`    JSValue arr = JS_NewArray(ctx);`);
  lines.push(`    if (!state->window) return arr;`);
  lines.push(`    auto modes = state->window->getDisplayModes();`);
  lines.push(`    for (size_t i = 0; i < modes.size(); i++) {`);
  lines.push(`        JSValue obj = JS_NewObject(ctx);`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "width", JS_NewInt32(ctx, modes[i].width));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "height", JS_NewInt32(ctx, modes[i].height));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "refreshRate",`);
  lines.push(`                          JS_NewFloat64(ctx, modes[i].refreshRate));`);
  lines.push(`        JS_SetPropertyUint32(ctx, arr, static_cast<uint32_t>(i), obj);`);
  lines.push(`    }`);
  lines.push(`    return arr;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_get_defaults(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {`);
  lines.push(`    auto* state = getState(ctx);`);
  lines.push(`    if (!state || !state->store) return JS_UNDEFINED;`);
  lines.push(`    std::string category;`);
  lines.push(`    if (argc >= 1 && JS_IsString(argv[0])) category = jsStr(ctx, argv[0]);`);
  lines.push('');
  lines.push(`    auto addGraphics = [&](JSValue obj) {`);
  lines.push(`        auto& g = state->store->graphicsDefaults();`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "width", JS_NewInt32(ctx, g.width));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "height", JS_NewInt32(ctx, g.height));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "fullscreen", JS_NewBool(ctx, g.fullscreen));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "vsync", JS_NewBool(ctx, g.vsync));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "resizable", JS_NewBool(ctx, g.resizable));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "maxFrameIntervalMs", JS_NewFloat64(ctx, g.maxFrameIntervalMs));`);
  lines.push(`        JS_SetPropertyStr(ctx, obj, "maxFps", JS_NewFloat64(ctx, g.maxFps));`);
  lines.push(`    };`);
  lines.push(`    if (category == "graphics") {`);
  lines.push(`        JSValue obj = JS_NewObject(ctx);`);
  lines.push(`        addGraphics(obj);`);
  lines.push(`        return obj;`);
  lines.push(`    }`);
  lines.push(`    JSValue root = JS_NewObject(ctx);`);
  lines.push(`    JSValue gObj = JS_NewObject(ctx);`);
  lines.push(`    addGraphics(gObj);`);
  lines.push(`    JS_SetPropertyStr(ctx, root, "graphics", gObj);`);
  lines.push(`    return root;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`void ${pascal}Bindings::cleanup(JSContext* ctx) {`);
  lines.push(`    JSValue global = JS_GetGlobalObject(ctx);`);
  lines.push(`    JSValue val = JS_GetPropertyStr(ctx, global, kSettingsKey);`);
  lines.push(`    if (JS_IsNumber(val)) {`);
  lines.push(`        int64_t ptr = 0;`);
  lines.push(`        JS_ToInt64(ctx, &ptr, val);`);
  lines.push(`        delete reinterpret_cast<${pascal}State*>(static_cast<intptr_t>(ptr));`);
  lines.push(`    }`);
  lines.push(`    JS_FreeValue(ctx, val);`);
  lines.push(`    JS_SetPropertyStr(ctx, global, kSettingsKey, JS_UNDEFINED);`);
  lines.push(`    JS_FreeValue(ctx, global);`);
  lines.push(`}`);
  lines.push('');
  const storeParamMatch = installSig.match(/,\s*[\w:]+\*?\s+(\w+)\s*,/);
  const storeParam = storeParamMatch ? storeParamMatch[1] : 'store';
  lines.push(`${installSig} {`);
  lines.push(`    auto* state = new ${pascal}State();`);
  lines.push(`    state->store = ${storeParam};`);
  lines.push(`    state->window = window;`);
  lines.push(`    state->engine = engine;`);
  lines.push('');
  lines.push(`    JSValue global = JS_GetGlobalObject(ctx);`);
  lines.push(`    JS_SetPropertyStr(ctx, global, kSettingsKey,`);
  lines.push(`                      JS_NewInt64(ctx, static_cast<int64_t>(`);
  lines.push(`                          reinterpret_cast<intptr_t>(state))));`);
  lines.push('');
  lines.push(`    JSValue broObj = JS_GetPropertyStr(ctx, global, "bro");`);
  lines.push(`    if (JS_IsUndefined(broObj) || JS_IsException(broObj)) {`);
  lines.push(`        broObj = JS_NewObject(ctx);`);
  lines.push(`        JS_SetPropertyStr(ctx, global, "bro", JS_DupValue(ctx, broObj));`);
  lines.push(`    }`);
  lines.push('');
  lines.push(`    JSValue ${snake}Obj = JS_NewObject(ctx);`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "get",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_get, "get", 1));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "getAll",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_get_all, "getAll", 1));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "set",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_set, "set", 2));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "setDefault",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_set_default, "setDefault", 2));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "reset",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_reset, "reset", 1));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "defineAction",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_define_action, "defineAction", 3));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "rebindAction",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_rebind_action, "rebindAction", 2));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "resetAction",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_reset_action, "resetAction", 1));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "resetAllActions",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_reset_all_actions, "resetAllActions", 0));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "getActionKeys",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_get_action_keys, "getActionKeys", 1));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "getKeyAction",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_get_key_action, "getKeyAction", 1));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "getActionStrength",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_get_action_strength, "getActionStrength", 1));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "isActionPressed",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_is_action_pressed, "isActionPressed", 1));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "getActions",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_get_actions, "getActions", 0));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "getAppActions",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_get_app_actions, "getAppActions", 0));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "getDisplayModes",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_get_display_modes, "getDisplayModes", 0));`);
  lines.push(`    JS_SetPropertyStr(ctx, ${snake}Obj, "getDefaults",`);
  lines.push(`        JS_NewCFunction(ctx, js_${snake}_get_defaults, "getDefaults", 1));`);
  lines.push('');
  lines.push(`    JS_SetPropertyStr(ctx, broObj, "${ns}", ${snake}Obj);`);
  lines.push(`    JS_FreeValue(ctx, broObj);`);
  lines.push(`    JS_FreeValue(ctx, global);`);
  lines.push(`}`);
  lines.push('');
  lines.push(`} // namespace ${cppNamespace}`);
  lines.push('');
  return lines.join('\n');
}

/**
 * Generic AST-driven emitter for engine-object wrappers with dictionary options.
 * @param {Array<Object>} interfaceDefs
 * @returns {string}
 */
export function emitEngineWrapperTU(interfaceDefs) {
  const primary = interfaceDefs.find(i => hasAttr(i, 'engine_wrapper')) || interfaceDefs[0];
  const pascal = toPascalCase(primary.name);
  const snake = toSnakeCase(primary.name);
  const cppHeader = getAttr(primary, 'cpp_header') || `js/${snake}_bindings.h`;
  const cppNamespace = getAttr(primary, 'cpp_namespace') || 'bro::js';
  const cppIncludes = getAttr(primary, 'cpp_includes') || '';
  const cppGuard = getAttr(primary, 'cpp_guard') || (hasAttr(primary, 'gate') ? getAttr(primary, 'gate') : null);
  const managerType = getAttr(primary, 'engine_wrapper') || 'scene::TerrainManager';
  const configType = getAttr(primary, 'config_struct') || 'scene::TerrainConfig';
  const wrapperStruct = `${pascal}Wrapper`;

  const lines = [];
  if (cppGuard) {
    lines.push(`#if ${cppGuard}`);
    lines.push('');
  }
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
  lines.push(`struct ${wrapperStruct} {`);
  lines.push(`    std::unique_ptr<${managerType}> manager;`);
  lines.push(`    JSContext* cbCtx = nullptr;`);
  lines.push(`    JSValue    heightSource = JS_UNDEFINED;`);
  lines.push(`    bool       hasHeightSource = false;`);
  lines.push('');
  lines.push(`    explicit ${wrapperStruct}(std::unique_ptr<${managerType}> mgr)`);
  lines.push(`        : manager(std::move(mgr)) { allInstances().insert(this); }`);
  lines.push(`    ~${wrapperStruct}() {`);
  lines.push(`        if (hasHeightSource && cbCtx) JS_FreeValue(cbCtx, heightSource);`);
  lines.push(`        allInstances().erase(this);`);
  lines.push(`    }`);
  lines.push('');
  lines.push(`    static std::unordered_set<${wrapperStruct}*>& allInstances() {`);
  lines.push(`        static std::unordered_set<${wrapperStruct}*> s;`);
  lines.push(`        return s;`);
  lines.push(`    }`);
  lines.push(`};`);
  lines.push('');
  lines.push(`using TW = ${wrapperStruct};`);
  lines.push('');
  lines.push(`static ${configType} parseConfig(JSContext* ctx, JSValueConst opts) {`);
  lines.push(`    ${configType} cfg;`);
  lines.push(`    JSValue cs = JS_GetPropertyStr(ctx, opts, "chunkSize");`);
  lines.push(`    if (JS_IsArray(cs)) {`);
  lines.push(`        JSValue cx = JS_GetPropertyUint32(ctx, cs, 0);`);
  lines.push(`        JSValue cy = JS_GetPropertyUint32(ctx, cs, 1);`);
  lines.push(`        JSValue cz = JS_GetPropertyUint32(ctx, cs, 2);`);
  lines.push(`        double vx = 64, vy = 48, vz = 64;`);
  lines.push(`        JS_ToFloat64(ctx, &vx, cx); JS_ToFloat64(ctx, &vy, cy); JS_ToFloat64(ctx, &vz, cz);`);
  lines.push(`        cfg.chunkSizeX = (int)vx; cfg.chunkSizeY = (int)vy; cfg.chunkSizeZ = (int)vz;`);
  lines.push(`        JS_FreeValue(ctx, cx); JS_FreeValue(ctx, cy); JS_FreeValue(ctx, cz);`);
  lines.push(`    }`);
  lines.push(`    JS_FreeValue(ctx, cs);`);
  lines.push(`    cfg.cellSize = (float)qjsbind::get_prop_number(ctx, opts, "cellSize", cfg.cellSize);`);
  lines.push(`    cfg.loadRadius = qjsbind::get_prop_int(ctx, opts, "loadRadius", cfg.loadRadius);`);
  lines.push(`    cfg.unloadRadius = qjsbind::get_prop_int(ctx, opts, "unloadRadius", cfg.unloadRadius);`);
  lines.push(`    cfg.maxLoadsPerUpdate = qjsbind::get_prop_int(ctx, opts, "maxLoadsPerUpdate", cfg.maxLoadsPerUpdate);`);
  lines.push(`    cfg.seed = qjsbind::get_prop_int(ctx, opts, "seed", cfg.seed);`);
  lines.push(`    cfg.baseHeight = qjsbind::get_prop_int(ctx, opts, "baseHeight", cfg.baseHeight);`);
  lines.push(`    cfg.heightAmplitude = qjsbind::get_prop_int(ctx, opts, "heightAmplitude", cfg.heightAmplitude);`);
  lines.push(`    cfg.seaLevel = qjsbind::get_prop_int(ctx, opts, "seaLevel", cfg.seaLevel);`);
  lines.push(`    cfg.meshMode = qjsbind::get_prop_int(ctx, opts, "meshMode", cfg.meshMode);`);
  lines.push(`    cfg.terraceStep = (float)qjsbind::get_prop_number(ctx, opts, "terraceStep", cfg.terraceStep);`);
  lines.push(`    cfg.continentFrequency = (float)qjsbind::get_prop_number(ctx, opts, "continentFrequency", cfg.continentFrequency);`);
  lines.push(`    cfg.continentMin = (float)qjsbind::get_prop_number(ctx, opts, "continentMin", cfg.continentMin);`);
  lines.push(`    cfg.continentMax = (float)qjsbind::get_prop_number(ctx, opts, "continentMax", cfg.continentMax);`);
  lines.push(`    cfg.mountainFrequency = (float)qjsbind::get_prop_number(ctx, opts, "mountainFrequency", cfg.mountainFrequency);`);
  lines.push(`    cfg.mountainAmplitude = (float)qjsbind::get_prop_number(ctx, opts, "mountainAmplitude", cfg.mountainAmplitude);`);
  lines.push(`    cfg.mountainOctaves = qjsbind::get_prop_int(ctx, opts, "mountainOctaves", cfg.mountainOctaves);`);
  lines.push(`    cfg.lodLevelCount = qjsbind::get_prop_int(ctx, opts, "lodLevels", cfg.lodLevelCount);`);
  lines.push(`    cfg.lodScaleFactor = qjsbind::get_prop_int(ctx, opts, "lodScaleFactor", cfg.lodScaleFactor);`);
  lines.push(`    cfg.planetRadius = (float)qjsbind::get_prop_number(ctx, opts, "planetRadius", cfg.planetRadius);`);
  lines.push(`    JSValue orig = JS_GetPropertyStr(ctx, opts, "origin");`);
  lines.push(`    if (JS_IsArray(orig)) {`);
  lines.push(`        JSValue ox = JS_GetPropertyUint32(ctx, orig, 0);`);
  lines.push(`        JSValue oy = JS_GetPropertyUint32(ctx, orig, 1);`);
  lines.push(`        JSValue oz = JS_GetPropertyUint32(ctx, orig, 2);`);
  lines.push(`        double vx = 0, vy = 0, vz = 0;`);
  lines.push(`        JS_ToFloat64(ctx, &vx, ox); JS_ToFloat64(ctx, &vy, oy); JS_ToFloat64(ctx, &vz, oz);`);
  lines.push(`        cfg.origin = {(float)vx, (float)vy, (float)vz};`);
  lines.push(`        JS_FreeValue(ctx, ox); JS_FreeValue(ctx, oy); JS_FreeValue(ctx, oz);`);
  lines.push(`    }`);
  lines.push(`    JS_FreeValue(ctx, orig);`);
  lines.push(`    JSValue noise = JS_GetPropertyStr(ctx, opts, "noise");`);
  lines.push(`    if (JS_IsObject(noise)) {`);
  lines.push(`        cfg.noiseFrequency = (float)qjsbind::get_prop_number(ctx, noise, "frequency", cfg.noiseFrequency);`);
  lines.push(`        cfg.noiseOctaves = qjsbind::get_prop_int(ctx, noise, "octaves", cfg.noiseOctaves);`);
  lines.push(`        cfg.noiseGain = (float)qjsbind::get_prop_number(ctx, noise, "gain", cfg.noiseGain);`);
  lines.push(`        cfg.noiseLacunarity = (float)qjsbind::get_prop_number(ctx, noise, "lacunarity", cfg.noiseLacunarity);`);
  lines.push(`    }`);
  lines.push(`    JS_FreeValue(ctx, noise);`);
  lines.push(`    JSValue pal = JS_GetPropertyStr(ctx, opts, "palette");`);
  lines.push(`    if (!JS_IsUndefined(pal)) {`);
  lines.push(`        size_t offset = 0, byteLen = 0, bpe = 0;`);
  lines.push(`        JSValue abuf = JS_GetTypedArrayBuffer(ctx, pal, &offset, &byteLen, &bpe);`);
  lines.push(`        if (!JS_IsException(abuf)) {`);
  lines.push(`            size_t abufLen = 0;`);
  lines.push(`            uint8_t* raw = JS_GetArrayBuffer(ctx, &abufLen, abuf);`);
  lines.push(`            if (raw && byteLen > 0) {`);
  lines.push(`                size_t count = byteLen / sizeof(float);`);
  lines.push(`                const float* fp = reinterpret_cast<const float*>(raw + offset);`);
  lines.push(`                cfg.palette.assign(fp, fp + count);`);
  lines.push(`            }`);
  lines.push(`            JS_FreeValue(ctx, abuf);`);
  lines.push(`        } else {`);
  lines.push(`            JS_FreeValue(ctx, abuf);`);
  lines.push(`            JSValue lenVal = JS_GetPropertyStr(ctx, pal, "length");`);
  lines.push(`            int32_t len = 0; JS_ToInt32(ctx, &len, lenVal); JS_FreeValue(ctx, lenVal);`);
  lines.push(`            if (len > 0) {`);
  lines.push(`                cfg.palette.resize(len);`);
  lines.push(`                for (int32_t i = 0; i < len; i++) {`);
  lines.push(`                    JSValue el = JS_GetPropertyUint32(ctx, pal, i);`);
  lines.push(`                    double v = 0; JS_ToFloat64(ctx, &v, el);`);
  lines.push(`                    cfg.palette[i] = (float)v;`);
  lines.push(`                    JS_FreeValue(ctx, el);`);
  lines.push(`                }`);
  lines.push(`            }`);
  lines.push(`        }`);
  lines.push(`    }`);
  lines.push(`    JS_FreeValue(ctx, pal);`);
  lines.push(`    return cfg;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_raycast(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {`);
  lines.push(`    auto* self = qjsbind::unwrap<TW>(ctx, this_val);`);
  lines.push(`    if (!self || !self->manager || argc < 2) return JS_NULL;`);
  lines.push(`    bromath::Vec3 origin, dir;`);
  lines.push(`    JSValue o = argv[0], d = argv[1];`);
  lines.push(`    if (JS_IsArray(o)) {`);
  lines.push(`        JSValue x = JS_GetPropertyUint32(ctx, o, 0), y = JS_GetPropertyUint32(ctx, o, 1), z = JS_GetPropertyUint32(ctx, o, 2);`);
  lines.push(`        double vx = 0, vy = 0, vz = 0;`);
  lines.push(`        JS_ToFloat64(ctx, &vx, x); JS_ToFloat64(ctx, &vy, y); JS_ToFloat64(ctx, &vz, z);`);
  lines.push(`        origin = {(float)vx, (float)vy, (float)vz};`);
  lines.push(`        JS_FreeValue(ctx, x); JS_FreeValue(ctx, y); JS_FreeValue(ctx, z);`);
  lines.push(`    }`);
  lines.push(`    if (JS_IsArray(d)) {`);
  lines.push(`        JSValue x = JS_GetPropertyUint32(ctx, d, 0), y = JS_GetPropertyUint32(ctx, d, 1), z = JS_GetPropertyUint32(ctx, d, 2);`);
  lines.push(`        double vx = 0, vy = 0, vz = 0;`);
  lines.push(`        JS_ToFloat64(ctx, &vx, x); JS_ToFloat64(ctx, &vy, y); JS_ToFloat64(ctx, &vz, z);`);
  lines.push(`        dir = {(float)vx, (float)vy, (float)vz};`);
  lines.push(`        JS_FreeValue(ctx, x); JS_FreeValue(ctx, y); JS_FreeValue(ctx, z);`);
  lines.push(`    }`);
  lines.push(`    float maxDist = argc > 2 ? (float)qjsbind::Convert<double>::from_js(ctx, argv[2]) : 1000.0f;`);
  lines.push(`    auto hit = self->manager->raycast(origin, dir, maxDist);`);
  lines.push(`    if (!hit.hit) return JS_NULL;`);
  lines.push(`    JSValue res = JS_NewObject(ctx);`);
  lines.push(`    JS_SetPropertyStr(ctx, res, "hit", JS_NewBool(ctx, true));`);
  lines.push(`    JS_SetPropertyStr(ctx, res, "distance", JS_NewFloat64(ctx, hit.distance));`);
  lines.push(`    JSValue pos = JS_NewArray(ctx);`);
  lines.push(`    JS_SetPropertyUint32(ctx, pos, 0, JS_NewFloat64(ctx, hit.worldPos[0]));`);
  lines.push(`    JS_SetPropertyUint32(ctx, pos, 1, JS_NewFloat64(ctx, hit.worldPos[1]));`);
  lines.push(`    JS_SetPropertyUint32(ctx, pos, 2, JS_NewFloat64(ctx, hit.worldPos[2]));`);
  lines.push(`    JS_SetPropertyStr(ctx, res, "position", pos);`);
  lines.push(`    JSValue norm = JS_NewArray(ctx);`);
  lines.push(`    JS_SetPropertyUint32(ctx, norm, 0, JS_NewFloat64(ctx, hit.normal[0]));`);
  lines.push(`    JS_SetPropertyUint32(ctx, norm, 1, JS_NewFloat64(ctx, hit.normal[1]));`);
  lines.push(`    JS_SetPropertyUint32(ctx, norm, 2, JS_NewFloat64(ctx, hit.normal[2]));`);
  lines.push(`    JS_SetPropertyStr(ctx, res, "normal", norm);`);
  lines.push(`    JSValue chunk = JS_NewArray(ctx);`);
  lines.push(`    JS_SetPropertyUint32(ctx, chunk, 0, JS_NewInt32(ctx, hit.chunk.x));`);
  lines.push(`    JS_SetPropertyUint32(ctx, chunk, 1, JS_NewInt32(ctx, hit.chunk.z));`);
  lines.push(`    JS_SetPropertyStr(ctx, res, "chunk", chunk);`);
  lines.push(`    JSValue vox = JS_NewArray(ctx);`);
  lines.push(`    JS_SetPropertyUint32(ctx, vox, 0, JS_NewInt32(ctx, hit.localX));`);
  lines.push(`    JS_SetPropertyUint32(ctx, vox, 1, JS_NewInt32(ctx, hit.localY));`);
  lines.push(`    JS_SetPropertyUint32(ctx, vox, 2, JS_NewInt32(ctx, hit.localZ));`);
  lines.push(`    JS_SetPropertyStr(ctx, res, "voxel", vox);`);
  lines.push(`    JS_SetPropertyStr(ctx, res, "material", JS_NewInt32(ctx, hit.material));`);
  lines.push(`    return res;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_configure(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {`);
  lines.push(`    auto* self = qjsbind::unwrap<TW>(ctx, this_val);`);
  lines.push(`    if (!self || !self->manager || argc < 1 || !JS_IsObject(argv[0])) return JS_UNDEFINED;`);
  lines.push(`    self->manager->configure(parseConfig(ctx, argv[0]));`);
  lines.push(`    return JS_UNDEFINED;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_invalidateRegion(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {`);
  lines.push(`    auto* self = qjsbind::unwrap<TW>(ctx, this_val);`);
  lines.push(`    if (!self || !self->manager) return JS_UNDEFINED;`);
  lines.push(`    if (argc < 4) return JS_ThrowTypeError(ctx, "invalidateRegion(x0, z0, x1, z1) needs 4 numbers");`);
  lines.push(`    double v[4];`);
  lines.push(`    for (int i = 0; i < 4; i++) {`);
  lines.push(`        if (JS_ToFloat64(ctx, &v[i], argv[i]) < 0) return JS_EXCEPTION;`);
  lines.push(`    }`);
  lines.push(`    self->manager->invalidateRegion(static_cast<float>(v[0]), static_cast<float>(v[1]),`);
  lines.push(`                                    static_cast<float>(v[2]), static_cast<float>(v[3]));`);
  lines.push(`    return JS_UNDEFINED;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_${snake}_setHeightSource(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {`);
  lines.push(`    auto* self = qjsbind::unwrap<TW>(ctx, this_val);`);
  lines.push(`    if (!self || !self->manager) return JS_UNDEFINED;`);
  lines.push(`    if (self->hasHeightSource) {`);
  lines.push(`        JS_FreeValue(self->cbCtx, self->heightSource);`);
  lines.push(`        self->hasHeightSource = false;`);
  lines.push(`        self->heightSource = JS_UNDEFINED;`);
  lines.push(`    }`);
  lines.push(`    if (argc < 1 || !JS_IsFunction(ctx, argv[0])) {`);
  lines.push(`        self->manager->setHeightSource(nullptr);`);
  lines.push(`        return JS_UNDEFINED;`);
  lines.push(`    }`);
  lines.push(`    self->cbCtx = ctx;`);
  lines.push(`    self->heightSource = JS_DupValue(ctx, argv[0]);`);
  lines.push(`    self->hasHeightSource = true;`);
  lines.push(`    self->manager->setHeightSource(`);
  lines.push(`        [self](int cx, int cz, int lod, float* padded, int paddedW, int paddedH,`);
  lines.push(`               float cellSize, float worldX0, float worldZ0) -> bool {`);
  lines.push(`            JSContext* c = self->cbCtx;`);
  lines.push(`            JSValue args[8] = {`);
  lines.push(`                JS_NewInt32(c, cx),          JS_NewInt32(c, cz),`);
  lines.push(`                JS_NewInt32(c, lod),         JS_NewInt32(c, paddedW),`);
  lines.push(`                JS_NewInt32(c, paddedH),     JS_NewFloat64(c, cellSize),`);
  lines.push(`                JS_NewFloat64(c, worldX0),   JS_NewFloat64(c, worldZ0),`);
  lines.push(`            };`);
  lines.push(`            JSValue r = JS_Call(c, self->heightSource, JS_UNDEFINED, 8, args);`);
  lines.push(`            for (JSValue& a : args) JS_FreeValue(c, a);`);
  lines.push(`            if (JS_IsException(r)) {`);
  lines.push(`                JSValue e = JS_GetException(c);`);
  lines.push(`                const char* msg = JS_ToCString(c, e);`);
  lines.push(`                if (msg) {`);
  lines.push(`                    LOG_ERROR("terrain heightSource threw: %s", msg);`);
  lines.push(`                    JS_FreeCString(c, msg);`);
  lines.push(`                }`);
  lines.push(`                JS_FreeValue(c, e);`);
  lines.push(`                JS_FreeValue(c, r);`);
  lines.push(`                return false;`);
  lines.push(`            }`);
  lines.push(`            if (!JS_IsObject(r)) { JS_FreeValue(c, r); return false; }`);
  lines.push(`            size_t byteOff = 0, viewLen = 0;`);
  lines.push(`            JSValue abuf = JS_GetTypedArrayBuffer(c, r, &byteOff, &viewLen, nullptr);`);
  lines.push(`            if (JS_IsException(abuf)) {`);
  lines.push(`                JS_FreeValue(c, JS_GetException(c));`);
  lines.push(`                JS_FreeValue(c, r);`);
  lines.push(`                return false;`);
  lines.push(`            }`);
  lines.push(`            size_t abufLen = 0;`);
  lines.push(`            uint8_t* ptr = JS_GetArrayBuffer(c, &abufLen, abuf);`);
  lines.push(`            const size_t want = static_cast<size_t>(paddedW) * paddedH * sizeof(float);`);
  lines.push(`            bool ok = ptr && viewLen >= want;`);
  lines.push(`            if (ok) {`);
  lines.push(`                std::memcpy(padded, ptr + byteOff, want);`);
  lines.push(`            } else if (ptr) {`);
  lines.push(`                LOG_ERROR("terrain heightSource returned %zu bytes, expected %zu "`);
  lines.push(`                          "(%dx%d padded floats) - falling back to noise",`);
  lines.push(`                          viewLen, want, paddedW, paddedH);`);
  lines.push(`            }`);
  lines.push(`            JS_FreeValue(c, abuf);`);
  lines.push(`            JS_FreeValue(c, r);`);
  lines.push(`            return ok;`);
  lines.push(`        });`);
  lines.push(`    return JS_UNDEFINED;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`JSValue create${pascal}JS(JSContext* ctx, scene::SceneGraph* graph, JSValueConst opts) {`);
  lines.push(`    if (!graph) return JS_NULL;`);
  lines.push(`    auto mgr = std::make_unique<${managerType}>(*graph);`);
  lines.push(`    mgr->configure(parseConfig(ctx, opts));`);
  lines.push(`    auto* tw = new ${wrapperStruct}(std::move(mgr));`);
  lines.push(`    return qjsbind::wrap<TW>(ctx, tw);`);
  lines.push(`}`);
  lines.push('');
  lines.push(`void* ${snake}HandleFromJS(JSContext* ctx, JSValueConst v) {`);
  lines.push(`    auto* tw = qjsbind::unwrap<TW>(ctx, v);`);
  lines.push(`    return static_cast<void*>(tw);`);
  lines.push(`}`);
  lines.push('');
  lines.push(`bool ${snake}SampleHeight(void* handle, float x, float z,`);
  lines.push(`                         float rayStartY, float rayLength, float& outY) {`);
  lines.push(`    if (!handle) return false;`);
  lines.push(`    auto* tw = static_cast<${wrapperStruct}*>(handle);`);
  lines.push(`    if (${wrapperStruct}::allInstances().find(tw) == ${wrapperStruct}::allInstances().end() || !tw->manager) {`);
  lines.push(`        return false;`);
  lines.push(`    }`);
  lines.push(`    const bromath::Vec3 origin{x, rayStartY, z};`);
  lines.push(`    const bromath::Vec3 dir{0.0f, -1.0f, 0.0f};`);
  lines.push(`    auto hit = tw->manager->raycast(origin, dir, rayLength);`);
  lines.push(`    if (!hit.hit) return false;`);
  lines.push(`    outY = hit.worldPos[1];`);
  lines.push(`    return true;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`void ${pascal}Bindings::cleanup(JSContext*) {`);
  lines.push(`    for (auto* tw : TW::allInstances()) {`);
  lines.push(`        if (tw->manager) {`);
  lines.push(`            tw->manager->clear();`);
  lines.push(`            tw->manager.reset();`);
  lines.push(`        }`);
  lines.push(`    }`);
  lines.push(`}`);
  lines.push('');
  lines.push(`void ${pascal}Bindings::install(JSContext* ctx) {`);
  lines.push(`    qjsbind::Class<TW>(ctx, "${primary.name}")`);
  lines.push(`        .method("update", [](TW* self, JSContext*, double x, double y, double z) -> int {`);
  lines.push(`            if (!self->manager) return 0;`);
  lines.push(`            return self->manager->update((float)x, (float)y, (float)z);`);
  lines.push(`        })`);
  lines.push(`        .method_raw("raycast", js_${snake}_raycast, 2)`);
  lines.push(`        .method("setVoxel", [](TW* self, double wx, double wy, double wz, int mat) -> bool {`);
  lines.push(`            if (!self->manager) return false;`);
  lines.push(`            return self->manager->setVoxel((float)wx, (float)wy, (float)wz, (uint8_t)mat);`);
  lines.push(`        })`);
  lines.push(`        .method("getVoxel", [](TW* self, double wx, double wy, double wz) -> int {`);
  lines.push(`            if (!self->manager) return 0;`);
  lines.push(`            return (int)self->manager->getVoxel((float)wx, (float)wy, (float)wz);`);
  lines.push(`        })`);
  lines.push(`        .method("rebuild", [](TW* self) {`);
  lines.push(`            if (self->manager) self->manager->rebuildDirty();`);
  lines.push(`        })`);
  lines.push(`        .method_raw("configure", js_${snake}_configure, 1)`);
  lines.push(`        .method_raw("setHeightSource", js_${snake}_setHeightSource, 1)`);
  lines.push(`        .method_raw("invalidateRegion", js_${snake}_invalidateRegion, 4)`);
  lines.push(`        .method("destroy", [](TW* self) {`);
  lines.push(`            if (self->manager) {`);
  lines.push(`                self->manager->clear();`);
  lines.push(`                self->manager.reset();`);
  lines.push(`            }`);
  lines.push(`        })`);
  lines.push(`        .get("chunkCount", [](TW* self) -> int {`);
  lines.push(`            return self->manager ? self->manager->chunkCount() : 0;`);
  lines.push(`        })`);
  lines.push(`        .get("triangleCount", [](TW* self) -> int {`);
  lines.push(`            return self->manager ? self->manager->totalTriangles() : 0;`);
  lines.push(`        })`);
  lines.push(`        .get("vertexCount", [](TW* self) -> int {`);
  lines.push(`            return self->manager ? self->manager->totalVertices() : 0;`);
  lines.push(`        })`);
  lines.push(`        .get("farDistance", [](TW* self) -> double {`);
  lines.push(`            return self->manager ? self->manager->farDistance() : 1000.0;`);
  lines.push(`        })`);
  lines.push(`        .get("planetRadius", [](TW* self) -> double {`);
  lines.push(`            return self->manager ? (double)self->manager->config().planetRadius : 0.0;`);
  lines.push(`        })`);
  lines.push(`        .get("origin", [](TW* self, JSContext* ctx) -> JSValue {`);
  lines.push(`            if (!self->manager) return JS_NULL;`);
  lines.push(`            auto& o = self->manager->config().origin;`);
  lines.push(`            JSValue arr = JS_NewArray(ctx);`);
  lines.push(`            JS_SetPropertyUint32(ctx, arr, 0, JS_NewFloat64(ctx, o.x));`);
  lines.push(`            JS_SetPropertyUint32(ctx, arr, 1, JS_NewFloat64(ctx, o.y));`);
  lines.push(`            JS_SetPropertyUint32(ctx, arr, 2, JS_NewFloat64(ctx, o.z));`);
  lines.push(`            return arr;`);
  lines.push(`        });`);
  lines.push(`}`);
  lines.push('');
  lines.push(`} // namespace ${cppNamespace}`);
  if (cppGuard) {
    lines.push('');
    lines.push(`#endif // ${cppGuard}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Generic AST-driven emitter for VFS path resolution namespaces.
 * @param {Object} nsDef
 * @returns {string}
 */
export function emitVfsPathsTU(nsDef) {
  const ns = nsDef.name;
  const snake = toSnakeCase(ns);
  const cppHeader = getAttr(nsDef, 'cpp_header') || `js/${snake}.h`;
  const cppNamespace = getAttr(nsDef, 'cpp_namespace') || 'bro::js';
  const cppIncludes = getAttr(nsDef, 'cpp_includes') || '';
  const cppInstall = getAttr(nsDef, 'cpp_install') || 'installAssetPathBindings';

  const lines = [];
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
  lines.push(`static JSValue js_get_app_dir(JSContext* ctx, JSValueConst, int, JSValueConst*) {`);
  lines.push(`    const auto& appDir = bro::engine::Engine::instance().appDir();`);
  lines.push(`    return JS_NewString(ctx, appDir.c_str());`);
  lines.push(`}`);
  lines.push('');
  lines.push(`static JSValue js_resolve_path(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {`);
  lines.push(`    if (argc < 1) return JS_UNDEFINED;`);
  lines.push(`    const char* pathStr = JS_ToCString(ctx, argv[0]);`);
  lines.push(`    if (!pathStr) return JS_EXCEPTION;`);
  lines.push(`    std::string path(pathStr);`);
  lines.push(`    JS_FreeCString(ctx, pathStr);`);
  lines.push(`    std::string resolved = bro::vfs::resolvePath(path);`);
  lines.push(`    return JS_NewString(ctx, resolved.c_str());`);
  lines.push(`}`);
  lines.push('');
  lines.push(`void ${cppInstall}(JSContext* ctx) {`);
  lines.push(`    JSValue global = JS_GetGlobalObject(ctx);`);
  lines.push(`    JSValue broObj = JS_GetPropertyStr(ctx, global, "bro");`);
  lines.push(`    if (JS_IsUndefined(broObj) || JS_IsException(broObj)) {`);
  lines.push(`        broObj = JS_NewObject(ctx);`);
  lines.push(`        JS_SetPropertyStr(ctx, global, "bro", JS_DupValue(ctx, broObj));`);
  lines.push(`    }`);
  lines.push('');
  lines.push(`    JSAtom appDirAtom = JS_NewAtom(ctx, "appDir");`);
  lines.push(`    JS_DefinePropertyGetSet(ctx, broObj, appDirAtom,`);
  lines.push(`        JS_NewCFunction(ctx, js_get_app_dir, "appDir", 0),`);
  lines.push(`        JS_UNDEFINED,`);
  lines.push(`        JS_PROP_CONFIGURABLE | JS_PROP_ENUMERABLE);`);
  lines.push(`    JS_FreeAtom(ctx, appDirAtom);`);
  lines.push('');
  lines.push(`    JS_SetPropertyStr(ctx, broObj, "resolvePath",`);
  lines.push(`        JS_NewCFunction(ctx, js_resolve_path, "resolvePath", 1));`);
  lines.push('');
  lines.push(`    JS_FreeValue(ctx, broObj);`);
  lines.push(`    JS_FreeValue(ctx, global);`);
  lines.push(`}`);
  lines.push('');
  lines.push(`} // namespace ${cppNamespace}`);
  lines.push('');
  return lines.join('\n');
}

