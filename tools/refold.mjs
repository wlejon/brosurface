#!/usr/bin/env node
/**
 * tools/refold.mjs — pull bro's copy of a translation unit back into the IDL.
 *
 * drift.mjs finds files the generator can no longer reproduce. This is the
 * repair. It reads bro's TU, splits it at the seams the emitter composes it
 * from, and writes each piece back into the IDL attribute it came out of:
 *
 *     #if GUARD                      <- cpp_guard / gate
 *     // ...                         <- cpp_file_comment
 *     #include ...                   <- cpp_header + cpp_includes
 *     namespace bro::js {
 *       ...                          <- cpp_prologue
 *     void X::install(JSContext*) {
 *       ...                          <- install_body
 *     }
 *       ...                          <- cpp_epilogue
 *     }
 *
 * The declarative half of the IDL -- the operations and attributes that drive
 * the docs and the .d.ts -- is not touched.
 *
 * Why this exists: these blobs are verbatim C++ carried as escaped strings, and
 * a verbatim copy rots the moment someone edits the original. Five files had
 * rotted far enough that regenerating them deleted whole helper functions. The
 * answer is not to stop generating them; it is to make repair a command instead
 * of an afternoon, and to have drift.mjs fail loudly in the meantime.
 *
 * Usage:
 *   node tools/refold.mjs math_bindings.cpp diar_bindings.cpp
 *   node tools/refold.mjs --check math_bindings.cpp   # show the split, write nothing
 *
 * Always follow with `node tools/drift.mjs` -- the split is structural, not
 * semantic, and a TU the emitter shapes differently will still differ after a
 * refold. That is a signal to fix the emitter, not to hand the file to bro.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BRO_ROOT = process.env.BRO_ROOT || path.resolve(ROOT, '..', 'bro');

// --------------------------------------------------------------------------
// IDL attribute values are one-line escaped strings. Read and write them
// without disturbing anything else on the line.
// --------------------------------------------------------------------------

function decode(raw) {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== '\\') { out += raw[i]; continue; }
    const next = raw[++i];
    if (next === 'n') out += '\n';
    else if (next === 'r') out += '\r';
    else if (next === 't') out += '\t';
    else out += next;
  }
  return out;
}

function encode(value) {
  let out = '';
  for (const ch of value) {
    if (ch === '\\') out += '\\\\';
    else if (ch === '"') out += '\\"';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else out += ch;
  }
  return out;
}

/** Span of `name="..."` in `source`, honouring backslash escapes. */
function findAttr(source, name) {
  const key = `${name}="`;
  const at = source.indexOf(key);
  if (at === -1) return null;
  let i = at + key.length;
  for (; i < source.length; i++) {
    if (source[i] === '\\') { i++; continue; }
    if (source[i] === '"') break;
  }
  return { start: at, valueStart: at + key.length, valueEnd: i, end: i + 1 };
}

function readAttr(source, name) {
  const span = findAttr(source, name);
  return span ? decode(source.slice(span.valueStart, span.valueEnd)) : null;
}

/** Replace an attribute's value, or insert the attribute before `anchorName`. */
function writeAttr(source, name, value, anchorName) {
  const span = findAttr(source, name);
  if (span) {
    return source.slice(0, span.valueStart) + encode(value) + source.slice(span.valueEnd);
  }
  const anchor = findAttr(source, anchorName);
  if (!anchor) throw new Error(`no ${name} and no ${anchorName} to insert before`);
  const lineStart = source.lastIndexOf('\n', anchor.start) + 1;
  const indent = source.slice(lineStart, anchor.start);
  return source.slice(0, lineStart) +
         `${indent}${name}="${encode(value)}",\n` +
         source.slice(lineStart);
}

// --------------------------------------------------------------------------
// Split a hand-written TU at the emitter's seams.
// --------------------------------------------------------------------------

function trimBlankEdges(lines) {
  let a = 0;
  let b = lines.length;
  while (a < b && !lines[a].trim()) a++;
  while (b > a && !lines[b - 1].trim()) b--;
  return lines.slice(a, b);
}

