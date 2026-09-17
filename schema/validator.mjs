// schema/validator.mjs - Semantic validator and error reporter for brosurface IDL

export const BUILTIN_TYPES = new Set([
  // Primitives
  'void',
  'undefined',
  'any',
  'object',
  'Function',
  'boolean',
  'byte',
  'octet',
  'short',
  'unsigned short',
  'long',
  'unsigned long',
  'long long',
  'unsigned long long',
  'float',
  'double',
  'unrestricted float',
  'unrestricted double',
  'number',
  'bigint',
  'int',
  'uint',
  'int32',
  'uint32',
  'int64',
  'uint64',
  'float32',
  'float64',

  // Strings
  'string',
  'DOMString',
  'ByteString',
  'USVString',

  // Binary / Buffers / Views
  'ArrayBuffer',
  'ArrayBufferView',
  'Uint8Array',
  'Int8Array',
  'Uint16Array',
  'Int16Array',
  'Uint32Array',
  'Int32Array',
  'Float32Array',
  'Float64Array',
  'Uint8ClampedArray',
  'BigInt64Array',
  'BigUint64Array',
  'DataView',

  // Callbacks & Events
  'EventListener',
  'EventHandler',
  'Event',

  // DOM core & streams
  'Document',
  'Element',
  'Node',
  'Blob',
  'File',
  'AsyncHandle',

  // Bro math / geometric vocabulary
  'vec2',
  'vec3',
  'vec4',
  'quat',
  'mat4',
  'color',
  'Color8',
  'AABB3',
  'Sphere',
  'Ray',
  'Plane',
  'Capsule',
]);

export const GENERIC_TYPES = new Set([
  'Promise',
  'sequence',
  'record',
  'Array',
]);

// Every extended attribute the generator actually reads. An attribute outside
// this set is a typo or an invention, and the emitters would silently ignore
// it — which is not a cosmetic problem: `feature_gate="BRO_WITH_SOUNDML"` sat
// in ten IDLs reading exactly like the gate it was meant to be, while the
// emitters only ever looked up `gate`. Seven namespaces were regenerated
// without their `#if` and the app-profile build lost their bindings. Silence
// is the bug, so an unknown name is an error here rather than a shrug in the
// emitter.
//
// Adding a genuinely new attribute means teaching an emitter to read it and
// adding it here, in that order.
//
// This set is exactly what gen/ and schema/native_types.mjs read. The QuickJS
// (`cpp_*`, `install_*`, the qjsbind wrapper plumbing) and bronze_host (`bh_*`)
// emitters are gone and their attributes with them — the IDLs carried ~870 of
// those as dead payload until 2026-09-17, some of them whole C++ function
// bodies. An IDL naming one now fails validation, which is the point.
export const KNOWN_EXTENDED_ATTRIBUTES = new Set([
  // Placement and identity (gen/natives_plan.mjs, emit_dts.mjs, emit_docs.mjs)
  'cpp_namespace', 'prefix', 'js_alias', 'js_global', 'global', 'global_var',

  // Feature gating. `gate` is the ONE spelling; `cpp_guard` is the raw escape
  // hatch for a guard expression that is not a single BRO_WITH_* flag.
  'gate', 'cpp_guard',

  // Natives emitter (gen/emit_natives.mjs; schema/native_types.mjs)
  //   manual     an operation / attribute / constructor the generator leaves
  //              to hand-written JS: a placeholder comment in the wrapper,
  //              no native; on a dictionary member, one that never crosses
  //              (no read native, no unpacked parameter) and that the
  //              hand-written wrapper assembles itself
  //   json       a dictionary that crosses as JSON in one `str`, in both
  //              directions, instead of member by member
  //   transfer   a typed-array result the body hands over zero-copy: it must
  //              set bronze_native_buffer::release
  //   view       an interface whose handles are views the host owns: no
  //              destructor is registered
  //   finalize   `insweep` (default) or `deferred`: when the destructor runs
  //   flatten    a namespace whose members mount on the prefix object itself
  //              (`bro.appDir`, not `bro.<ns>.appDir`)
  //   strict     a DOMString parameter or dictionary member the wrapper
  //              type-checks (a non-string is a TypeError) instead of
  //              ToString-coercing on the way to the native
  'manual', 'json', 'transfer', 'view', 'finalize', 'flatten', 'strict',
]);

