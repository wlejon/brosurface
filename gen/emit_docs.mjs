// gen/emit_docs.mjs - Generic AST-Driven Documentation Page Emitter for brosurface
// Consumes validated AST from schema/parser.mjs and emits out/docs/<name>-api.js
// Zero per-namespace hardcoded strings or conditionals.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tokenize } from '../schema/lexer.mjs';
import { parse } from '../schema/parser.mjs';

/**
 * Maps an IDL Type AST node to a standard JSDoc type annotation string.
 * @param {Object} typeNode
 * @returns {string}
 */
export function typeToDoc(typeNode) {
  if (!typeNode) return '*';

  if (typeNode.isUnion) {
    const memberTypes = typeNode.unionMembers.map(m => typeToDoc(m));
    const unionStr = memberTypes.join('|');
    return typeNode.nullable ? `(${unionStr}|null)` : `(${unionStr})`;
  }

  let docType = 'any';
  const name = typeNode.name;

  switch (name) {
    case 'void':
      docType = 'void';
      break;
    case 'undefined':
      docType = 'undefined';
      break;
    case 'any':
      docType = '*';
      break;
    case 'object':
      docType = 'Object';
      break;
    case 'Function':
      docType = 'Function';
      break;
    case 'boolean':
      docType = 'boolean';
      break;
    case 'byte':
    case 'octet':
    case 'short':
    case 'unsigned short':
    case 'long':
    case 'unsigned long':
    case 'long long':
    case 'unsigned long long':
    case 'float':
    case 'double':
    case 'unrestricted float':
    case 'unrestricted double':
    case 'number':
    case 'int':
    case 'uint':
    case 'int32':
    case 'uint32':
    case 'int64':
    case 'uint64':
    case 'float32':
    case 'float64':
      docType = 'number';
      break;
    case 'bigint':
      docType = 'bigint';
      break;
    case 'string':
    case 'DOMString':
    case 'ByteString':
    case 'USVString':
      docType = 'string';
      break;
    case 'ArrayBuffer':
    case 'ArrayBufferView':
    case 'Uint8Array':
    case 'Int8Array':
    case 'Uint16Array':
    case 'Int16Array':
    case 'Uint32Array':
    case 'Int32Array':
    case 'Float32Array':
    case 'Float64Array':
    case 'Uint8ClampedArray':
    case 'BigInt64Array':
    case 'BigUint64Array':
    case 'DataView':
      docType = name;
      break;
    case 'EventListener':
      docType = 'EventListener';
      break;
    case 'EventHandler':
      docType = 'EventHandler';
      break;
    case 'sequence':
    case 'Array':
      if (typeNode.genericArgs && typeNode.genericArgs.length > 0) {
        docType = `Array<${typeToDoc(typeNode.genericArgs[0])}>`;
      } else {
        docType = 'Array';
      }
      break;
    case 'Promise':
      if (typeNode.genericArgs && typeNode.genericArgs.length > 0) {
        docType = `Promise<${typeToDoc(typeNode.genericArgs[0])}>`;
      } else {
        docType = 'Promise';
      }
      break;
    case 'record':
      if (typeNode.genericArgs && typeNode.genericArgs.length >= 2) {
        docType = `Object<${typeToDoc(typeNode.genericArgs[0])}, ${typeToDoc(typeNode.genericArgs[1])}>`;
      } else {
        docType = 'Object';
      }
      break;
    default:
      docType = name;
      break;
  }

  if (typeNode.isArray) {
    docType = `Array<${docType}>`;
  }

  if (typeNode.nullable) {
    docType = `${docType}|null`;
  }

  return docType;
}

/**
 * Parses raw JSDoc doc comment to extract summary, @param, @returns, and other tags.
 * @param {string} rawDoc
 * @returns {{
 *   summary: string[],
 *   params: Map<string, string>,
 *   returns: string,
 *   examples: string[],
 *   tags: Array<{tag: string, content: string}>
 * }}
 */