function splitTU(source, { cppHeader, cppNamespace, installSignature }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  const guard = lines[i].startsWith('#if ') ? lines[i++].slice(4).trim() : null;

  while (i < lines.length && !lines[i].trim()) i++;
  const commentStart = i;
  while (i < lines.length && lines[i].startsWith('//')) i++;
  const fileComment = i > commentStart ? lines.slice(commentStart, i).join('\n') : null;

  const nsOpen = `namespace ${cppNamespace} {`;
  const includes = [];
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === nsOpen) break;
    if (!line) continue;
    // The emitter writes these itself; carrying them would duplicate them.
    if (line === `#include "${cppHeader}"`) continue;
    if (line === 'extern "C" {' || line === '}' || line === '#include "quickjs.h"') continue;
    includes.push(line);
  }
  if (i >= lines.length) throw new Error(`no \`${nsOpen}\` found`);
  i++;

  // A real signature wraps across lines once it has more than a JSContext* in
  // it, so match on everything up to the open paren and then run to the brace.
  const installOpen = installSignature.slice(0, installSignature.indexOf('(') + 1);
  const prologue = [];
  for (; i < lines.length; i++) {
    if (lines[i].startsWith(installOpen)) break;
    prologue.push(lines[i]);
  }
  if (i >= lines.length) throw new Error(`no \`${installOpen}\` found`);
  while (i < lines.length && !lines[i].trimEnd().endsWith('{')) i++;
  i++;

  const body = [];
  let depth = 1;
  for (; i < lines.length; i++) {
    if (lines[i] === '}') { depth--; if (depth === 0) break; }
    else if (/^\{/.test(lines[i])) depth++;
    body.push(lines[i]);
  }
  i++;

  // Not `startsWith(nsClose)`: hand-written files vary the spacing in this
  // comment, and matching it literally let one file's closing brace and its
  // `#endif` fall into the epilogue, where the emitter then wrote a second
  // pair after them. That compiles to a syntax error 800 lines from the cause.
  const nsClose = `} // namespace ${cppNamespace}`;
  const looksLikeClose = line => line.replace(/\s+/g, ' ').trimEnd() === nsClose;
  const epilogue = [];
  let sawClose = false;
  for (; i < lines.length; i++) {
    if (looksLikeClose(lines[i])) { sawClose = true; break; }
    epilogue.push(lines[i]);
  }
  if (!sawClose) throw new Error(`no \`${nsClose}\` found`);
  for (const line of epilogue) {
    if (/^#endif/.test(line) || /^\}\s*\/\/\s*namespace/.test(line)) {
      throw new Error('epilogue swallowed the namespace close or the guard; ' +
                      'the install function was probably not found where expected');
    }
  }

  const dedent = block => {
    const depths = block.filter(l => l.trim()).map(l => l.match(/^[ \t]*/)[0].length);
    const common = depths.length ? Math.min(...depths) : 0;
    return block.map(l => (l.trim() ? l.slice(common) : ''));
  };

  return {
    guard,
    fileComment,
    includes: includes.join('\n'),
    prologue: trimBlankEdges(prologue).join('\n'),
    installBody: dedent(trimBlankEdges(body)).join('\n'),
    epilogue: trimBlankEdges(epilogue).join('\n'),
  };
}

// --------------------------------------------------------------------------

function idlFileFor(tu) {
  for (const name of fs.readdirSync(path.join(ROOT, 'idl')).sort()) {
    if (!name.endsWith('.idl')) continue;
    const full = path.join(ROOT, 'idl', name);
    if (fs.readFileSync(full, 'utf8').includes(`cpp_file="${tu}"`)) return full;
  }
  return null;
}

function refold(tu, { check }) {
  const idlPath = idlFileFor(tu);
  if (!idlPath) { console.error(`  no IDL declares cpp_file="${tu}"`); return 1; }

  const broPath = path.join(BRO_ROOT, 'src', 'js', tu);
  if (!fs.existsSync(broPath)) { console.error(`  ${broPath} does not exist`); return 1; }

  let idl = fs.readFileSync(idlPath, 'utf8');
  const cppHeader = readAttr(idl, 'cpp_header');
  const cppNamespace = readAttr(idl, 'cpp_namespace') || 'bro::js';
  // No install_signature means the emitter derives one from cpp_install, so
  // derive the same one here rather than refusing.
  const cppInstall = readAttr(idl, 'cpp_install');
  const installSignature = readAttr(idl, 'install_signature') ||
                           readAttr(idl, 'install_fn') ||
                           (cppInstall ? `void ${cppInstall}(JSContext* ctx)` : null);
  if (!installSignature) {
    console.error(`  ${path.basename(idlPath)} has neither install_signature ` +
                  'nor cpp_install; refold cannot find the install function');
    return 1;
  }

  let split;
  try {
    split = splitTU(fs.readFileSync(broPath, 'utf8'),
                    { cppHeader, cppNamespace, installSignature });
  } catch (err) {
    console.error(`  cannot split ${tu}: ${err.message}`);
    return 1;
  }

  const count = s => (s ? s.split('\n').length : 0);
  console.log(`  ${tu} -> ${path.basename(idlPath)}`);
  console.log(`    file comment ${count(split.fileComment)}, includes ${count(split.includes)}, ` +
              `prologue ${count(split.prologue)}, install body ${count(split.installBody)}, ` +
              `epilogue ${count(split.epilogue)}`);
  if (check) return 0;

  if (split.fileComment) idl = writeAttr(idl, 'cpp_file_comment', split.fileComment, 'cpp_header');
  idl = writeAttr(idl, 'cpp_includes', split.includes, 'cpp_header');
  idl = writeAttr(idl, 'cpp_prologue', split.prologue, 'cpp_header');
  idl = writeAttr(idl, 'install_body', split.installBody, 'cpp_header');
  if (split.epilogue) idl = writeAttr(idl, 'cpp_epilogue', split.epilogue, 'cpp_header');
  fs.writeFileSync(idlPath, idl);
  return 0;
}

const args = process.argv.slice(2);
const check = args.includes('--check');
const files = args.filter(a => !a.startsWith('--'));
if (!files.length) {
  console.error('usage: node tools/refold.mjs [--check] <tu.cpp>...');
  process.exit(2);
}
console.log(check ? 'refold --check (writing nothing)\n' : 'refold\n');
let rc = 0;
for (const tu of files) rc |= refold(tu, { check });
console.log(check ? '' : '\nNow run: node tools/drift.mjs');
process.exit(rc);
