// schema/native_types.mjs — the bronze native type vocabulary, and the map
// from IDL types onto it.
//
// bronze's registry (bronze/src/abi/bronze_native_type.h) is CLOSED: a native
// parameter or result is one of `void f64 i32 bool str dynamic`, a typed array
// `f32[] f64[] i32[] u8[] u16[] u32[] i8[] i16[]` crossing as a (T*, uint32_t)
// pair, or a registered class crossing as the void* its constructor returned.
// A typed-array RESULT is a void function with one trailing
// `bronze_native_buffer* out` parameter (bronze/src/abi/bronze_native_type.h).
//
// This module decides, for every IDL type in a natives surface, which of those
// it becomes and how the JavaScript wrapper converts on the way in and out —
// or refuses, with the IDL line and the nearest spelling the vocabulary CAN
// carry. Nothing here degrades to `dynamic`: the only `dynamic` is a callback,
// and it is a declared shape (`Function`), never a fallback.
//
// The shapes a resolution answers with:
//
//   scalar     f64 / i32 / bool / str                  one C parameter
//   array      a typed array (from a typed array, a numeric sequence, an
//              ArrayBuffer's bytes, or a view's bytes)  (T*, uint32_t) in;
//              bronze_native_buffer* out
//   handle     a registered class                      void*
//   callback   Function / EventListener / EventHandler dynamic (uint64_t)
//   json       a value that crosses as JSON in a str   const char*
//   dict       a dictionary, unpacked member by member (params) or read back
//              member by member (results); vec2/vec3/vec4/quat/color are
//              dictionaries with the dual object-or-array accept
//   seqDict    a sequence of dictionaries (result only): count + reads by index
//   seqHandle  a sequence of handles (result only): count + `_at(index)`
//   void       no result

import { ValidationError } from './validator.mjs';
import { serializeType } from './serializer.mjs';

/** The root every native lives under: `__bro_native.<subsystem>.<member>`. */
export const NATIVE_ROOT = '__bro_native';

export const SCALARS = {
  f64: { bronze: 'f64', c: 'double', zero: '0' },
  i32: { bronze: 'i32', c: 'int32_t', zero: '0' },
  bool: { bronze: 'bool', c: 'bool', zero: 'false' },
  str: { bronze: 'str', c: 'const char*', zero: "''" },
};

// Signed 32-bit and narrower integers are i32 (ToInt32 on the way in).
const I32_NAMES = new Set(['byte', 'octet', 'short', 'unsigned short', 'long', 'int', 'int32']);
// Everything that does not fit an int32 — unsigned 32-bit, 64-bit, and every
// floating type — is f64, which is what a JavaScript number is anyway.
const F64_NAMES = new Set([
  'unsigned long', 'uint', 'uint32', 'long long', 'unsigned long long', 'int64', 'uint64',
  'float', 'double', 'unrestricted float', 'unrestricted double', 'number', 'float32', 'float64',
]);
const STR_NAMES = new Set(['string', 'DOMString', 'ByteString', 'USVString']);
const CALLBACK_NAMES = new Set(['Function', 'EventListener', 'EventHandler']);

/** Element kinds: bronze spelling, C element type, and the JS constructor. */
export const ARRAY_KINDS = {
  f32: { bronze: 'f32[]', c: 'float', jsCtor: 'Float32Array' },
  f64: { bronze: 'f64[]', c: 'double', jsCtor: 'Float64Array' },
  i32: { bronze: 'i32[]', c: 'int32_t', jsCtor: 'Int32Array' },
  u8: { bronze: 'u8[]', c: 'uint8_t', jsCtor: 'Uint8Array' },
  u16: { bronze: 'u16[]', c: 'uint16_t', jsCtor: 'Uint16Array' },
  u32: { bronze: 'u32[]', c: 'uint32_t', jsCtor: 'Uint32Array' },
  i8: { bronze: 'i8[]', c: 'int8_t', jsCtor: 'Int8Array' },
  i16: { bronze: 'i16[]', c: 'int16_t', jsCtor: 'Int16Array' },
};

const TYPED_ARRAY_NAMES = {
  Float32Array: 'f32', Float64Array: 'f64', Int32Array: 'i32', Uint8Array: 'u8',
  Uint16Array: 'u16', Uint32Array: 'u32', Int8Array: 'i8', Int16Array: 'i16',
};