export class ValidationError {
  /**
   * @param {string} message
   * @param {Object} [loc]
   * @param {string} [sourceSnippet]
   */
  constructor(message, loc = null, sourceSnippet = '') {
    this.message = message;
    this.file = loc ? loc.file : '<unknown>';
    this.line = loc ? loc.line : 1;
    this.col = loc ? loc.col : 1;
    this.sourceSnippet = sourceSnippet;
  }

  toString() {
    let out = `Error in ${this.file} (${this.line}:${this.col}): ${this.message}`;
    if (this.sourceSnippet) {
      out += `\n  ${this.sourceSnippet}`;
      out += `\n  ${' '.repeat(Math.max(0, this.col - 1))}^`;
    }
    return out;
  }
}

// Closest known attribute name within a small edit distance, or null. Exists
// so the error can say `did you mean 'gate'?` instead of leaving the author to
// grep the emitters for the spelling they should have used.
function nearestAttribute(name) {
  let best = null;
  let bestScore = Infinity;
  // A compound miss like `feature_gate` for `gate` is far outside any edit
  // distance worth accepting, but it is the likeliest mistake there is: the
  // author spelled out what they meant and the emitters read a shorter name.
  // Prefer a known attribute the unknown one ends with.
  for (const known of KNOWN_EXTENDED_ATTRIBUTES) {
    if (name !== known && name.endsWith('_' + known)) return known;
  }
  for (const known of KNOWN_EXTENDED_ATTRIBUTES) {
    const d = editDistance(name, known);
    if (d < bestScore) {
      bestScore = d;
      best = known;
    }
  }
  const limit = Math.max(2, Math.floor(name.length / 3));
  return bestScore <= limit ? best : null;
}

