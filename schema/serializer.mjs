// schema/serializer.mjs - Canonical IDL serializer for brosurface

/**
 * Serializes an IDLFile AST or node back into canonical IDL source text.
 * @param {Object} node
 * @returns {string}
 */
export function serialize(node) {
  if (!node) return '';

  if (node.type === 'IDLFile') {
    return serializeIDLFile(node);
  }
  if (node.type === 'Interface') {
    return serializeInterface(node, 0);
  }
  if (node.type === 'Namespace') {
    return serializeNamespace(node, 0);
  }
  if (node.type === 'Dictionary') {
    return serializeDictionary(node, 0);
  }
  if (node.type === 'Enum') {
    return serializeEnum(node, 0);
  }
  if (node.type === 'Typedef') {
    return serializeTypedef(node, 0);
  }

  throw new Error(`Unknown node type to serialize: ${node.type}`);
}

function serializeIDLFile(file) {
  const parts = [];

  if (file.headerDoc) {
    parts.push(formatDocComment(file.headerDoc, 0));
  }

  for (let i = 0; i < file.definitions.length; i++) {
    const def = file.definitions[i];
    parts.push(serialize(def));
  }

  return parts.join('\n\n') + '\n';
}

function serializeInterface(iface, indent) {
  const ind = ' '.repeat(indent);
  const parts = [];

  if (iface.doc) {
    parts.push(formatDocComment(iface.doc, indent));
  }

  const attrs = serializeAttributes(iface.attributes);
  const attrStr = attrs ? `${attrs}\n${ind}` : '';
  const parentStr = iface.parent ? ` : ${iface.parent}` : '';

  let header = `${ind}${attrStr}interface ${iface.name}${parentStr} {`;
  parts.push(header);

  const memberParts = [];
  for (const member of iface.members) {
    memberParts.push(serializeInterfaceMember(member, indent + 2));
  }

  if (memberParts.length > 0) {
    parts.push(memberParts.join('\n\n'));
  }

  parts.push(`${ind}};`);
  return parts.join('\n');
}

function serializeNamespace(ns, indent) {
  const ind = ' '.repeat(indent);
  const parts = [];

  if (ns.doc) {
    parts.push(formatDocComment(ns.doc, indent));
  }

  const attrs = serializeAttributes(ns.attributes);
  const attrStr = attrs ? `${attrs}\n${ind}` : '';

  let header = `${ind}${attrStr}namespace ${ns.name} {`;
  parts.push(header);

  const memberParts = [];
  for (const member of ns.members) {
    memberParts.push(serializeNamespaceMember(member, indent + 2));
  }

  if (memberParts.length > 0) {
    parts.push(memberParts.join('\n\n'));
  }

  parts.push(`${ind}};`);
  return parts.join('\n');
}

function serializeDictionary(dict, indent) {
  const ind = ' '.repeat(indent);
  const parts = [];

  if (dict.doc) {
    parts.push(formatDocComment(dict.doc, indent));
  }

  const attrs = serializeAttributes(dict.attributes);
  const attrStr = attrs ? `${attrs}\n${ind}` : '';
  const parentStr = dict.parent ? ` : ${dict.parent}` : '';

  let header = `${ind}${attrStr}dictionary ${dict.name}${parentStr} {`;
  parts.push(header);

  const memberParts = [];
  for (const member of dict.members) {
    memberParts.push(serializeDictionaryMember(member, indent + 2));
  }

  if (memberParts.length > 0) {
    parts.push(memberParts.join('\n\n'));
  }

  parts.push(`${ind}};`);
  return parts.join('\n');
}

function serializeEnum(en, indent) {
  const ind = ' '.repeat(indent);
  const parts = [];

  if (en.doc) {
    parts.push(formatDocComment(en.doc, indent));
  }

  const attrs = serializeAttributes(en.attributes);
  const attrStr = attrs ? `${attrs}\n${ind}` : '';

  parts.push(`${ind}${attrStr}enum ${en.name} {`);

  const valueParts = [];
  for (const val of en.values) {
    const valInd = ' '.repeat(indent + 2);
    let valStr = '';
    if (val.doc) {
      valStr += formatDocComment(val.doc, indent + 2) + '\n';
    }
    valStr += `${valInd}"${escapeString(val.value)}"`;
    valueParts.push(valStr);
  }

  parts.push(valueParts.join(',\n'));
  parts.push(`${ind}};`);
  return parts.join('\n');
}

function serializeTypedef(td, indent) {
  const ind = ' '.repeat(indent);
  const parts = [];

  if (td.doc) {
    parts.push(formatDocComment(td.doc, indent));
  }

  const attrs = serializeAttributes(td.attributes);
  const attrStr = attrs ? `${attrs} ` : '';

  parts.push(`${ind}${attrStr}typedef ${serializeType(td.targetType)} ${td.name};`);
  return parts.join('\n');
}