// The dual-accept vector vocabulary (SPEC.md §2): `{x, y, z}` or `[x, y, z]`
// on the way in, an object on the way out. Each is a dictionary of f64
// members with `dualAccept` set, so it unpacks and reads back like one.
const VEC_SHAPES = {
  vec2: ['x', 'y'],
  vec3: ['x', 'y', 'z'],
  vec4: ['x', 'y', 'z', 'w'],
  quat: ['x', 'y', 'z', 'w'],
  color: ['r', 'g', 'b', 'a'],
  Color8: ['r', 'g', 'b', 'a'],
};

// Geometry dictionaries over the vectors.
const GEOM_SHAPES = {
  AABB3: [['min', 'vec3'], ['max', 'vec3']],
  Sphere: [['center', 'vec3'], ['radius', 'unrestricted double']],
  Ray: [['origin', 'vec3'], ['dir', 'vec3']],
  Plane: [['normal', 'vec3'], ['distance', 'unrestricted double']],
  Capsule: [['a', 'vec3'], ['b', 'vec3'], ['radius', 'unrestricted double']],
};

// Spellings the vocabulary has no room for, each with the nearest one it has.
const REFUSED = {
  any: 'a dictionary that declares the shape, a [json] dictionary, `Function` for a callback, or [manual] on the operation',
  object: 'a dictionary that declares the shape, a [json] dictionary, or [manual] on the operation',
  Promise: 'a `Function onDone` callback member (async results are delivered, not returned), or [manual]',
  record: 'a [json] dictionary',
  bigint: 'unsigned long long (crosses as f64)',
  Uint8ClampedArray: 'Uint8Array',
  BigInt64Array: 'Float64Array',
  BigUint64Array: 'Float64Array',
  DataView: 'Uint8Array',
  Event: '[manual] (DOM objects are not natives)',
  Document: '[manual] (DOM objects are not natives)',
  Element: '[manual] (DOM objects are not natives)',
  Node: '[manual] (DOM objects are not natives)',
  AsyncHandle: 'an interface declared in a natives subsystem',
};

function synthDictionary(name, members, dualAccept) {
  return {
    type: 'Dictionary',
    name,
    parent: null,
    synthetic: true,
    dualAccept,
    members: members.map(([m, t]) => ({
      type: 'DictionaryMember', name: m, dataType: { type: 'Type', name: t, nullable: false, genericArgs: [], unionMembers: [], isUnion: false, isArray: false },
      defaultValue: null, required: true, attributes: [], doc: '',
    })),
    attributes: [],
  };
}

/**
 * The symbol tables a resolution needs: every interface with the subsystem
 * (IDL basename) it is declared in, every dictionary, enum and typedef, and
 * the set of subsystems that are natives surfaces (idl/natives.list).
 */
export function createNativeTypeContext(astEntries, nativeSubsystems) {
  const ctx = {
    interfaces: new Map(),
    dictionaries: new Map(),
    enums: new Map(),
    typedefs: new Map(),
    nativeSubsystems: new Set(nativeSubsystems),
  };
  for (const { fileAst, subsystem } of astEntries) {
    for (const def of fileAst.definitions) {
      if (def.type === 'Interface') ctx.interfaces.set(def.name, { def, subsystem });
      else if (def.type === 'Dictionary') ctx.dictionaries.set(def.name, def);
      else if (def.type === 'Enum') ctx.enums.set(def.name, def);
      else if (def.type === 'Typedef') ctx.typedefs.set(def.name, def);
    }
  }
  for (const [name, members] of Object.entries(VEC_SHAPES)) {
    ctx.dictionaries.set(name, synthDictionary(name, members.map((m) => [m, 'unrestricted double']), true));
  }
  for (const [name, members] of Object.entries(GEOM_SHAPES)) {
    ctx.dictionaries.set(name, synthDictionary(name, members, false));
  }
  return ctx;
}

/** The registered class path of an interface: `__bro_native.<subsystem>.<Name>`. */
export function classPathOf(subsystem, name) {
  return `${NATIVE_ROOT}.${subsystem}.${name}`;
}

export function hasAttr(node, name) {
  return Boolean(node && node.attributes && node.attributes.some((a) => a.name === name));
}

