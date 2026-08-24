#!/usr/bin/env node
/**
 * tools/drift.mjs — what a sync would change in bro, before it changes it.
 *
 * check_out_fresh.mjs answers "does out/ match a fresh generation?". This
 * answers the question that actually bites: "does BRO match what a generation
 * would write?" Those are different, and the gap between them is where hand
 * fixes live.
 *
 * sync_to_bro.mjs copies emitted TUs straight over bro/src/js and
 * bro/src/bronze_host. Any repair made in bro and not folded back into the IDL
 * is reverted by the next sync, silently, in a commit that reads like a
 * routine regeneration. That is not hypothetical: a sync reverted the removal
 * of a broaudio header that no longer exists, and separately shipped seven
 * namespaces without their `#if BRO_WITH_SOUNDML` guard — both landed as red
 * CI on three platforms.
 *
 * So: regenerate to a temp dir, diff against bro, and report every file a sync
 * would rewrite. Drift is not automatically wrong — bro may simply be behind —
 * but it must be a decision, never a surprise.
 *
 * Usage:
 *   node tools/drift.mjs                  # table of drifted files
 *   node tools/drift.mjs --diff           # ...with the actual unified diffs
 *   node tools/drift.mjs --diff <name>    # ...for files matching <name>
 *   node tools/drift.mjs --lost [name]    # just the lines a sync would drop
 *   node tools/drift.mjs --quiet          # exit code only
 *
 * Exit code: 0 when bro matches what the generator would write, 1 when it
 * does not, so CI or a pre-sync hook can gate on it.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runEmitQjsbind } from '../gen/emit_qjsbind.mjs';
import { runEmitBronzeHost } from '../gen/emit_bronze_host.mjs';
import { ownerOf } from './ownership.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BRO_ROOT = process.env.BRO_ROOT || path.resolve(ROOT, '..', 'bro');

// Emitted TU -> where it lives in bro, and how it gets there.
//
// The two channels are delivered differently, and conflating them makes the
// report lie. sync_to_bro.mjs copies the QuickJS TUs straight over src/js, so
// drift there is what the next sync silently reverts. The bronze_host TUs
// reach bro as reviewed patch bundles (tools/make_bundles_m4.mjs), so drift
// there means a bundle's base no longer matches -- worth knowing, but not the
// same emergency, and not something a sync will do to you by surprise.
const TARGETS = [
  { out: 'qjs', broDir: path.join('src', 'js'), copied: true },
  { out: 'bronze_host', broDir: path.join('src', 'bronze_host'), copied: false },
];

// ---------------------------------------------------------------------------
// Is the drift lossy?
//
// "Different" is too blunt a verdict to act on. A regeneration that moves
// `cleanup()` below `install()`, re-indents a pasted block, or adds a blank
// line changes every line of a diff and changes nothing about the program. A
// regeneration that drops a namespace alias, a static helper, or a twenty-line
// file header deletes work.
//
// So compare content, not layout: reduce each side to a multiset of
// significant lines with whitespace normalised away, and ask what bro has that
// the generated file does not. Nothing missing means the sync is a reordering,
// and taking it is safe. Anything missing means the sync deletes it, and the
// IDL has to learn it first.
// ---------------------------------------------------------------------------

const INSIGNIFICANT = new Set(['', '{', '}', '};', ')', ');', '} else {']);

function significantLines(text) {
  const out = [];
  for (const raw of text.split('\n')) {
    // Brace style is layout, not content: `void f() {` and `void f()` followed
    // by a bare `{` are the same declaration, and the emitter does not always
    // choose the same one bro did.
    const line = raw.trim().replace(/\s+/g, ' ').replace(/ \{$/, '');
    if (INSIGNIFICANT.has(line)) continue;
    out.push(line);
  }
  return out;
}

function isComment(line) {
  return line.startsWith('//') || line.startsWith('/*') || line.startsWith('*');
}

/**
 * Lines bro has that a regeneration would not write back, split by kind:
 * losing a comment costs documentation, losing code costs the build.
 * @returns {{ code: string[], comment: string[] }}
 */