export function parseDocTags(rawDoc) {
  const result = {
    summary: [],
    params: new Map(),
    returns: '',
    examples: [],
    tags: [],
  };

  if (!rawDoc) return result;

  const lines = rawDoc.split('\n');
  let currentTag = null;
  let currentTagText = '';

  const flushTag = () => {
    if (!currentTag) return;
    if (currentTag === 'param') {
      const match = currentTagText.match(/^(\{[^}]+\}\s+)?([A-Za-z0-9_$.]+)\s*[-—:]?\s*(.*)$/s);
      if (match) {
        const pName = match[2];
        const pDesc = (match[3] || '').trim();
        result.params.set(pName, pDesc);
      } else {
        const parts = currentTagText.split(/\s+/);
        if (parts.length > 0) {
          result.params.set(parts[0], parts.slice(1).join(' '));
        }
      }
    } else if (currentTag === 'returns' || currentTag === 'return') {
      const match = currentTagText.match(/^(\{[^}]+\}\s+)?(.*)$/s);
      result.returns = match ? (match[2] || '').trim() : currentTagText.trim();
    } else if (currentTag === 'example') {
      result.examples.push(currentTagText.trim());
    } else {
      result.tags.push({ tag: currentTag, content: currentTagText.trim() });
    }
    currentTag = null;
    currentTagText = '';
  };

  for (const line of lines) {
    const tagMatch = line.match(/^\s*@([a-zA-Z]+)\s*(.*)$/);
    if (tagMatch) {
      flushTag();
      currentTag = tagMatch[1];
      currentTagText = tagMatch[2];
    } else if (currentTag !== null) {
      currentTagText += (currentTagText ? '\n' : '') + line;
    } else {
      result.summary.push(line);
    }
  }

  flushTag();

  while (result.summary.length > 0 && result.summary[0].trim() === '') {
    result.summary.shift();
  }
  while (result.summary.length > 0 && result.summary[result.summary.length - 1].trim() === '') {
    result.summary.pop();
  }

  return result;
}

/**
 * Formats a generic JSDoc block for an operation, constructor, or member.
 * @param {string} rawDoc
 * @param {Array<Object>} [parameters=[]]
 * @param {Object} [returnType=null]
 * @param {Object} [options={}]
 * @returns {string}
 */
export function formatMemberDoc(rawDoc, parameters = [], returnType = null, options = {}) {
  const indent = options.indent || '';
  const parsed = parseDocTags(rawDoc);
  const lines = [];

  // Summary lines
  for (const s of parsed.summary) {
    lines.push(s);
  }

  // @param tags from AST parameters + parsed tags
  if (parameters.length > 0) {
    if (lines.length > 0 && parsed.summary.length > 0) {
      lines.push('');
    }
    for (const p of parameters) {
      const docTypeStr = typeToDoc(p.dataType);
      const isOptional = p.optional || p.defaultValue !== null;
      let pName = p.name;
      if (p.variadic) pName = `...${pName}`;
      if (isOptional && !p.variadic) {
        pName = p.defaultValue !== null ? `[${pName}=${JSON.stringify(p.defaultValue)}]` : `[${pName}]`;
      }
      const pDesc = parsed.params.get(p.name) || p.doc || '';
      lines.push(`@param {${docTypeStr}} ${pName}${pDesc ? ' - ' + pDesc : ''}`);
    }
  }

  // @returns tag
  if (returnType && returnType.name !== 'void' && returnType.name !== 'undefined') {
    const retTypeStr = typeToDoc(returnType);
    const retDesc = parsed.returns || '';
    lines.push(`@returns {${retTypeStr}}${retDesc ? ' ' + retDesc : ''}`);
  }

  // @readonly
  if (options.readonly) {
    lines.push(`@readonly`);
  }

  // @type
  if (options.type) {
    lines.push(`@type {${typeToDoc(options.type)}}`);
  }

  // Other tags
  for (const t of parsed.tags) {
    lines.push(`@${t.tag} ${t.content}`);
  }

  // @example tags
  for (const ex of parsed.examples) {
    lines.push(`@example\n${ex}`);
  }

  if (lines.length === 0) return '';

  const formatted = [`${indent}/**`];
  for (const line of lines) {
    if (line.trim() === '') {
      formatted.push(`${indent} *`);
    } else {
      const splitLines = line.split('\n');
      for (const sl of splitLines) {
        formatted.push(`${indent} * ${sl}`);
      }
    }
  }
  formatted.push(`${indent} */\n`);

  return formatted.join('\n');
}

/**
 * Formats top-level file header doc comment.
 * @param {string} headerDoc
 * @returns {string}
 */
export function formatHeaderDoc(headerDoc) {
  if (!headerDoc || !headerDoc.trim()) return '';
  const lines = headerDoc.split('\n');
  const formatted = ['/**'];
  for (const line of lines) {
    if (line.trim() === '') {
      formatted.push(' *');
    } else {
      formatted.push(` * ${line}`);
    }
  }
  formatted.push(' */\n\n');
  return formatted.join('\n');
}

/**
 * Emits complete documentation JavaScript content for an IDLFile AST.
 * Purely AST-driven with ZERO per-namespace conditionals.
 * @param {Object} fileAst
 * @returns {string}
 */
