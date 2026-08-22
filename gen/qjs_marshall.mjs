// gen/qjs_marshall.mjs - Generic QuickJS Type Marshalling Helpers for brosurface
// Implements marshalling across the frozen vocabulary (SPEC §5.1 / DESIGN §1)
// 100% generic, AST-driven, zero per-namespace conditionals.

/**
 * Maps an IDL Type AST node to corresponding C++ type name.
 * @param {Object} typeNode
 * @returns {string}
 */
export function typeToCpp(typeNode) {
  if (!typeNode) return 'void';

  if (typeNode.isUnion) {
    return 'JSValue';
  }

  const name = typeNode.name;
  switch (name) {
    case 'void':
      return 'void';
    case 'boolean':
      return 'bool';
    case 'byte':
    case 'octet':
      return 'uint8_t';
    case 'short':
      return 'int16_t';
    case 'unsigned short':
      return 'uint16_t';
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
    case 'float':
    case 'unrestricted float':
    case 'float32':
      return 'float';
    case 'double':
    case 'unrestricted double':
    case 'number':
    case 'float64':
      return 'double';
    case 'string':
    case 'DOMString':
    case 'ByteString':
    case 'USVString':
      return 'std::string';
    case 'Float32Array':
      return 'float*';
    case 'Uint8Array':
    case 'ArrayBuffer':
      return 'const uint8_t*';
    case 'Promise':
      return 'JSValue';
    default:
      return name;
  }
}

/**
 * Emits C++ argument extraction code for a single IDL parameter.
 * @param {Object} param - Parameter AST node
 * @param {number} idx - Argument index in argv
 * @param {string} [indent='    ']
 * @returns {string}
 */
export function emitArgExtraction(param, idx, indent = '    ') {
  const pName = param.name;
  const type = param.dataType;
  const isOpt = param.optional || param.defaultValue !== null;
  const lines = [];

  if (type.isUnion) {
    lines.push(`${indent}JSValueConst ${pName} = argv[${idx}];`);
    return lines.join('\n');
  }

  const tName = type.name;

  if (['double', 'unrestricted double', 'number', 'float64'].includes(tName)) {
    if (isOpt) {
      const defVal = param.defaultValue !== null && typeof param.defaultValue === 'number' ? param.defaultValue : '0.0';
      lines.push(`${indent}double ${pName} = ${defVal};`);
      lines.push(`${indent}if (argc > ${idx} && !JS_IsUndefined(argv[${idx}])) {`);
      lines.push(`${indent}    if (JS_ToFloat64(ctx, &${pName}, argv[${idx}])) return JS_EXCEPTION;`);
      lines.push(`${indent}}`);
    } else {
      lines.push(`${indent}double ${pName};`);
      lines.push(`${indent}if (JS_ToFloat64(ctx, &${pName}, argv[${idx}])) return JS_EXCEPTION;`);
    }
  } else if (['float', 'unrestricted float', 'float32'].includes(tName)) {
    if (isOpt) {
      const defVal = param.defaultValue !== null && typeof param.defaultValue === 'number' ? param.defaultValue : '0.0f';
      lines.push(`${indent}double ${pName}_d = ${defVal};`);
      lines.push(`${indent}if (argc > ${idx} && !JS_IsUndefined(argv[${idx}])) {`);
      lines.push(`${indent}    if (JS_ToFloat64(ctx, &${pName}_d, argv[${idx}])) return JS_EXCEPTION;`);
      lines.push(`${indent}}`);
      lines.push(`${indent}float ${pName} = static_cast<float>(${pName}_d);`);
    } else {
      lines.push(`${indent}double ${pName}_d;`);
      lines.push(`${indent}if (JS_ToFloat64(ctx, &${pName}_d, argv[${idx}])) return JS_EXCEPTION;`);
      lines.push(`${indent}float ${pName} = static_cast<float>(${pName}_d);`);
    }
  } else if (['long', 'int', 'int32', 'short'].includes(tName)) {
    if (isOpt) {
      const defVal = param.defaultValue !== null && typeof param.defaultValue === 'number' ? param.defaultValue : '0';
      lines.push(`${indent}int32_t ${pName} = ${defVal};`);
      lines.push(`${indent}if (argc > ${idx} && !JS_IsUndefined(argv[${idx}])) {`);
      lines.push(`${indent}    if (JS_ToInt32(ctx, &${pName}, argv[${idx}])) return JS_EXCEPTION;`);
      lines.push(`${indent}}`);
    } else {
      lines.push(`${indent}int32_t ${pName};`);
      lines.push(`${indent}if (JS_ToInt32(ctx, &${pName}, argv[${idx}])) return JS_EXCEPTION;`);
    }
  } else if (['unsigned long', 'uint', 'uint32', 'unsigned short'].includes(tName)) {
    if (isOpt) {
      const defVal = param.defaultValue !== null && typeof param.defaultValue === 'number' ? param.defaultValue : '0';
      lines.push(`${indent}uint32_t ${pName} = ${defVal};`);
      lines.push(`${indent}if (argc > ${idx} && !JS_IsUndefined(argv[${idx}])) {`);
      lines.push(`${indent}    if (JS_ToUint32(ctx, &${pName}, argv[${idx}])) return JS_EXCEPTION;`);
      lines.push(`${indent}}`);
    } else {
      lines.push(`${indent}uint32_t ${pName};`);
      lines.push(`${indent}if (JS_ToUint32(ctx, &${pName}, argv[${idx}])) return JS_EXCEPTION;`);
    }
  } else if (['long long', 'int64'].includes(tName)) {
    if (isOpt) {
      const defVal = param.defaultValue !== null && typeof param.defaultValue === 'number' ? param.defaultValue : '0';
      lines.push(`${indent}int64_t ${pName} = ${defVal};`);
      lines.push(`${indent}if (argc > ${idx} && !JS_IsUndefined(argv[${idx}])) {`);
      lines.push(`${indent}    if (JS_ToInt64(ctx, &${pName}, argv[${idx}])) return JS_EXCEPTION;`);
      lines.push(`${indent}}`);
    } else {
      lines.push(`${indent}int64_t ${pName};`);
      lines.push(`${indent}if (JS_ToInt64(ctx, &${pName}, argv[${idx}])) return JS_EXCEPTION;`);
    }
  } else if (tName === 'boolean') {
    if (isOpt) {
      const defVal = param.defaultValue === true ? 'true' : 'false';
      lines.push(`${indent}bool ${pName} = ${defVal};`);
      lines.push(`${indent}if (argc > ${idx} && !JS_IsUndefined(argv[${idx}])) {`);
      lines.push(`${indent}    ${pName} = JS_ToBool(ctx, argv[${idx}]) > 0;`);
      lines.push(`${indent}}`);
    } else {
      lines.push(`${indent}bool ${pName} = JS_ToBool(ctx, argv[${idx}]) > 0;`);
    }
  } else if (['string', 'DOMString', 'ByteString', 'USVString'].includes(tName)) {
    if (isOpt) {
      const defVal = typeof param.defaultValue === 'string' ? JSON.stringify(param.defaultValue) : '""';
      lines.push(`${indent}std::string ${pName} = ${defVal};`);
      lines.push(`${indent}if (argc > ${idx} && !JS_IsUndefined(argv[${idx}])) {`);
      lines.push(`${indent}    const char* ${pName}_cstr = JS_ToCString(ctx, argv[${idx}]);`);
      lines.push(`${indent}    if (!${pName}_cstr) return JS_EXCEPTION;`);
      lines.push(`${indent}    ${pName} = ${pName}_cstr;`);
      lines.push(`${indent}    JS_FreeCString(ctx, ${pName}_cstr);`);
      lines.push(`${indent}}`);
    } else {
      lines.push(`${indent}const char* ${pName}_cstr = JS_ToCString(ctx, argv[${idx}]);`);
      lines.push(`${indent}if (!${pName}_cstr) return JS_EXCEPTION;`);
      lines.push(`${indent}std::string ${pName} = ${pName}_cstr;`);
      lines.push(`${indent}JS_FreeCString(ctx, ${pName}_cstr);`);
    }
  } else if (tName === 'Float32Array') {
    lines.push(`${indent}float* ${pName} = nullptr;`);
    lines.push(`${indent}size_t n_${pName} = 0;`);
    lines.push(`${indent}if (!resolve_f32(ctx, argv[${idx}], "${pName}", &${pName}, &n_${pName})) return JS_EXCEPTION;`);
  } else {
    // General JSValue / object fallback
    lines.push(`${indent}JSValueConst ${pName} = argv[${idx}];`);
  }

  return lines.join('\n');
}