function editDistance(a, b) {
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

export class Validator {
  /**
   * @param {Array<Object>|Object} asts - Single IDLFile AST or array of IDLFile ASTs
   * @param {Map<string, string>} [sourceMap] - Optional map of filePath -> sourceText for snippet display
   */
  constructor(asts, sourceMap = new Map()) {
    this.files = Array.isArray(asts) ? asts : [asts];
    this.sourceMap = sourceMap;
    this.errors = [];

    // Symbol tables
    this.interfaces = new Map(); // name -> InterfaceNode
    this.namespaces = new Map(); // name -> NamespaceNode
    this.dictionaries = new Map(); // name -> DictionaryNode
    this.enums = new Map(); // name -> EnumNode
    this.typedefs = new Map(); // name -> TypedefNode
  }

  validate() {
    this.errors = [];
    this.collectSymbols();

    if (this.errors.length > 0) {
      return this.errors;
    }

    this.validateInheritance();
    this.validateDefinitions();

    return this.errors;
  }

  collectSymbols() {
    const getAttr = (node, name) => node?.attributes?.find(a => a.name === name)?.value;
    for (const file of this.files) {
      for (const def of file.definitions) {
        const name = def.name;
        const loc = def.loc;
        const prefix = getAttr(def, 'prefix');
        const symKey = (def.type === 'Namespace' && typeof prefix === 'string' && prefix) ? `${prefix}${name}` : name;

        if (this.isSymbolDeclared(name, def)) {
          this.addError(`Duplicate definition of symbol '${name}'`, loc);
          continue;
        }

        if (def.type === 'Interface') {
          this.interfaces.set(name, def);
        } else if (def.type === 'Namespace') {
          this.namespaces.set(symKey, def);
        } else if (def.type === 'Dictionary') {
          this.dictionaries.set(name, def);
        } else if (def.type === 'Enum') {
          this.enums.set(name, def);
        } else if (def.type === 'Typedef') {
          this.typedefs.set(name, def);
        }
      }
    }
  }

  isSymbolDeclared(name, def) {
    if (def && def.type === 'Namespace') {
      const prefix = def.attributes?.find(a => a.name === 'prefix')?.value;
      const symKey = typeof prefix === 'string' && prefix ? `${prefix}${name}` : name;
      return (
        this.interfaces.has(name) ||
        this.namespaces.has(symKey) ||
        this.dictionaries.has(name) ||
        this.enums.has(name) ||
        this.typedefs.has(name)
      );
    }
    return (
      this.interfaces.has(name) ||
      this.namespaces.has(name) ||
      this.namespaces.has(`bro.${name}`) ||
      this.dictionaries.has(name) ||
      this.enums.has(name) ||
      this.typedefs.has(name)
    );
  }

  validateInheritance() {
    // Check Interface inheritance
    for (const [name, iface] of this.interfaces.entries()) {
      if (iface.parent) {
        if (!this.interfaces.has(iface.parent)) {
          if (this.dictionaries.has(iface.parent)) {
            this.addError(`Interface '${name}' cannot inherit from dictionary '${iface.parent}'`, iface.loc);
          } else {
            this.addError(`Interface '${name}' inherits from unknown interface '${iface.parent}'`, iface.loc);
          }
          continue;
        }

        // Circular inheritance detection
        const visited = new Set([name]);
        let curr = iface.parent;
        while (curr) {
          if (visited.has(curr)) {
            this.addError(`Circular inheritance detected in interface '${name}' -> '${curr}'`, iface.loc);
            break;
          }
          visited.add(curr);
          const parentIface = this.interfaces.get(curr);
          curr = parentIface ? parentIface.parent : null;
        }
      }
    }

    // Check Dictionary inheritance
    for (const [name, dict] of this.dictionaries.entries()) {
      if (dict.parent) {
        if (!this.dictionaries.has(dict.parent)) {
          if (this.interfaces.has(dict.parent)) {
            this.addError(`Dictionary '${name}' cannot inherit from interface '${dict.parent}'`, dict.loc);
          } else {
            this.addError(`Dictionary '${name}' inherits from unknown dictionary '${dict.parent}'`, dict.loc);
          }
          continue;
        }

        // Circular inheritance detection
        const visited = new Set([name]);
        let curr = dict.parent;
        while (curr) {
          if (visited.has(curr)) {
            this.addError(`Circular inheritance detected in dictionary '${name}' -> '${curr}'`, dict.loc);
            break;
          }
          visited.add(curr);
          const parentDict = this.dictionaries.get(curr);
          curr = parentDict ? parentDict.parent : null;
        }
      }
    }
  }

  validateDefinitions() {
    for (const file of this.files) {
      for (const def of file.definitions) {
        this.validateExtendedAttributes(def, `${def.type.toLowerCase()} '${def.name}'`);
        for (const member of def.members || []) {
          const label = member.name
            ? `member '${member.name}' of ${def.type.toLowerCase()} '${def.name}'`
            : `a member of ${def.type.toLowerCase()} '${def.name}'`;
          this.validateExtendedAttributes(member, label);
        }
        if (def.type === 'Interface') {
          this.validateInterface(def);
        } else if (def.type === 'Namespace') {
          this.validateNamespace(def);
        } else if (def.type === 'Dictionary') {
          this.validateDictionary(def);
        } else if (def.type === 'Enum') {
          this.validateEnum(def);
        } else if (def.type === 'Typedef') {
          this.validateTypedef(def);
        }
      }
    }
  }

  // Extended attributes are free-form in the grammar; this is where an
  // unrecognised one stops being free-form. See KNOWN_EXTENDED_ATTRIBUTES.
  validateExtendedAttributes(node, where) {
    const attrs = node && node.attributes;
    if (!attrs || !attrs.length) return;
    for (const attr of attrs) {
      if (KNOWN_EXTENDED_ATTRIBUTES.has(attr.name)) continue;
      const suggestion = nearestAttribute(attr.name);
      this.addError(
        `Unknown extended attribute '${attr.name}' on ${where}` +
          (suggestion ? ` (did you mean '${suggestion}'?)` : '') +
          '. No emitter reads it, so it would be silently dropped.',
        attr.loc || (node.loc || null)
      );
    }
  }

  validateInterface(iface) {
    const memberNames = new Set();

    for (const member of iface.members) {
      if (member.type === 'ConstructorMember') {
        this.validateParameters(member.parameters, `constructor of '${iface.name}'`);
        continue;
      }

      if (memberNames.has(member.name)) {
        this.addError(`Duplicate member '${member.name}' in interface '${iface.name}'`, member.loc);
      }
      memberNames.add(member.name);

      if (member.type === 'ConstantMember') {
        this.validateType(member.dataType, member.loc);
        this.validateConstantValue(member.dataType, member.value, member.name, member.loc);
      } else if (member.type === 'AttributeMember') {
        this.validateType(member.dataType, member.loc);
      } else if (member.type === 'OperationMember') {
        this.validateType(member.returnType, member.loc);
        this.validateParameters(member.parameters, `operation '${member.name}' in interface '${iface.name}'`);
      }
    }
  }

  validateNamespace(ns) {
    const memberNames = new Set();

    for (const member of ns.members) {
      if (memberNames.has(member.name)) {
        this.addError(`Duplicate member '${member.name}' in namespace '${ns.name}'`, member.loc);
      }
      memberNames.add(member.name);

      if (member.type === 'ConstantMember') {
        this.validateType(member.dataType, member.loc);
        this.validateConstantValue(member.dataType, member.value, member.name, member.loc);
      } else if (member.type === 'AttributeMember') {
        this.validateType(member.dataType, member.loc);
      } else if (member.type === 'OperationMember') {
        this.validateType(member.returnType, member.loc);
        this.validateParameters(member.parameters, `operation '${member.name}' in namespace '${ns.name}'`);
      }
    }
  }

  validateDictionary(dict) {
    const memberNames = new Set();

    for (const member of dict.members) {
      if (memberNames.has(member.name)) {
        this.addError(`Duplicate field '${member.name}' in dictionary '${dict.name}'`, member.loc);
      }
      memberNames.add(member.name);

      this.validateType(member.dataType, member.loc);

      if (member.defaultValue !== undefined && member.defaultValue !== null) {
        this.validateDefaultValue(member.dataType, member.defaultValue, member.name, member.loc);
      }
    }
  }

  validateEnum(en) {
    const seenValues = new Set();
    for (const val of en.values) {
      if (seenValues.has(val.value)) {
        this.addError(`Duplicate enum value '${val.value}' in enum '${en.name}'`, val.loc);
      }
      seenValues.add(val.value);
    }
  }

  validateTypedef(td) {
    this.validateType(td.targetType, td.loc);
  }

  validateParameters(parameters, contextDesc) {
    let seenOptional = false;

    for (let i = 0; i < parameters.length; i++) {
      const param = parameters[i];
      this.validateExtendedAttributes(param, `parameter '${param.name}' of ${contextDesc}`);
      this.validateType(param.dataType, param.loc);

      if (param.variadic && i !== parameters.length - 1) {
        this.addError(`Variadic parameter '${param.name}' must be the last parameter in ${contextDesc}`, param.loc);
      }

      if (param.optional || param.defaultValue !== null) {
        seenOptional = true;
      } else if (seenOptional && !param.variadic) {
        this.addError(`Required parameter '${param.name}' cannot follow optional parameters in ${contextDesc}`, param.loc);
      }

      if (param.defaultValue !== null && param.defaultValue !== undefined) {
        this.validateDefaultValue(param.dataType, param.defaultValue, param.name, param.loc);
      }
    }
  }

  validateType(type, loc) {
    if (!type) return;

    if (type.isUnion) {
      for (const memberType of type.unionMembers) {
        this.validateType(memberType, loc);
      }
      return;
    }

    if (GENERIC_TYPES.has(type.name)) {
      if (!type.genericArgs || type.genericArgs.length === 0) {
        this.addError(`Generic type '${type.name}' requires type arguments`, loc);
      } else {
        for (const arg of type.genericArgs) {
          this.validateType(arg, loc);
        }
      }
      return;
    }

    if (BUILTIN_TYPES.has(type.name)) {
      return;
    }

    if (this.isSymbolDeclared(type.name)) {
      return;
    }

    this.addError(`Unknown type '${type.name}'`, loc);
  }

  validateConstantValue(dataType, value, name, loc) {
    const t = dataType.name;
    if (['short', 'unsigned short', 'long', 'unsigned long', 'long long', 'unsigned long long', 'float', 'double', 'unrestricted float', 'unrestricted double', 'number', 'byte', 'octet'].includes(t)) {
      if (typeof value !== 'number') {
        this.addError(`Constant '${name}' of type '${t}' must have a numeric initializer`, loc);
      }
    } else if (['boolean'].includes(t)) {
      if (typeof value !== 'boolean') {
        this.addError(`Constant '${name}' of type 'boolean' must have a boolean initializer`, loc);
      }
    } else if (['DOMString', 'ByteString', 'USVString', 'string'].includes(t)) {
      if (typeof value !== 'string') {
        this.addError(`Constant '${name}' of type '${t}' must have a string initializer`, loc);
      }
    }
  }

  validateDefaultValue(dataType, defaultValue, name, loc) {
    if (defaultValue === null || defaultValue === undefined) return;

    if (dataType.isUnion) {
      // In a union, as long as it matches at least one member type, it's valid
      return;
    }

    const t = dataType.name;
    if (dataType.isArray || t === 'sequence' || t === 'Array') {
      if (!Array.isArray(defaultValue)) {
        this.addError(`Default value for array parameter/field '${name}' must be an array literal (e.g. [])`, loc);
      }
      return;
    }

    if (['short', 'unsigned short', 'long', 'unsigned long', 'long long', 'unsigned long long', 'float', 'double', 'unrestricted float', 'unrestricted double', 'number', 'byte', 'octet'].includes(t)) {
      if (typeof defaultValue !== 'number') {
        this.addError(`Default value for '${name}' of type '${t}' must be a number, found ${JSON.stringify(defaultValue)}`, loc);
      }
    } else if (['boolean'].includes(t)) {
      if (typeof defaultValue !== 'boolean') {
        this.addError(`Default value for '${name}' of type 'boolean' must be true or false, found ${JSON.stringify(defaultValue)}`, loc);
      }
    } else if (['DOMString', 'ByteString', 'USVString', 'string'].includes(t)) {
      if (typeof defaultValue !== 'string') {
        this.addError(`Default value for '${name}' of type '${t}' must be a string literal, found ${JSON.stringify(defaultValue)}`, loc);
      }
    } else if (this.dictionaries.has(t) || t === 'object') {
      if (typeof defaultValue !== 'object' || Array.isArray(defaultValue)) {
        this.addError(`Default value for dictionary '${name}' must be an object literal (e.g. {})`, loc);
      }
    }
  }

  addError(msg, loc) {
    let snippet = '';
    if (loc && loc.file && this.sourceMap.has(loc.file)) {
      const src = this.sourceMap.get(loc.file);
      const lines = src.split('\n');
      if (loc.line > 0 && loc.line <= lines.length) {
        snippet = lines[loc.line - 1];
      }
    }
    this.errors.push(new ValidationError(msg, loc, snippet));
  }
}

/**
 * Validates a set of IDL AST files.
 * @param {Array<Object>|Object} asts
 * @param {Map<string, string>} [sourceMap]
 * @returns {Array<ValidationError>}
 */
export function validate(asts, sourceMap = new Map()) {
  const validator = new Validator(asts, sourceMap);
  return validator.validate();
}
