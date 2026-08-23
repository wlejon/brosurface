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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BRO_ROOT = process.env.BRO_ROOT || path.resolve(ROOT, '..', 'bro');

// Emitted TU -> where it lives in bro. Anything the sync tool deliberately
// skips (it keeps brokit's own files out of bro) is listed here too, so this
// report never invents drift for a file that is not synced.
const TARGETS = [
  { out: 'qjs', broDir: path.join('src', 'js') },
  { out: 'bronze_host', broDir: path.join('src', 'bronze_host') },
];
const NOT_SYNCED = new Set([
  'blob.cpp', 'noise.cpp', 'intl.cpp', 'vendor_globals.cpp', 'image_gpu.cpp',
]);

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
        if (NOT_SYNCED.has(file)) continue;
        const generated = read(path.join(dir, file));
        const inBro = read(path.join(BRO_ROOT, target.broDir, file));
        if (inBro === null) { absent.push(path.join(target.broDir, file)); continue; }
        if (inBro === generated) { identical++; continue; }
        const d = unifiedDiff(inBro, generated,
                              `bro/${target.broDir.replace(/\\/g, '/')}/${file}`,
                              `generated/${target.out}/${file}`);
        drifted.push({ file, broPath: `${target.broDir.replace(/\\/g, '/')}/${file}`, ...d });
      }
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }

  return { identical, absent, drifted };
}

export function runDrift({ showDiff = false, filter = null, quiet = false } = {}) {
  const result = collectDrift();
  if (!result) {
    console.error(`bro tree not found at ${BRO_ROOT} (set BRO_ROOT to override)`);
    return 2;
  }
  const { identical, absent, drifted } = result;

  if (quiet) return drifted.length ? 1 : 0;

  console.log('brosurface drift — bro vs. what a sync would write\n');
  console.log(`  bro tree:   ${BRO_ROOT}`);
  console.log(`  identical:  ${identical}`);
  console.log(`  drifted:    ${drifted.length}`);
  console.log(`  not in bro: ${absent.length}${absent.length ? ' (emitted but never synced)' : ''}`);

  if (drifted.length) {
    console.log('\nA sync would rewrite these. Fold the difference into the IDL first,');
    console.log('or confirm bro is simply behind:\n');
    const width = Math.max(...drifted.map(d => d.broPath.length));
    for (const d of [...drifted].sort((a, b) => b.changed - a.changed)) {
      console.log(`  ${String(d.changed).padStart(6)} lines  ${d.broPath.padEnd(width)}`);
    }
    if (showDiff) {
      for (const d of drifted) {
        if (filter && !d.file.includes(filter)) continue;
        console.log(`\n${'='.repeat(72)}\n${d.text}`);
      }
    } else {
      console.log('\n  (--diff to see them, --diff <name> for one)');
    }
  } else {
    console.log('\nNo drift: bro matches what the generator would write.');
  }

  return drifted.length ? 1 : 0;
}

const invokedDirectly = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const showDiff = args.includes('--diff');
  const quiet = args.includes('--quiet');
  const filter = showDiff ? (args[args.indexOf('--diff') + 1] || null) : null;
  process.exit(runDrift({ showDiff, filter: filter && !filter.startsWith('--') ? filter : null, quiet }));
}