export function emitDocFile(fileAst) {
  const chunks = [];

  // 1. Header Documentation
  if (fileAst.headerDoc) {
    chunks.push(formatHeaderDoc(fileAst.headerDoc));
  }

  // Collect definition categories
  const typedefs = [];
  const enums = [];
  const dictionaries = [];
  const interfaces = [];
  const namespaces = [];

  for (const def of fileAst.definitions) {
    if (def.type === 'Typedef') typedefs.push(def);
    else if (def.type === 'Enum') enums.push(def);
    else if (def.type === 'Dictionary') dictionaries.push(def);
    else if (def.type === 'Interface') interfaces.push(def);
    else if (def.type === 'Namespace') namespaces.push(def);
  }

  // 2. Typedefs
  if (typedefs.length > 0) {
    chunks.push(`// ── Typedefs ─────────────────────────────────────────────────────────────────\n\n`);
    for (const td of typedefs) {
      chunks.push(formatMemberDoc(td.doc, [], null, { type: td.targetType }));
      chunks.push(`// typedef ${typeToDoc(td.targetType)} ${td.name};\n\n`);
    }
  }

  // 3. Enums
  if (enums.length > 0) {
    chunks.push(`// ── Enums ────────────────────────────────────────────────────────────────────\n\n`);
    for (const en of enums) {
      chunks.push(formatMemberDoc(en.doc));
      chunks.push(`const ${en.name} = {\n`);
      for (let i = 0; i < en.values.length; i++) {
        const v = en.values[i];
        const comma = i === en.values.length - 1 ? '' : ',';
        const docComment = v.doc ? `  // ${v.doc}\n` : '';
        chunks.push(`${docComment}  "${v.value}": "${v.value}"${comma}\n`);
      }
      chunks.push(`};\n\n`);
    }
  }

  // 4. Dictionaries
  if (dictionaries.length > 0) {
    chunks.push(`// ── Dictionaries ─────────────────────────────────────────────────────────────\n\n`);
    for (const dict of dictionaries) {
      const lines = [];
      const parsed = parseDocTags(dict.doc);
      for (const s of parsed.summary) lines.push(s);
      const parentStr = dict.parent ? ` extends ${dict.parent}` : '';
      lines.push(`@typedef {Object} ${dict.name}${parentStr}`);
      for (const m of dict.members) {
        const mTypeStr = typeToDoc(m.dataType);
        const mOpt = m.required ? m.name : `[${m.name}${m.defaultValue !== null ? '=' + JSON.stringify(m.defaultValue) : ''}]`;
        lines.push(`@property {${mTypeStr}} ${mOpt}${m.doc ? ' - ' + m.doc : ''}`);
      }
      chunks.push(`/**\n`);
      for (const l of lines) {
        chunks.push(l.trim() === '' ? ` *\n` : ` * ${l}\n`);
      }
      chunks.push(` */\n\n`);
    }
  }

  // 5. Interfaces (Classes)
  if (interfaces.length > 0) {
    chunks.push(`// ── Classes & Interfaces ─────────────────────────────────────────────────────\n\n`);
    for (const iface of interfaces) {
      if (iface.doc) {
        chunks.push(formatMemberDoc(iface.doc));
      }
      const parentStr = iface.parent ? ` extends ${iface.parent}` : '';
      chunks.push(`class ${iface.name}${parentStr} {\n\n`);

      // Constructors
      const constructors = iface.members.filter(m => m.type === 'ConstructorMember');
      for (const ctor of constructors) {
        chunks.push(formatMemberDoc(ctor.doc, ctor.parameters, null, { indent: '  ' }));
        const paramStr = ctor.parameters.map(p => (p.variadic ? '...' : '') + p.name).join(', ');
        chunks.push(`  constructor(${paramStr}) {}\n\n`);
      }

      // Constants
      const constants = iface.members.filter(m => m.type === 'ConstantMember');
      for (const c of constants) {
        chunks.push(formatMemberDoc(c.doc, [], null, { type: c.dataType, readonly: true, indent: '  ' }));
        chunks.push(`  static readonly ${c.name} = ${JSON.stringify(c.value)};\n\n`);
      }

      // Static Attributes
      const staticAttrs = iface.members.filter(m => m.type === 'AttributeMember' && m.isStatic);
      for (const a of staticAttrs) {
        chunks.push(formatMemberDoc(a.doc, [], null, { type: a.dataType, readonly: a.readonly, indent: '  ' }));
        chunks.push(`  static ${a.name};\n\n`);
      }

      // Static Operations
      const staticOps = iface.members.filter(m => m.type === 'OperationMember' && m.isStatic);
      for (const op of staticOps) {
        chunks.push(formatMemberDoc(op.doc, op.parameters, op.returnType, { indent: '  ' }));
        const paramStr = op.parameters.map(p => (p.variadic ? '...' : '') + p.name).join(', ');
        chunks.push(`  static ${op.name}(${paramStr}) {}\n\n`);
      }

      // Instance Attributes
      const instanceAttrs = iface.members.filter(m => m.type === 'AttributeMember' && !m.isStatic);
      for (const a of instanceAttrs) {
        chunks.push(formatMemberDoc(a.doc, [], null, { type: a.dataType, readonly: a.readonly, indent: '  ' }));
        chunks.push(`  ${a.name};\n\n`);
      }

      // Instance Operations
      const instanceOps = iface.members.filter(m => m.type === 'OperationMember' && !m.isStatic);
      for (const op of instanceOps) {
        chunks.push(formatMemberDoc(op.doc, op.parameters, op.returnType, { indent: '  ' }));
        const paramStr = op.parameters.map(p => (p.variadic ? '...' : '') + p.name).join(', ');
        chunks.push(`  ${op.name}(${paramStr}) {}\n\n`);
      }

      chunks.push(`}\n\n`);
    }
  }

  // 6. Namespaces
  if (namespaces.length > 0) {
    chunks.push(`// ── Namespaces ───────────────────────────────────────────────────────────────\n\n`);
    for (const ns of namespaces) {
      const prefixAttr = ns.attributes.find(a => a.name === 'prefix');
      const prefix = prefixAttr && typeof prefixAttr.value === 'string' ? prefixAttr.value : 'bro.';
      const fullName = `${prefix}${ns.name}`;

      if (ns.doc) {
        chunks.push(formatMemberDoc(ns.doc));
      }

      // Constants
      const constants = ns.members.filter(m => m.type === 'ConstantMember');
      for (const c of constants) {
        chunks.push(formatMemberDoc(c.doc, [], null, { type: c.dataType, readonly: true }));
        chunks.push(`${fullName}.${c.name} = ${JSON.stringify(c.value)};\n\n`);
      }

      // Attributes
      const attrs = ns.members.filter(m => m.type === 'AttributeMember');
      for (const a of attrs) {
        chunks.push(formatMemberDoc(a.doc, [], null, { type: a.dataType, readonly: a.readonly }));
        chunks.push(`${fullName}.${a.name};\n\n`);
      }

      // Operations
      const ops = ns.members.filter(m => m.type === 'OperationMember');
      for (const op of ops) {
        chunks.push(formatMemberDoc(op.doc, op.parameters, op.returnType));
        const paramStr = op.parameters.map(p => (p.variadic ? '...' : '') + p.name).join(', ');
        chunks.push(`${fullName}.${op.name} = function(${paramStr}) {};\n\n`);
      }
    }
  }

  return chunks.join('');
}

