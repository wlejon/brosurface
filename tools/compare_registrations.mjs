#!/usr/bin/env node
/**
 * tools/compare_registrations.mjs — hand-written vs generated native registrations
 *
 * Extracts every embed::registerNative call (through bro's fn/getter/setter
 * helpers and the generated fn/getter/setter/ctor helpers) from
 *
 *   bro/src/bronze_host/native_<sub>.cpp          (hand-written)
 *   out/natives/<sub>/native_<sub>_register.cpp   (generated)
 *
 * and diffs them by path + kind + signature. Nothing in bro is touched.
 *
 * Usage:
 *   node tools/compare_registrations.mjs [--bro <dir>] [<subsystem>...]
 *   (default subsystems: every idl/natives.list entry that has a bro native_<sub>.cpp)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readNativesList } from '../gen/emit_natives.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

const CALL_RE = /\b(fn|getter|setter|ctor)\(\s*"([^"]+)"\s*,([\s\S]*?)\berror\s*\)/g;

/** Splits the tail of a registration call into its quoted strings and braces. */
function extractRegistrations(source) {
  const regs = new Map();
  let m;
  while ((m = CALL_RE.exec(source)) !== null) {
    const [, helper, jsPath, tail] = m;
    const braces = tail.match(/\{([^}]*)\}/);
    const params = braces ? [...braces[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
    const beforeBraces = braces ? tail.slice(0, braces.index) : tail;
    const strings = [...beforeBraces.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    let kind;
    let ret;
    if (helper === 'fn') { kind = 'Function'; ret = strings[strings.length - 1]; }
    else if (helper === 'getter') { kind = 'Getter'; ret = strings[strings.length - 1]; }
    else if (helper === 'setter') { kind = 'Setter'; ret = 'void'; params.unshift(strings[strings.length - 1]); }
    else { kind = 'Constructor'; ret = jsPath; }
    const key = `${jsPath}${kind === 'Getter' ? ' (get)' : kind === 'Setter' ? ' (set)' : ''}`;
    regs.set(key, { jsPath, kind, ret, params, sig: `${kind} ${ret}(${params.join(', ')})` });
  }
  return regs;
}

export function compareSubsystem(sub, broDir) {
  const broFile = path.join(broDir, 'src', 'bronze_host', `native_${sub}.cpp`);
  const genFile = path.join(ROOT, 'out', 'natives', sub, `native_${sub}_register.cpp`);
  if (!fs.existsSync(broFile)) return null;
  if (!fs.existsSync(genFile)) throw new Error(`no generated register.cpp for ${sub}; run node gen/emit_natives.mjs`);
  const hand = extractRegistrations(fs.readFileSync(broFile, 'utf8'));
  const gen = extractRegistrations(fs.readFileSync(genFile, 'utf8'));
  const onlyHand = [...hand.keys()].filter((k) => !gen.has(k));
  const onlyGen = [...gen.keys()].filter((k) => !hand.has(k));
  const differ = [...hand.keys()].filter((k) => gen.has(k) && gen.get(k).sig !== hand.get(k).sig);
  const same = [...hand.keys()].filter((k) => gen.has(k) && gen.get(k).sig === hand.get(k).sig);
  return { sub, broFile, genFile, hand, gen, onlyHand, onlyGen, differ, same };
}

function report(r) {
  console.log(`\n== ${r.sub}: ${r.hand.size} hand-written (${path.relative(ROOT, r.broFile).replace(/\\/g, '/')}), ${r.gen.size} generated ==`);
  console.log(`   identical: ${r.same.length}   differing signature: ${r.differ.length}   only hand-written: ${r.onlyHand.length}   only generated: ${r.onlyGen.length}`);
  for (const k of r.differ) {
    console.log(`  ~ ${k}`);
    console.log(`      hand: ${r.hand.get(k).sig}`);
    console.log(`      gen:  ${r.gen.get(k).sig}`);
  }
  for (const k of r.onlyHand) console.log(`  - ${k}    ${r.hand.get(k).sig}`);
  for (const k of r.onlyGen) console.log(`  + ${k}    ${r.gen.get(k).sig}`);
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirect) {
  const args = process.argv.slice(2);
  let broDir = path.resolve(ROOT, '..', 'bro');
  const subs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--bro') broDir = path.resolve(args[++i]);
    else subs.push(args[i]);
  }
  const list = subs.length ? subs : readNativesList(path.join(ROOT, 'idl'));
  let total = 0;
  for (const sub of list) {
    const r = compareSubsystem(sub, broDir);
    if (!r) { console.log(`\n== ${sub}: no hand-written native_${sub}.cpp in bro; skipped ==`); continue; }
    report(r);
    total += r.differ.length + r.onlyHand.length + r.onlyGen.length;
  }
  console.log(`\n${total} difference(s) in total.`);
}
