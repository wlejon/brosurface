#!/usr/bin/env node
/**
 * tools/compile_check.mjs — compiles every generated native_<sub>_register.cpp
 *
 * For each subsystem under out/natives/ this writes a stub-body TU defining
 * every prototype of native_<sub>_decl.h trivially, then compiles both TUs to
 * objects (no link) against bronze's headers:
 *
 *   <cxx> -std=c++20 -c -Wall -Wextra -Werror
 *         -I <bronze>/src -I out/natives/<sub> [-D<gate>=1 | -D<gate>=0]
 *
 * (or the cl spelling, /std:c++20 /c /W4 /WX /EHsc /permissive-, run inside a
 * cmd that sourced vcvars64.bat). A gated subsystem is compiled twice: with
 * its gate defined to 1 (everything registers) and to 0 (the no-op
 * registerNatives_<sub> only).
 *
 * Usage:
 *   node tools/compile_check.mjs [--bronze <dir>] [--cxx g++|clang++|cl] [--vcvars <bat>] [<subsystem>...]
 *
 * The default compiler is g++ (a MinGW g++ carries its own libstdc++; LLVM
 * clang 15 on this machine cannot parse the MSVC 14.44 STL).
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const OUT = path.join(ROOT, 'out', 'natives');

const PROTO_RE = /^([A-Za-z_][\w* ]*?)\s*\*?\s*(bro_\w+)\((.*)\);$/;

/** The stub-body TU for one decl header: every prototype, defined trivially. */
export function renderStubBodies(sub, declSource) {
  const out = [];
  out.push(`// stub_${sub}.cpp — every native of native_${sub}_decl.h with a trivial body,`);
  out.push('// so the generated register.cpp can be compiled and type-checked without bro.');
  out.push(`#include "native_${sub}_decl.h"`);
  out.push('');
  for (const line of declSource.split('\n')) {
    const m = line.match(PROTO_RE);
    if (!m) continue;
    const [, , name, params] = m;
    const retType = line.slice(0, line.indexOf(name)).trim();
    const paramList = params.trim() === 'void' ? '' : params;
    // Each parameter is named in the prototype; the stub mentions it once.
    const names = paramList ? paramList.split(',').map((p) => p.trim().match(/(\w+)$/)[1]) : [];
    const touch = names.map((n) => `(void)${n}; `).join('');
    let ret;
    if (retType === 'void') ret = '';
    else if (retType === 'void*') ret = 'return nullptr;';
    else if (retType === 'const char*') ret = 'return "";';
    else ret = 'return {};';
    out.push(`${retType} ${name}(${paramList}) { ${touch}${ret} }`);
  }
  out.push('');
  return out.join('\n');
}

function gateOf(registerSource) {
  const m = registerSource.match(/^#if (.+)$/m);
  return m ? m[1].trim() : null;
}

/** Splits `A && B` into its defined names. */
function gateMacros(gate) {
  return gate ? gate.split('&&').map((s) => s.trim()) : [];
}

const VCVARS_DEFAULT = 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Auxiliary\\Build\\vcvars64.bat';

/** One compile-to-object invocation, in the compiler's own flag dialect. */
function compileArgs(cxx, { includes, defs, tu, obj }) {
  if (path.basename(cxx).replace(/\.exe$/i, '') === 'cl') {
    return ['/nologo', '/std:c++20', '/c', '/W4', '/WX', '/EHsc', '/permissive-',
      ...includes.flatMap((i) => ['/I', i]), ...defs.map((d) => `/D${d}`), tu, `/Fo${obj}`];
  }
  return ['-std=c++20', '-c', '-Wall', '-Wextra', '-Werror',
    ...includes.flatMap((i) => ['-I', i]), ...defs.map((d) => `-D${d}`), tu, '-o', obj];
}

function compile(cxx, args, vcvars) {
  if (path.basename(cxx).replace(/\.exe$/i, '') === 'cl') {
    // cl needs the VS environment: run it inside one cmd.exe that sourced vcvars64.
    const q = (s) => (/[\s"]/.test(s) ? `"${s}"` : s);
    const line = `"call ${q(vcvars)} >nul && cl ${args.map(q).join(' ')}"`;
    const r = spawnSync('cmd.exe', ['/s', '/c', line], { encoding: 'utf8', windowsVerbatimArguments: true });
    return { ok: r.status === 0, output: (r.stdout || '') + (r.stderr || ''), cmd: `cl ${args.join(' ')}  (inside: call vcvars64.bat)` };
  }
  const r = spawnSync(cxx, args, { encoding: 'utf8' });
  return { ok: r.status === 0, output: (r.stdout || '') + (r.stderr || ''), cmd: `${cxx} ${args.join(' ')}` };
}

export function runCompileCheck({ bronzeDir, cxx, subsystems, workDir, vcvars = VCVARS_DEFAULT }) {
  fs.mkdirSync(workDir, { recursive: true });
  const results = [];
  for (const sub of subsystems) {
    const dir = path.join(OUT, sub);
    const decl = fs.readFileSync(path.join(dir, `native_${sub}_decl.h`), 'utf8');
    const reg = path.join(dir, `native_${sub}_register.cpp`);
    const gate = gateOf(fs.readFileSync(reg, 'utf8'));
    const stub = path.join(workDir, `stub_${sub}.cpp`);
    fs.writeFileSync(stub, renderStubBodies(sub, decl), 'utf8');
    const passes = gate
      ? [{ label: `${gate}=1`, defs: gateMacros(gate).map((g) => `${g}=1`) },
         { label: `${gate}=0`, defs: gateMacros(gate).map((g) => `${g}=0`) }]
      : [{ label: 'ungated', defs: [] }];
    for (const pass of passes) {
      for (const tu of [stub, reg]) {
        const obj = path.join(workDir, `${path.basename(tu, '.cpp')}_${pass.label.replace(/[^\w]+/g, '_')}.o`);
        const args = compileArgs(cxx, { includes: [path.join(bronzeDir, 'src'), dir], defs: pass.defs, tu, obj });
        const r = compile(cxx, args, vcvars);
        results.push({ sub, pass: pass.label, tu: path.relative(ROOT, tu).replace(/\\/g, '/'), ...r });
        const status = r.ok ? 'OK  ' : 'FAIL';
        console.log(`[${status}] ${sub} (${pass.label}) ${path.basename(tu)}`);
        if (!r.ok) console.log(r.output);
      }
    }
  }
  return results;
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirect) {
  const args = process.argv.slice(2);
  let bronzeDir = path.resolve(ROOT, '..', 'bronze');
  let cxx = 'g++';
  let vcvars = VCVARS_DEFAULT;
  const subs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--bronze') bronzeDir = path.resolve(args[++i]);
    else if (args[i] === '--cxx') cxx = args[++i];
    else if (args[i] === '--vcvars') vcvars = args[++i];
    else subs.push(args[i]);
  }
  const list = subs.length ? subs
    : fs.readdirSync(OUT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const workDir = path.join(ROOT, 'out_compile_check');
  const results = runCompileCheck({ bronzeDir, cxx, subsystems: list, workDir, vcvars });
  const failed = results.filter((r) => !r.ok);
  console.log(`\ncommand shape: ${results[0] ? results[0].cmd : '(none)'}`);
  console.log(`${results.length - failed.length}/${results.length} translation unit(s) compiled clean.`);
  fs.rmSync(workDir, { recursive: true, force: true });
  process.exit(failed.length ? 1 : 0);
}