/**
 * Emits documentation page files for all IDL definitions in targetPath.
 * @param {string} [targetPath='idl/']
 * @param {string} [outDir='out/docs/']
 * @returns {Array<string>}
 */
export function runEmitDocs(targetPath = 'idl/', outDir = 'out/docs/') {
  console.log(`[brosurface Doc Page Emitter] Reading IDLs from: ${targetPath}`);

  if (!fs.existsSync(targetPath)) {
    console.error(`Target path does not exist: ${targetPath}`);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const idlFiles = fs.readdirSync(targetPath)
    .filter(f => f.endsWith('.idl'))
    .map(f => path.join(targetPath, f));

  const emittedFiles = [];

  for (const f of idlFiles) {
    const base = path.basename(f, '.idl');
    const rel = path.relative(process.cwd(), f).replace(/\\/g, '/');
    const src = fs.readFileSync(f, 'utf8');
    const tokens = tokenize(src, rel);
    const fileAst = parse(tokens, rel);

    const docContent = emitDocFile(fileAst);
    const outFileName = `${base}-api.js`;
    const outFilePath = path.join(outDir, outFileName);

    fs.writeFileSync(outFilePath, docContent, 'utf8');
    const lineCount = docContent.split('\n').length;
    console.log(`  ✅ Emitted ${outFilePath} (${lineCount} lines)`);
    emittedFiles.push(outFilePath);
  }

  console.log(`✅ Documentation page emitter completed: ${emittedFiles.length} doc file(s) written to ${outDir}`);
  return emittedFiles;
}

// CLI entry point
const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectExecution || (process.argv[1] && process.argv[1].endsWith('emit_docs.mjs'))) {
  const args = process.argv.slice(2);
  const idlDir = args[0] || 'idl/';
  const outDocsDir = args[1] || 'out/docs/';
  runEmitDocs(idlDir, outDocsDir);
}

