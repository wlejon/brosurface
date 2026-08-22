// schema/ast.mjs - AST node definitions and helpers for brosurface IDL

/**
 * Creates a source location record.
 * @param {string} file
 * @param {number} line
 * @param {number} col
 * @returns {{file: string, line: number, col: number}}
 */
export function createLocation(file, line, col) {
  return { file: file || '<unknown>', line: line || 1, col: col || 1 };
}

/**
 * Creates an IDL attribute node (e.g. [gate=BRO_WITH_X, custom, readonly]).
 * @param {string} name
 * @param {string|boolean|number} [value=true]
 * @param {Object} [loc]
 */
export function createAttribute(name, value = true, loc = null) {
  return {
    type: 'Attribute',
    name,
    value,
    loc,
  };
}

/**
 * Creates a Type node.
 * @param {string} name
 * @param {Object} [options]
 * @returns {Object}
 */
export function createType(name, options = {}) {
  return {
    type: 'Type',
    name: name || 'any',
    nullable: Boolean(options.nullable),
    genericArgs: options.genericArgs || [],
    unionMembers: options.unionMembers || [],
    isUnion: Boolean(options.isUnion),
    isArray: Boolean(options.isArray),
    loc: options.loc || null,
  };
}

/**
 * Creates a Parameter node.
 * @param {string} name
 * @param {Object} dataType
 * @param {Object} [options]
 */
export function createParameter(name, dataType, options = {}) {
  return {
    type: 'Parameter',
    name,
    dataType,
    optional: Boolean(options.optional),
    defaultValue: options.defaultValue !== undefined ? options.defaultValue : null,
    variadic: Boolean(options.variadic),
    attributes: options.attributes || [],
    doc: options.doc || '',
    loc: options.loc || null,
  };
}

/**
 * Creates an Operation (method) member node.
 * @param {string} name
 * @param {Object} returnType
 * @param {Array<Object>} parameters
 * @param {Object} [options]
 */
export function createOperationMember(name, returnType, parameters = [], options = {}) {
  return {
    type: 'OperationMember',
    name,
    returnType,
    parameters,
    isStatic: Boolean(options.isStatic),
    attributes: options.attributes || [],
    doc: options.doc || '',
    loc: options.loc || null,
  };
}

/**
 * Creates a Constructor member node.
 * @param {Array<Object>} parameters
 * @param {Object} [options]
 */
export function createConstructorMember(parameters = [], options = {}) {
  return {
    type: 'ConstructorMember',
    parameters,
    attributes: options.attributes || [],
    doc: options.doc || '',
    loc: options.loc || null,
  };
}

/**
 * Creates an Attribute (property) member node.
 * @param {string} name
 * @param {Object} dataType
 * @param {Object} [options]
 */
export function createAttributeMember(name, dataType, options = {}) {
  return {
    type: 'AttributeMember',
    name,
    dataType,
    readonly: Boolean(options.readonly),
    isStatic: Boolean(options.isStatic),
    attributes: options.attributes || [],
    doc: options.doc || '',
    loc: options.loc || null,
  };
}

/**
 * Creates a Constant member node.
 * @param {string} name
 * @param {Object} dataType
 * @param {*} value
 * @param {Object} [options]
 */
export function createConstantMember(name, dataType, value, options = {}) {
  return {
    type: 'ConstantMember',
    name,
    dataType,
    value,
    attributes: options.attributes || [],
    doc: options.doc || '',
    loc: options.loc || null,
  };
}

/**
 * Creates a Dictionary member (field) node.
 * @param {string} name
 * @param {Object} dataType
 * @param {Object} [options]
 */
export function createDictionaryMember(name, dataType, options = {}) {
  return {
    type: 'DictionaryMember',
    name,
    dataType,
    defaultValue: options.defaultValue !== undefined ? options.defaultValue : null,
    required: Boolean(options.required),
    attributes: options.attributes || [],
    doc: options.doc || '',
    loc: options.loc || null,
  };
}

/**
 * Creates an Interface definition node.
 * @param {string} name
 * @param {Object} [options]
 */
export function createInterface(name, options = {}) {
  return {
    type: 'Interface',
    name,
    parent: options.parent || null,
    members: options.members || [],
    attributes: options.attributes || [],
    doc: options.doc || '',
    loc: options.loc || null,
  };
}

/**
 * Creates a Namespace definition node.
 * @param {string} name
 * @param {Object} [options]
 */
export function createNamespace(name, options = {}) {
  return {
    type: 'Namespace',
    name,
    members: options.members || [],
    attributes: options.attributes || [],
    doc: options.doc || '',
    loc: options.loc || null,
  };
}

/**
 * Creates a Dictionary definition node.
 * @param {string} name
 * @param {Object} [options]
 */
export function createDictionary(name, options = {}) {
  return {
    type: 'Dictionary',
    name,
    parent: options.parent || null,
    members: options.members || [],
    attributes: options.attributes || [],
    doc: options.doc || '',
    loc: options.loc || null,
  };
}

/**
 * Creates an Enum definition node.
 * @param {string} name
 * @param {Array<{value: string, doc?: string, loc?: Object}>} values
 * @param {Object} [options]
 */
export function createEnum(name, values = [], options = {}) {
  return {
    type: 'Enum',
    name,
    values,
    attributes: options.attributes || [],
    doc: options.doc || '',
    loc: options.loc || null,
  };
}

/**
 * Creates a Typedef definition node.
 * @param {string} name
 * @param {Object} targetType
 * @param {Object} [options]
 */
export function createTypedef(name, targetType, options = {}) {
  return {
    type: 'Typedef',
    name,
    targetType,
    attributes: options.attributes || [],
    doc: options.doc || '',
    loc: options.loc || null,
  };
}

/**
 * Creates a top-level IDL file AST node.
 * @param {string} path
 * @param {Array<Object>} definitions
 * @param {Object} [options]
 */
export function createIDLFile(path, definitions = [], options = {}) {
  return {
    type: 'IDLFile',
    path,
    definitions,
    headerDoc: options.headerDoc || '',
    loc: options.loc || null,
  };
}

/**
 * Strips location metadata from an AST node for structural deep comparison.
 * @param {*} node
 * @returns {*}
 */
export function stripLocations(node) {
  if (node === null || typeof node !== 'object') {
    return node;
  }
  if (Array.isArray(node)) {
    return node.map(stripLocations);
  }
  const result = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc') continue;
    if (key === 'path' && node.type === 'IDLFile') continue;
    result[key] = stripLocations(value);
  }
  return result;
}

/**
 * Deeply compares two ASTs ignoring source location offsets and file path strings.
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function astEquals(a, b) {
  const sa = JSON.stringify(stripLocations(a));
  const sb = JSON.stringify(stripLocations(b));
  return sa === sb;
}