export function getAttr(node, name) {
  if (!node || !node.attributes) return null;
  const a = node.attributes.find((x) => x.name === name);
  return a ? a.value : null;
}

/** All members of a dictionary, parents first. */
export function dictionaryMembers(dict, ctx) {
  const chain = [];
  let cur = dict;
  const seen = new Set();
  while (cur && !seen.has(cur.name)) {
    seen.add(cur.name);
    chain.unshift(cur);
    cur = cur.parent ? ctx.dictionaries.get(cur.parent) : null;
  }
  return chain.flatMap((d) => d.members);
}

function refuse(loc, what, typeNode, nearest) {
  const spelled = serializeType(typeNode);
  return {
    error: new ValidationError(
      `${what}: type '${spelled}' cannot cross a bronze native call; nearest expressible spelling: ${nearest}`,
      loc
    ),
  };
}

function resolveTypedef(typeNode, ctx, depth) {
  let t = typeNode;
  let guard = depth;
  while (t && !t.isUnion && ctx.typedefs.has(t.name) && guard-- > 0) {
    const target = ctx.typedefs.get(t.name).targetType;
    t = { ...target, nullable: target.nullable || t.nullable };
  }
  return t;
}

function scalar(kind) {
  return { kind: 'scalar', ...SCALARS[kind], type: kind };
}

function array(elem, source, retAs) {
  return { kind: 'array', elem, source, retAs: retAs || 'typed', ...ARRAY_KINDS[elem] };
}

// Which typed-array kind a numeric element type maps to, or null.
function numericElementKind(t) {
  if (I32_NAMES.has(t.name)) return 'i32';
  if (F64_NAMES.has(t.name)) return 'f64';
  return null;
}

// True when a dictionary (and everything it reaches) can be carried as JSON:
// scalars, strings, booleans, enums, sequences of those, nested dictionaries
// of those. Typed arrays and handles cannot.
function jsonable(typeNode, ctx, depth = 8) {
  if (depth <= 0) return false;
  const t = resolveTypedef(typeNode, ctx, 8);
  if (!t) return false;
  if (t.isUnion) return false;
  if (t.isArray) return jsonable({ ...t, isArray: false }, ctx, depth - 1);
  if (t.name === 'sequence' || t.name === 'Array') {
    return t.genericArgs.length === 1 && jsonable(t.genericArgs[0], ctx, depth - 1);
  }
  if (I32_NAMES.has(t.name) || F64_NAMES.has(t.name) || STR_NAMES.has(t.name) || t.name === 'boolean') return true;
  if (ctx.enums.has(t.name)) return true;
  if (ctx.dictionaries.has(t.name)) {
    return dictionaryMembers(ctx.dictionaries.get(t.name), ctx).every((m) => jsonable(m.dataType, ctx, depth - 1));
  }
  return false;
}

function jsonShape(typeNode) {
  return { kind: 'json', jsonOf: serializeType(typeNode) };
}

/**
 * Resolves one IDL type in one position.
 *
 * @param {Object} typeNode
 * @param {'param'|'member'|'return'|'memberReturn'} position
 *   param: an operation parameter; member: a member of a dictionary parameter;
 *   return: an operation result; memberReturn: a member of a dictionary result.
 * @param {Object} ctx  createNativeTypeContext()
 * @param {Object} loc  the IDL location the error names
 * @param {string} what  "parameter 'x' of operation 'y'"
 * @returns {{shape: Object}|{error: ValidationError}}
 */