export function classifyLoss(broText, generatedText) {
  const have = new Map();
  for (const line of significantLines(generatedText)) {
    have.set(line, (have.get(line) || 0) + 1);
  }
  const code = [];
  const comment = [];
  for (const line of significantLines(broText)) {
    const n = have.get(line) || 0;
    if (n > 0) { have.set(line, n - 1); continue; }
    (isComment(line) ? comment : code).push(line);
  }
  return { code, comment };
}

function normalize(text) {
  return text.replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

function read(file) {
  try {
    return normalize(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Minimal unified diff — enough to read, not a patch format. */
function unifiedDiff(fromText, toText, fromLabel, toLabel, context = 3) {
  const a = fromText.split('\n');
  const b = toText.split('\n');

  // Longest common subsequence over lines, iterative to survive big files.
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1
                                : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push([' ', a[i]]); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { ops.push(['-', a[i]]); i++; }
    else { ops.push(['+', b[j]]); j++; }
  }
  while (i < n) ops.push(['-', a[i++]]);
  while (j < m) ops.push(['+', b[j++]]);

  const changed = ops.filter(o => o[0] !== ' ').length;
  if (!changed) return { changed: 0, text: '' };

  // Emit only windows around changes.
  const keep = new Array(ops.length).fill(false);
  ops.forEach((op, k) => {
    if (op[0] === ' ') return;
    for (let w = Math.max(0, k - context); w <= Math.min(ops.length - 1, k + context); w++) keep[w] = true;
  });

  const lines = [`--- ${fromLabel}`, `+++ ${toLabel}`];
  let gap = false;
  ops.forEach((op, k) => {
    if (!keep[k]) { gap = true; return; }
    if (gap) { lines.push('@@'); gap = false; }
    lines.push(op[0] + op[1]);
  });
  return { changed, text: lines.join('\n') };
}

/**
 * Regenerate and compare. Returns { identical, absent, drifted } where drifted
 * is [{ file, broPath, changed, text }], or null when there is no bro tree.
 * Exported so sync_to_bro.mjs can ask the same question before it writes.
 */
export function collectDrift() {
  if (!fs.existsSync(BRO_ROOT)) return null;

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'brosurface-drift-'));
  const drifted = [];
  const absent = [];
  let identical = 0;

  try {
    // The emitters narrate every file they write; that is the wrong report to
    // be reading here, so mute them for the duration of the generation.
    const say = console.log;
    console.log = () => {};
    try {
      runEmitQjsbind(path.join(ROOT, 'idl/'), path.join(temp, 'qjs/'));
      runEmitBronzeHost(path.join(ROOT, 'idl/'), path.join(temp, 'bronze_host/'));
    } finally {
      console.log = say;
    }

    for (const target of TARGETS) {
      const dir = path.join(temp, target.out);
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.cpp')).sort()) {
        const { owner, why } = ownerOf(target.out, file);
        if (owner === 'brokit') continue;
        const generated = read(path.join(dir, file));
        const inBro = read(path.join(BRO_ROOT, target.broDir, file));
        if (inBro === null) { absent.push(path.join(target.broDir, file)); continue; }
        if (inBro === generated) { identical++; continue; }
        const d = unifiedDiff(inBro, generated,
                              `bro/${target.broDir.replace(/\\/g, '/')}/${file}`,
                              `generated/${target.out}/${file}`);
        drifted.push({
          file,
          broPath: `${target.broDir.replace(/\\/g, '/')}/${file}`,
          channel: target.out,
          copied: target.copied,
          owner,
          why,
          loss: classifyLoss(inBro, generated),
          ...d,
        });
      }
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }

  return { identical, absent, drifted };
}

export function runDrift({ showDiff = false, showLost = false, filter = null, quiet = false } = {}) {
  const result = collectDrift();
  if (!result) {
    console.error(`bro tree not found at ${BRO_ROOT} (set BRO_ROOT to override)`);
    return 2;
  }
  const { identical, absent, drifted } = result;

  const lossy = d => d.loss.code.length || d.loss.comment.length;
  const byPath = (a, b) => a.broPath.localeCompare(b.broPath);

  // Three questions, three answers, in the order that decides what to do:
  //   1. a sync would overwrite this and the emitter can reproduce it;
  //   2. a sync would overwrite this and would delete work doing it;
  //   3. nobody is going to overwrite it -- bro owns it, or it arrives as
  //      a reviewed patch rather than a copy.
  const owned = drifted.filter(d => d.copied && d.owner === 'generator');
  const informational = drifted.filter(d => !(d.copied && d.owner === 'generator'));
  const blocking = owned.filter(lossy);
  const reformat = owned.filter(d => !lossy(d));

  if (quiet) return blocking.length ? 1 : 0;

  console.log('brosurface drift — bro vs. what a sync would write\n');
  console.log(`  bro tree:   ${BRO_ROOT}`);
  console.log(`  identical:  ${identical}`);
  console.log(`  drifted:    ${drifted.length}`);
  console.log(`  blocking:   ${blocking.length} (a sync would overwrite these and lose something)`);
  console.log(`  not in bro: ${absent.length}${absent.length ? ' (emitted but never synced)' : ''}`);


  if (drifted.length) {
    const width = Math.max(...drifted.map(d => d.broPath.length));

    if (reformat.length) {
      console.log(`\n  ${reformat.length} reordered / reformatted -- a sync writes the same program:\n`);
      for (const d of [...reformat].sort(byPath)) {
        console.log(`  ${d.broPath.padEnd(width)}  ${String(d.changed).padStart(4)} lines`);
      }
      console.log('\n  Safe to take: regenerate, or let the next sync write them.');
    }

    if (blocking.length) {
      console.log(`\n  ${blocking.length} LOSSY -- a sync would delete what bro has:\n`);
      for (const d of [...blocking].sort(byPath)) {
        const bits = [];
        if (d.loss.code.length) bits.push(`${d.loss.code.length} code`);
        if (d.loss.comment.length) bits.push(`${d.loss.comment.length} comment`);
        console.log(`  ${d.broPath.padEnd(width)}  ${bits.join(', ')}`);
      }
      console.log('\n  --lost <name> prints the lines. Fold them back with');
      console.log('      node tools/refold.mjs <name>');
      console.log('  or teach the emitter to write them.');
    }

    if (informational.length) {
      console.log(`\n  ${informational.length} not written by a sync:\n`);
      for (const d of [...informational].sort(byPath)) {
        const note = d.owner === 'bro'
          ? 'bro owns it'
          : 'reviewed patch bundle, not a copy';
        const bits = [];
        if (d.loss.code.length) bits.push(`${d.loss.code.length} code`);
        if (d.loss.comment.length) bits.push(`${d.loss.comment.length} comment`);
        const lost = bits.length ? ` (emitter would drop ${bits.join(', ')})` : '';
        console.log(`  ${d.broPath.padEnd(width)}  ${note}${lost}`);
      }
    }
    if (showLost) {
      for (const d of drifted) {
        if (filter && !d.file.includes(filter)) continue;
        if (!d.loss.code.length && !d.loss.comment.length) continue;
        console.log(`\n${'='.repeat(72)}\n${d.broPath} — ${d.loss.code.length} code, ${d.loss.comment.length} comment line(s) a sync would drop\n`);
        for (const l of d.loss.code) console.log(`  code    ${l}`);
        for (const l of d.loss.comment) console.log(`  comment ${l}`);
      }
    } else if (showDiff) {
      for (const d of drifted) {
        if (filter && !d.file.includes(filter)) continue;
        console.log(`\n${'='.repeat(72)}\n${d.text}`);
      }
    } else {
      console.log('\n  (--diff [name] for the diffs, --lost [name] for just the dropped lines)');
    }
  } else {
    console.log('\nNo drift: bro matches what the generator would write.');
  }

  return blocking.length ? 1 : 0;
}

const invokedDirectly = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const showDiff = args.includes('--diff');
  const showLost = args.includes('--lost');
  const quiet = args.includes('--quiet');
  const flag = showLost ? '--lost' : '--diff';
  const filter = (showDiff || showLost) ? (args[args.indexOf(flag) + 1] || null) : null;
  process.exit(runDrift({ showDiff, showLost, filter: filter && !filter.startsWith('--') ? filter : null, quiet }));
}
