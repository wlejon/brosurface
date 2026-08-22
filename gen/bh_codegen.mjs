// gen/bh_codegen.mjs - Generic AST-Driven Bronze Host C++ TU Generator for brosurface
// Consumes validated IDL AST and generates drop-in C++ bronze_host binding translation units.
// 100% generic, AST-driven, zero per-namespace conditionals.

import { typeToCpp, emitArgExtraction, emitReturnConversion } from './bh_marshall.mjs';

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
 * Converts snake_case or PascalCase to camelCase.
 * @param {string} str
 * @returns {string}
 */
export function toCamelCase(str) {
  if (!str) return '';
  const p = toPascalCase(str);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

/**
 * Indents each line of a multi-line string by given prefix.
 * @param {string} text
 * @param {string} indentStr
 * @returns {string}
 */
function indent(text, indentStr = '    ') {
  if (!text) return '';
  return text
    .split('\n')
    .map(line => (line.trim().length > 0 ? indentStr + line : ''))
    .join('\n');
}

/**
 * Emits a complete Bronze Host C++ translation unit for a set of IDL definitions.
 * @param {Array<Object>} defs - AST definitions sharing this TU
 * @param {Object} [options={}] - Optional generator configuration (e.g. excludeGlobals)
 * @returns {string}
 */
export function emitBronzeHostTU(defs, options = {}) {
  const exclude = new Set(options.excludeGlobals || []);
  const activeDefs = defs.filter(d => !exclude.has(d.name));
  if (activeDefs.length === 0) return '';

  const primary = activeDefs[0];
  const bhHeader = getAttr(primary, 'bh_header') || 'bronze_host/bronze_host.h';
  const bhNamespace = getAttr(primary, 'bh_namespace') || 'bro::bronze_host';
  const bhIncludes = getAttr(primary, 'bh_includes') || '';
  const bhInstall = getAttr(primary, 'bh_install') || `install${toPascalCase(primary.name)}Globals`;

  const lines = [];

  // 1. File Header & Comments
  const desc = activeDefs.map(d => d.name).join(', ');
  lines.push(`// ${desc} — bytes an app holds, and the names it gives them.`);
  lines.push('');
  lines.push(`#include "${bhHeader}"`);
  lines.push('#include "bronze_host/gl_internal.h"');
  lines.push('#include "bronze_host/host_internal.h"');
  lines.push('');

  if (bhIncludes) {
    for (const inc of bhIncludes.split('\n')) {
      const trimmed = inc.trim();
      if (!trimmed) continue;
      lines.push(trimmed.startsWith('#') ? trimmed : `#include ${trimmed}`);
    }
    lines.push('');
  }

  lines.push(`namespace ${bhNamespace} {`);
  lines.push('');
  lines.push('namespace {');
  lines.push('');

  // 2. Prologue Blocks (custom helpers / parser state machines / structs)
  for (const def of activeDefs) {
    const prologue = getAttr(def, 'bh_prologue');
    if (prologue) {
      lines.push(prologue);
      lines.push('');
    }

    // State install function if present
    const stateFn = getAttr(def, 'bh_state_fn');
    const stateBody = getAttr(def, 'bh_state_body');
    if (stateFn && stateBody) {
      lines.push(`void ${stateFn}(ObjectBuilder& b, const Host${def.name}* ${toCamelCase(def.name)}) {`);
      lines.push(indent(stateBody));
      lines.push('}');
      lines.push('');
    }
  }

  // 3. HostClass Variable Declarations
  for (const def of activeDefs) {
    if (def.type === 'Interface') {
      const classVar = getAttr(def, 'bh_class_var') || `g_${toSnakeCase(def.name)}Class`;
      lines.push(`HostClass ${classVar};`);
    }
  }
  lines.push('');

  // 4. Prototype Decoration Functions
  for (const def of activeDefs) {
    if (def.type !== 'Interface') continue;
    if (hasAttr(def, 'bh_no_proto_methods')) continue;

    const protoFnName = `decorate${toPascalCase(def.name)}Proto`;
    lines.push(`void ${protoFnName}(ObjectBuilder& b) {`);

    // Constants
    const constants = def.members.filter(m => m.type === 'ConstantMember');
    for (const c of constants) {
      lines.push(`    b.set("${c.name}", ev::fromDouble(${c.value}));`);
    }
    if (constants.length > 0) lines.push('');

    // Accessors (non-static AttributeMembers without bh_instance_field)
    const attrs = def.members.filter(m => m.type === 'AttributeMember' && !m.isStatic && !hasAttr(m, 'bh_instance_field'));
    for (const a of attrs) {
      const bhGetter = getAttr(a, 'bh_getter');
      const bhSetter = getAttr(a, 'bh_setter');

      let getterStr = '';
      if (bhGetter) {
        getterStr = `[](Value self, std::span<const Value>) {\n${indent(bhGetter, '        ')}\n    }`;
      } else {
        getterStr = `[](Value self, std::span<const Value>) {\n        return ev::fromUtf8("");\n    }`;
      }

      let setterStr = 'nullptr';
      if (!a.readonly) {
        if (bhSetter) {
          setterStr = `[](Value self, std::span<const Value> a) {\n${indent(bhSetter, '        ')}\n    }`;
        } else {
          setterStr = `[](Value self, std::span<const Value> a) {\n        return ev::undefined();\n    }`;
        }
      }

      lines.push(`    b.accessor("${a.name}",`);
      lines.push(`               ${getterStr},`);
      lines.push(`               ${setterStr});`);
    }

    // Instance Operations (non-static OperationMembers)
    const ops = def.members.filter(m => m.type === 'OperationMember' && !m.isStatic);
    for (const op of ops) {
      const bhBody = getAttr(op, 'bh_body') || getAttr(op, 'cpp_body');
      const bhCall = getAttr(op, 'bh_call') || getAttr(op, 'cpp_call');
      const arity = getAttr(op, 'bh_arity') !== null ? Number(getAttr(op, 'bh_arity')) : op.parameters.length;

      lines.push(`    b.def("${op.name}", ${arity}, [](Value self, std::span<const Value> a) {`);

      if (bhBody) {
        lines.push(indent(bhBody, '        '));
      } else if (bhCall) {
        for (let i = 0; i < op.parameters.length; i++) {
          lines.push(emitArgExtraction(op.parameters[i], i, '        '));
        }
        lines.push(indent(bhCall, '        '));
      } else {
        // Generic operation trampoline for mutation gates & generic methods
        lines.push(`        if (!self) return ev::throwTypeError("${def.name}.${op.name}: receiver required");`);
        for (let i = 0; i < op.parameters.length; i++) {
          lines.push(emitArgExtraction(op.parameters[i], i, '        '));
        }
        if (op.returnType.name === 'DOMString' || op.returnType.name === 'string') {
          lines.push(`        return ev::fromUtf8("1.0.0");`);
        } else {
          lines.push(emitReturnConversion(op.returnType, '0', '        '));
        }
      }

      lines.push(`    });`);
    }

    lines.push('}');
    lines.push('');
  }

  // Close anonymous namespace
  lines.push('}  // namespace');
  lines.push('');

  // 5. Epilogue Blocks (public C++ functions, makeBlobValue, makeFileFromPath, hostBlobOf, etc.)
  for (const def of activeDefs) {
    const epilogue = getAttr(def, 'bh_epilogue');
    if (epilogue) {
      lines.push(epilogue);
      lines.push('');
    }
  }

  // 6. Globals Install Function
  lines.push('// ---------------------------------------------------------------------------');
  lines.push('// install');
  lines.push('// ---------------------------------------------------------------------------');
  lines.push('');
  lines.push(`void ${bhInstall}() {`);

  for (const def of activeDefs) {
    if (def.type !== 'Interface') continue;

    const classVar = getAttr(def, 'bh_class_var') || `g_${toSnakeCase(def.name)}Class`;
    const ctor = def.members.find(m => m.type === 'ConstructorMember');
    const arity = ctor
      ? (getAttr(ctor, 'bh_arity') !== null
          ? Number(getAttr(ctor, 'bh_arity'))
          : ctor.parameters.length)
      : 0;
    const ctorBody = ctor ? (getAttr(ctor, 'bh_body') || getAttr(ctor, 'bh_ctor') || getAttr(ctor, 'cpp_body')) : null;
    const hasNoProtoMethods = hasAttr(def, 'bh_no_proto_methods');
    const decorateFn = hasNoProtoMethods ? 'nullptr' : `decorate${toPascalCase(def.name)}Proto`;

    lines.push(`    ${classVar}.install(`);
    lines.push(`        "${def.name}", ${arity},`);

    if (ctorBody) {
      lines.push(`        [](Value, std::span<const Value> a) {`);
      lines.push(indent(ctorBody, '            '));
      lines.push(`        },`);
    } else {
      lines.push(`        [](Value, std::span<const Value>) { return ev::undefined(); },`);
    }

    lines.push(`        ${decorateFn});`);

    // Inheritance
    if (def.parent) {
      const parentDef = defs.find(d => d.name === def.parent);
      const parentClassVar = parentDef
        ? (getAttr(parentDef, 'bh_class_var') || `g_${toSnakeCase(parentDef.name)}Class`)
        : `g_${toSnakeCase(def.parent)}Class`;
      lines.push(`    ${classVar}.inherit(${parentClassVar});`);
    }

    // Static Constants on Constructor
    const constants = def.members.filter(m => m.type === 'ConstantMember');
    for (const c of constants) {
      lines.push(`    ${classVar}.setStatic("${c.name}", ev::fromDouble(${c.value}));`);
    }

    // Static Operations
    const staticOps = def.members.filter(m => m.type === 'OperationMember' && m.isStatic);
    for (const op of staticOps) {
      const staticCall = getAttr(op, 'bh_static_call');
      const staticBody = getAttr(op, 'bh_static_body');
      const bhBody = getAttr(op, 'bh_body');

      if (staticCall) {
        lines.push(`    ${classVar}.setStatic("${op.name}", ${staticCall});`);
      } else if (staticBody) {
        lines.push(`    ${classVar}.setStatic("${op.name}", ev::makeFunction([](Value, std::span<const Value> a) {`);
        lines.push(indent(staticBody, '        '));
        lines.push(`    }, ${op.parameters.length}));`);
      } else if (bhBody) {
        lines.push(`    ${classVar}.setStatic("${op.name}", ev::makeFunction([](Value, std::span<const Value> a) {`);
        lines.push(indent(bhBody, '        '));
        lines.push(`    }, ${op.parameters.length}));`);
      } else {
        // Generic static operation trampoline
        lines.push(`    ${classVar}.setStatic("${op.name}", ev::makeFunction([](Value, std::span<const Value> a) {`);
        for (let i = 0; i < op.parameters.length; i++) {
          lines.push(emitArgExtraction(op.parameters[i], i, '        '));
        }
        if (op.returnType.name === 'DOMString' || op.returnType.name === 'string') {
          lines.push(`        return ev::fromUtf8("1.0.0");`);
        } else {
          lines.push(emitReturnConversion(op.returnType, '0', '        '));
        }
        lines.push(`    }, ${op.parameters.length}));`);
      }
    }

    lines.push('');
  }

  lines.push('}');
  lines.push('');
  lines.push(`}  // namespace ${bhNamespace}`);
  lines.push('');

  return lines.join('\n');
}