export function resolveShape(typeNode, position, ctx, loc, what) {
  const t = resolveTypedef(typeNode, ctx, 16);
  if (!t) return refuse(loc, what, typeNode, 'a declared type');
  const isParam = position === 'param' || position === 'member';
  const isReturn = !isParam;

  if (t.isUnion) {
    // A union is carried when every member is the same numeric array kind:
    // `(sequence<long> or Int32Array)` is one i32[] with two accepted spellings.
    const kinds = new Set();
    for (const m of t.unionMembers) {
      const r = resolveShape(m, position, ctx, loc, what);
      if (r.error || r.shape.kind !== 'array') {
        return refuse(loc, what, typeNode, 'one member type (a union crosses only when every member is the same numeric array kind), or [manual]');
      }
      kinds.add(r.shape.elem);
    }
    if (kinds.size !== 1) {
      return refuse(loc, what, typeNode, 'one array kind (the members differ), or [manual]');
    }
    const shape = array([...kinds][0], 'sequence', 'array');
    return finishNullable(shape, t, position, loc, what, typeNode);
  }

  if (t.isArray) {
    return resolveShape({ ...t, isArray: false, name: 'sequence', genericArgs: [{ ...t, isArray: false, nullable: false }] }, position, ctx, loc, what);
  }

  let shape = null;
  const name = t.name;

  if (name === 'void' || name === 'undefined') {
    if (isParam) return refuse(loc, what, typeNode, 'a value type');
    shape = { kind: 'void' };
  } else if (name === 'boolean') {
    shape = scalar('bool');
  } else if (I32_NAMES.has(name)) {
    shape = scalar('i32');
  } else if (F64_NAMES.has(name)) {
    shape = scalar('f64');
  } else if (STR_NAMES.has(name) || ctx.enums.has(name)) {
    shape = scalar('str');
  } else if (TYPED_ARRAY_NAMES[name]) {
    shape = array(TYPED_ARRAY_NAMES[name], 'typed', 'typed');
  } else if (name === 'mat4') {
    shape = array('f32', 'sequence', 'typed');
  } else if (name === 'ArrayBuffer') {
    shape = array('u8', 'bytes', 'buffer');
  } else if (name === 'ArrayBufferView') {
    if (isReturn) return refuse(loc, what, typeNode, 'Uint8Array (a result view has one element kind)');
    shape = array('u8', 'view', 'typed');
  } else if (CALLBACK_NAMES.has(name)) {
    if (isReturn) return refuse(loc, what, typeNode, 'a value type (a callback goes in, never out)');
    shape = { kind: 'callback' };
  } else if (name === 'sequence' || name === 'Array') {
    if (!t.genericArgs || t.genericArgs.length !== 1) return refuse(loc, what, typeNode, 'sequence<T>');
    const elem = resolveTypedef(t.genericArgs[0], ctx, 16);
    const numeric = elem && !elem.isUnion && !elem.isArray ? numericElementKind(elem) : null;
    if (numeric) {
      shape = array(numeric, 'sequence', 'array');
    } else if (elem && !elem.isUnion && !elem.isArray && ctx.interfaces.has(elem.name)) {
      if (isParam) {
        return refuse(loc, what, typeNode, `one ${elem.name} per call (a list of handles has no native spelling), or [manual]`);
      }
      if (position === 'memberReturn') {
        return refuse(loc, what, typeNode, 'a top-level result (a list of handles inside a dictionary result has no index to read by), or [manual]');
      }
      const cls = ctx.interfaces.get(elem.name);
      const err = checkClassReachable(cls, elem.name, ctx, loc, what, typeNode);
      if (err) return err;
      shape = { kind: 'seqHandle', className: elem.name, subsystem: cls.subsystem, path: classPathOf(cls.subsystem, elem.name) };
    } else if (elem && !elem.isUnion && !elem.isArray && ctx.dictionaries.has(elem.name) && position === 'return'
               && !hasAttr(ctx.dictionaries.get(elem.name), 'json')) {
      const dict = ctx.dictionaries.get(elem.name);
      const err = checkReadableDictionary(dict, ctx, loc, what, true);
      if (err) return err;
      shape = { kind: 'seqDict', dict };
    } else if (jsonable(typeNode, ctx)) {
      shape = jsonShape(typeNode);
    } else {
      return refuse(loc, what, typeNode, 'a sequence of numbers (a typed array), of strings, or of JSON-carryable dictionaries; or [manual]');
    }
  } else if (ctx.dictionaries.has(name)) {
    const dict = ctx.dictionaries.get(name);
    if (hasAttr(dict, 'json')) {
      if (!jsonable(typeNode, ctx)) {
        return refuse(loc, what, typeNode, `a dictionary whose members are all JSON-carryable ([json] dictionary '${name}' holds a typed array, handle or callback)`);
      }
      shape = jsonShape(typeNode);
    } else {
      const err = isParam
        ? checkUnpackableDictionary(dict, ctx, loc, what)
        : checkReadableDictionary(dict, ctx, loc, what, false);
      if (err) return err;
      shape = { kind: 'dict', dict, dualAccept: Boolean(dict.dualAccept) };
    }
  } else if (ctx.interfaces.has(name)) {
    const cls = ctx.interfaces.get(name);
    const err = checkClassReachable(cls, name, ctx, loc, what, typeNode);
    if (err) return err;
    shape = { kind: 'handle', className: name, subsystem: cls.subsystem, path: classPathOf(cls.subsystem, name) };
  } else if (REFUSED[name]) {
    return refuse(loc, what, typeNode, REFUSED[name]);
  } else {
    return refuse(loc, what, typeNode, 'a declared dictionary, enum, typedef or interface');
  }

  return finishNullable(shape, t, position, loc, what, typeNode);
}