function serializeInterfaceMember(member, indent) {
  const ind = ' '.repeat(indent);
  const parts = [];

  if (member.doc) {
    parts.push(formatDocComment(member.doc, indent));
  }

  const attrs = serializeAttributes(member.attributes);
  const attrPrefix = attrs ? `${attrs} ` : '';

  if (member.type === 'ConstructorMember') {
    const params = member.parameters.map(serializeParameter).join(', ');
    parts.push(`${ind}${attrPrefix}constructor(${params});`);
  } else if (member.type === 'ConstantMember') {
    const val = serializeLiteral(member.value);
    parts.push(`${ind}${attrPrefix}const ${serializeType(member.dataType)} ${member.name} = ${val};`);
  } else if (member.type === 'AttributeMember') {
    const staticPrefix = member.isStatic ? 'static ' : '';
    const roPrefix = member.readonly ? 'readonly ' : '';
    parts.push(`${ind}${attrPrefix}${staticPrefix}${roPrefix}attribute ${serializeType(member.dataType)} ${member.name};`);
  } else if (member.type === 'OperationMember') {
    const staticPrefix = member.isStatic ? 'static ' : '';
    const params = member.parameters.map(serializeParameter).join(', ');
    parts.push(`${ind}${attrPrefix}${staticPrefix}${serializeType(member.returnType)} ${member.name}(${params});`);
  }

  return parts.join('\n');
}

function serializeNamespaceMember(member, indent) {
  const ind = ' '.repeat(indent);
  const parts = [];

  if (member.doc) {
    parts.push(formatDocComment(member.doc, indent));
  }

  const attrs = serializeAttributes(member.attributes);
  const attrPrefix = attrs ? `${attrs} ` : '';

  if (member.type === 'ConstantMember') {
    const val = serializeLiteral(member.value);
    parts.push(`${ind}${attrPrefix}const ${serializeType(member.dataType)} ${member.name} = ${val};`);
  } else if (member.type === 'AttributeMember') {
    const roPrefix = member.readonly ? 'readonly ' : '';
    parts.push(`${ind}${attrPrefix}${roPrefix}attribute ${serializeType(member.dataType)} ${member.name};`);
  } else if (member.type === 'OperationMember') {
    const params = member.parameters.map(serializeParameter).join(', ');
    parts.push(`${ind}${attrPrefix}${serializeType(member.returnType)} ${member.name}(${params});`);
  }

  return parts.join('\n');
}

function serializeDictionaryMember(member, indent) {
  const ind = ' '.repeat(indent);
  const parts = [];

  if (member.doc) {
    parts.push(formatDocComment(member.doc, indent));
  }

  const attrs = serializeAttributes(member.attributes);
  const attrPrefix = attrs ? `${attrs} ` : '';
  const reqPrefix = member.required ? 'required ' : '';
  const defaultSuffix = member.defaultValue !== undefined && member.defaultValue !== null
    ? ` = ${serializeLiteral(member.defaultValue)}`
    : '';

  parts.push(`${ind}${attrPrefix}${reqPrefix}${serializeType(member.dataType)} ${member.name}${defaultSuffix};`);
  return parts.join('\n');
}

function serializeParameter(param) {
  const attrs = serializeAttributes(param.attributes);
  const attrPrefix = attrs ? `${attrs} ` : '';
  const optPrefix = param.optional && param.defaultValue === null ? 'optional ' : '';
  const varPrefix = param.variadic ? '...' : '';
  const defaultSuffix = param.defaultValue !== undefined && param.defaultValue !== null
    ? ` = ${serializeLiteral(param.defaultValue)}`
    : '';

  return `${attrPrefix}${optPrefix}${serializeType(param.dataType)} ${varPrefix}${param.name}${defaultSuffix}`;
}

export function serializeType(type) {
  if (!type) return 'void';

  if (type.isUnion) {
    const unionStr = type.unionMembers.map(serializeType).join(' or ');
    const res = `(${unionStr})`;
    return type.nullable ? `${res}?` : res;
  }

  let base = type.name;

  if (type.genericArgs && type.genericArgs.length > 0) {
    const argsStr = type.genericArgs.map(serializeType).join(', ');
    base = `${type.name}<${argsStr}>`;
  }

  if (type.isArray) {
    base = `${base}[]`;
  }

  if (type.nullable) {
    base = `${base}?`;
  }

  return base;
}

function serializeAttributes(attributes) {
  if (!attributes || attributes.length === 0) {
    return '';
  }

  const attrStrs = attributes.map(a => {
    if (a.value === true) {
      return a.name;
    }
    if (typeof a.value === 'string') {
      return `${a.name}="${escapeString(a.value)}"`;
    }
    return `${a.name}=${a.value}`;
  });

  return `[${attrStrs.join(', ')}]`;
}

function serializeLiteral(val) {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'string') return `"${escapeString(val)}"`;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (Array.isArray(val) && val.length === 0) return '[]';
  if (typeof val === 'object' && Object.keys(val).length === 0) return '{}';
  return String(val);
}

function escapeString(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function formatDocComment(doc, indent) {
  const ind = ' '.repeat(indent);
  if (!doc || !doc.trim()) return '';

  const lines = doc.split('\n');
  const formattedLines = [`${ind}/**`];

  for (const line of lines) {
    if (line.trim() === '') {
      formattedLines.push(`${ind} *`);
    } else {
      formattedLines.push(`${ind} * ${line}`);
    }
  }

  formattedLines.push(`${ind} */`);
  return formattedLines.join('\n');
}
