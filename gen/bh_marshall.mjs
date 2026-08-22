// gen/bh_marshall.mjs - Generic Bronze Host Type Marshalling Helpers for brosurface
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
    return 'Value';
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
      return 'std::span<const float>';
    case 'Uint8Array':
    case 'ArrayBuffer':
      return 'std::span<const uint8_t>';
    case 'Blob':
      return 'const HostBlob*';
    case 'Promise':
      return 'Value';
    default:
      return name;
  }
}

/**
 * Emits C++ argument extraction code for a single IDL parameter in bronze_host.
 * @param {Object} param - Parameter AST node
 * @param {number} idx - Argument index in std::span<const Value>
 * @param {string} [indent='    ']
 * @returns {string}
 */
export function emitArgExtraction(param, idx, indent = '    ') {
  const pName = param.name;
  const type = param.dataType;
  const isOpt = param.optional || param.defaultValue !== null;
  const lines = [];

  if (type.isUnion) {
    lines.push(`${indent}Value ${pName} = argAt(a, ${idx});`);
    return lines.join('\n');
  }

  const tName = type.name;

  if (['double', 'unrestricted double', 'number', 'float64'].includes(tName)) {
    if (isOpt && param.defaultValue !== null && typeof param.defaultValue === 'number') {
      lines.push(`${indent}double ${pName} = a.size() > ${idx} && !ev::isUndefined(argAt(a, ${idx})) ? numAt(a, ${idx}) : ${param.defaultValue};`);
    } else {
      lines.push(`${indent}double ${pName} = numAt(a, ${idx});`);
    }
  } else if (['float', 'unrestricted float', 'float32'].includes(tName)) {
    if (isOpt && param.defaultValue !== null && typeof param.defaultValue === 'number') {
      lines.push(`${indent}float ${pName} = a.size() > ${idx} && !ev::isUndefined(argAt(a, ${idx})) ? static_cast<float>(numAt(a, ${idx})) : ${param.defaultValue}f;`);
    } else {
      lines.push(`${indent}float ${pName} = static_cast<float>(numAt(a, ${idx}));`);
    }
  } else if (['long', 'int', 'int32', 'short'].includes(tName)) {
    if (isOpt && param.defaultValue !== null && typeof param.defaultValue === 'number') {
      lines.push(`${indent}int32_t ${pName} = a.size() > ${idx} && !ev::isUndefined(argAt(a, ${idx})) ? i32At(a, ${idx}) : ${param.defaultValue};`);
    } else {
      lines.push(`${indent}int32_t ${pName} = i32At(a, ${idx});`);
    }
  } else if (['unsigned long', 'uint', 'uint32', 'unsigned short'].includes(tName)) {
    if (isOpt && param.defaultValue !== null && typeof param.defaultValue === 'number') {
      lines.push(`${indent}uint32_t ${pName} = a.size() > ${idx} && !ev::isUndefined(argAt(a, ${idx})) ? u32At(a, ${idx}) : ${param.defaultValue};`);
    } else {
      lines.push(`${indent}uint32_t ${pName} = u32At(a, ${idx});`);
    }
  } else if (['long long', 'int64'].includes(tName)) {
    if (isOpt && param.defaultValue !== null && typeof param.defaultValue === 'number') {
      lines.push(`${indent}int64_t ${pName} = a.size() > ${idx} && !ev::isUndefined(argAt(a, ${idx})) ? i64At(a, ${idx}) : ${param.defaultValue};`);
    } else {
      lines.push(`${indent}int64_t ${pName} = i64At(a, ${idx});`);
    }
  } else if (['unsigned long long', 'uint64'].includes(tName)) {
    lines.push(`${indent}uint64_t ${pName} = static_cast<uint64_t>(i64At(a, ${idx}));`);
  } else if (tName === 'boolean') {
    if (isOpt && param.defaultValue !== null) {
      const defVal = param.defaultValue === true ? 'true' : 'false';
      lines.push(`${indent}bool ${pName} = a.size() > ${idx} && !ev::isUndefined(argAt(a, ${idx})) ? boolAt(a, ${idx}) : ${defVal};`);
    } else {
      lines.push(`${indent}bool ${pName} = boolAt(a, ${idx});`);
    }
  } else if (['string', 'DOMString', 'ByteString', 'USVString'].includes(tName)) {
    lines.push(`${indent}Value ${pName}_v = argAt(a, ${idx});`);
    if (isOpt && typeof param.defaultValue === 'string') {
      const defStr = JSON.stringify(param.defaultValue);
      lines.push(`${indent}std::string ${pName} = (ev::isObject(${pName}_v) || ev::isUndefined(${pName}_v)) ? ${defStr} : ev::toUtf8(${pName}_v);`);
    } else {
      lines.push(`${indent}std::string ${pName} = (ev::isObject(${pName}_v) || ev::isUndefined(${pName}_v)) ? "" : ev::toUtf8(${pName}_v);`);
    }
  } else if (tName === 'Blob') {
    lines.push(`${indent}const HostBlob* ${pName} = hostBlobOf(argAt(a, ${idx}));`);
  } else {
    lines.push(`${indent}Value ${pName} = argAt(a, ${idx});`);
  }

  return lines.join('\n');
}

/**
 * Emits C++ return value conversion code from an expression to bronze Value.
 * @param {Object} returnType - Return type AST node
 * @param {string} expr - C++ expression evaluating to the return value
 * @param {string} [indent='    ']
 * @returns {string}
 */
export function emitReturnConversion(returnType, expr, indent = '    ') {
  if (!returnType || returnType.name === 'void' || returnType.name === 'undefined') {
    return `${indent}return ev::undefined();`;
  }

  const name = returnType.name;

  if (name === 'boolean') {
    return `${indent}return ev::fromBool(${expr});`;
  }
  if (['long', 'int', 'int32', 'short', 'unsigned long', 'uint', 'uint32', 'unsigned short', 'long long', 'int64', 'unsigned long long', 'uint64', 'double', 'unrestricted double', 'float', 'unrestricted float', 'number', 'float32', 'float64'].includes(name)) {
    return `${indent}return ev::fromDouble(static_cast<double>(${expr}));`;
  }
  if (['string', 'DOMString', 'ByteString', 'USVString'].includes(name)) {
    return `${indent}return ev::fromUtf8(${expr});`;
  }
  if (name === 'Promise') {
    return `${indent}return resolvedPromise(${expr});`;
  }

  return `${indent}return ${expr};`;
}