function finishNullable(shape, t, position, loc, what, typeNode) {
  if (!t.nullable) return { shape };
  // null has a native spelling only for a result that is a handle (NULL) or a
  // dictionary read (the operation answers `bool` = present).
  if (position === 'return' && (shape.kind === 'handle' || shape.kind === 'dict')) {
    return { shape: { ...shape, nullable: true } };
  }
  const base = serializeType({ ...typeNode, nullable: false });
  return refuse(loc, what, typeNode, `${base} (only a result handle or a result dictionary may be nullable)`);
}

function checkClassReachable(cls, name, ctx, loc, what, typeNode) {
  if (!ctx.nativeSubsystems.has(cls.subsystem)) {
    return refuse(loc, what, typeNode,
      `an interface of a natives subsystem ('${name}' is declared in idl/${cls.subsystem}.idl, which idl/natives.list does not name), or [manual]`);
  }
  return null;
}

// A dictionary parameter unpacks when every member does. A [manual] member
// never crosses (the hand-written wrapper owns it), so its type is not asked.
function checkUnpackableDictionary(dict, ctx, loc, what, depth = 0) {
  if (depth > 6) return refuse(loc, what, { name: dict.name }, 'a shallower dictionary');
  for (const m of dictionaryMembers(dict, ctx)) {
    if (hasAttr(m, 'manual')) continue;
    const r = resolveShape(m.dataType, 'member', ctx, m.loc || loc, `member '${m.name}' of dictionary '${dict.name}' (${what})`);
    if (r.error) return r;
    if (r.shape.kind === 'handle' && !m.required && m.defaultValue === null) {
      return refuse(m.loc || loc, `member '${m.name}' of dictionary '${dict.name}' (${what})`, m.dataType,
        `required ${r.shape.className} (a missing handle is a TypeError at the call, so an optional handle has no absent spelling), or [manual]`);
    }
  }
  return null;
}

// A dictionary result reads back when every member has a read spelling.
function checkReadableDictionary(dict, ctx, loc, what, indexed, depth = 0) {
  if (depth > 6) return refuse(loc, what, { name: dict.name }, 'a shallower dictionary');
  for (const m of dictionaryMembers(dict, ctx)) {
    if (hasAttr(m, 'manual')) continue;
    const r = resolveShape(m.dataType, 'memberReturn', ctx, m.loc || loc, `member '${m.name}' of dictionary '${dict.name}' (${what})`);
    if (r.error) return r;
    if (r.shape.kind === 'callback') {
      return refuse(m.loc || loc, `member '${m.name}' of dictionary '${dict.name}' (${what})`, m.dataType, 'a value type');
    }
  }
  return null;
}

/**
 * Resolves an optional-ness: how an absent value crosses. Answers the rule
 * for a parameter or a dictionary member that is not required and has no
 * declared default:
 *   scalar / dict / vec  -> a leading `bool <name>_given` companion
 *   array                -> an empty array of the kind
 *   callback             -> undefined (dynamic)
 *   json                 -> "" (no JSON)
 *   handle               -> refused (a missing handle is a TypeError)
 */
export function absentRule(shape) {
  switch (shape.kind) {
    case 'scalar':
    case 'dict':
      return 'given';
    case 'array':
      return 'empty';
    case 'callback':
      return 'undefined';
    case 'json':
      return 'emptyString';
    default:
      return 'refused';
  }
}

/** The JS expression that reads a dual-accept vector component. */
export function vecMemberIndex(dict, memberName) {
  return dict.members.findIndex((m) => m.name === memberName);
}