/**
 * Emits C++ return value conversion code from an expression to JSValue.
 * @param {Object} returnType - Return type AST node
 * @param {string} expr - C++ expression evaluating to the return value
 * @param {string} [indent='    ']
 * @returns {string}
 */
export function emitReturnConversion(returnType, expr, indent = '    ') {
  if (!returnType || returnType.name === 'void' || returnType.name === 'undefined') {
    return `${indent}return JS_UNDEFINED;`;
  }

  const name = returnType.name;

  if (name === 'boolean') {
    return `${indent}return JS_NewBool(ctx, ${expr});`;
  }
  if (['long', 'int', 'int32', 'short'].includes(name)) {
    return `${indent}return JS_NewInt32(ctx, static_cast<int32_t>(${expr}));`;
  }
  if (['unsigned long', 'uint', 'uint32', 'unsigned short'].includes(name)) {
    return `${indent}return JS_NewUint32(ctx, static_cast<uint32_t>(${expr}));`;
  }
  if (['long long', 'int64'].includes(name)) {
    return `${indent}return JS_NewInt64(ctx, static_cast<int64_t>(${expr}));`;
  }
  if (['double', 'unrestricted double', 'float', 'unrestricted float', 'number', 'float32', 'float64'].includes(name)) {
    return `${indent}return JS_NewFloat64(ctx, static_cast<double>(${expr}));`;
  }
  if (['string', 'DOMString', 'ByteString', 'USVString'].includes(name)) {
    return `${indent}return JS_NewString(ctx, (${expr}).c_str());`;
  }
  if (name === 'Float32Array') {
    return `${indent}return make_float32_array(ctx, (${expr}).data(), (${expr}).size());`;
  }
  if (name === 'Promise') {
    return `${indent}return ${expr};`;
  }

  return `${indent}return ${expr};`;
}
