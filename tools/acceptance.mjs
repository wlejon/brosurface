#!/usr/bin/env node
/**
 * tools/acceptance.mjs — Unified Standing Acceptance Suite for brosurface
 *
 * Runs the complete repository health and verification protocol in a single command:
 *   1. Generator Generality & Leak Audit (audit_gen.mjs)
 *   2. Mutation & Corruption Spot-Gates (in-memory AST mutation + corruption tests)
 *   3. Artifact Byte-for-Byte Freshness Gate (check_out_fresh.mjs)
 *
 * Usage:
 *   node tools/acceptance.mjs
 *   npm test
 */

import { runAudit } from './audit_gen.mjs';
import { runCheckOutFresh } from './check_out_fresh.mjs';
import { runCorruptionTests } from './test_corruptions.mjs';
import { tokenize } from '../schema/lexer.mjs';
import { parse } from '../schema/parser.mjs';
import { validate } from '../schema/validator.mjs';
import { emitTypeScript } from '../gen/emit_dts.mjs';
import { emitDocFile } from '../gen/emit_docs.mjs';
import { planNatives } from '../gen/natives_plan.mjs';
import { renderDeclHeader, renderRegisterCpp, renderWrapper, renderGlobals } from '../gen/emit_natives.mjs';

/** Parses one in-memory IDL as subsystem `probe` and plans its natives. */
function planProbe(src) {
  const rel = 'test_probe.idl';
  const fileAst = parse(tokenize(src, rel), rel);
  const valErrors = validate([fileAst], new Map([[rel, src]]));
  if (valErrors.length) throw new Error(`probe IDL invalid: ${valErrors[0]}`);
  return planNatives([{ fileAst, subsystem: 'probe', rel }], 'probe', ['probe']);
}

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

async function runAcceptanceSuite() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║        brosurface Standing Acceptance & Health Test Suite          ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();

  // ---------------------------------------------------------------------------
  // STEP 1: Generator Generality & Leak Audit
  // ---------------------------------------------------------------------------
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log(' STEP 1: Generator Generality & Integrity Audit');
  console.log('════════════════════════════════════════════════════════════════════════════════');
  const auditPassed = runAudit();
  if (!auditPassed) {
    console.error('❌ Step 1 FAIL: Generator audit failed with errors.');
    process.exit(1);
  }
  console.log('✅ Step 1 PASS: Generator audit succeeded (0 leaks, 0 violations).\n');

  // ---------------------------------------------------------------------------
  // STEP 2: Mutation & Corruption Spot-Gates
  // ---------------------------------------------------------------------------
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log(' STEP 2: Mutation & Corruption Spot-Gates');
  console.log('════════════════════════════════════════════════════════════════════════════════');
  
  // 2a. Corruption suite
  console.log('  [2a] Testing syntactic and semantic corruption diagnostics...');
  runCorruptionTests();
  console.log('  ✅ 2a PASS: Diagnostic corruption cases handled with actionable errors.\n');

  // 2b. Additive & Destructive In-Memory Mutation Spot-Gate
  console.log('  [2b] Testing in-memory AST additive & destructive mutations...');
  const testIdl = `
[custom_header="test_probe.h"]
interface ProbeDevice {
  attribute DOMString deviceId;
  DOMString ping(DOMString payload);
  void executeProbe(long timeoutMs, optional boolean force = false);
};
  `.trim();

  const mutatedIdl = `
[custom_header="test_probe.h"]
interface ProbeDevice {
  attribute DOMString deviceId;
  attribute long hardwareRevision;
  DOMString ping(DOMString payload);
  DOMString mutatedOperationProbe(DOMString probeNonce, optional long flags = 0);
  void executeProbe(long timeoutMs, optional boolean force = false);
};
  `.trim();

  const tokensBase = tokenize(testIdl, 'test_probe.idl');
  const astBase = parse(tokensBase, 'test_probe.idl');
  const tokensMut = tokenize(mutatedIdl, 'test_probe.idl');
  const astMut = parse(tokensMut, 'test_probe.idl');

  // Emit DTS
  const dtsBase = emitTypeScript([astBase]);
  const dtsMut = emitTypeScript([astMut]);
  if (!dtsMut.includes('hardwareRevision: number;') || !dtsMut.includes('mutatedOperationProbe(probeNonce: string, flags?: number): string;')) {
    console.error('❌ Step 2 FAIL: DTS emitter did not reflect mutated AST symbols.');
    process.exit(1);
  }

  // Emit Docs
  const docMut = emitDocFile(astMut);
  if (!docMut.includes('mutatedOperationProbe') || !docMut.includes('hardwareRevision')) {
    console.error('❌ Step 2 FAIL: Doc emitter did not reflect mutated AST symbols.');
    process.exit(1);
  }

  // Natives: prototypes, registrations, wrapper and globals all follow the AST,
  // through every shape the emitter carries (namespace getter/setter, typed-array
  // return, dictionary parameter with defaults, [json] result, [manual] member,
  // [strict] string member and parameter, class constructor/dtor/instance members).
  const nativesIdl = (extra) => `
dictionary ProbeConfig {
  long retries = 3;
  [strict] DOMString label;
  sequence<double> weights;
};
[json] dictionary ProbeReport {
  DOMString status;
  sequence<DOMString> tags;
};
[prefix="bro."]
namespace probe {
  attribute double gain;
  ProbeReport report();
  Float32Array sample(long count);
  void configure(optional ProbeConfig cfg);
  [manual] void openPanel(any what);
};
interface ProbeDevice {
  constructor(DOMString id);
  attribute DOMString deviceId;
  DOMString ping([strict] DOMString payload);
  void executeProbe(long timeoutMs, optional boolean force = false);
${extra}};
  `.trim();
  const planBase = planProbe(nativesIdl(''));
  const planMut = planProbe(nativesIdl('  attribute long hardwareRevision;\n  DOMString mutatedOperationProbe(DOMString probeNonce, optional long flags = 0);\n'));
  if (planBase.errors.length || planMut.errors.length) {
    fail(`Step 2 FAIL: natives planner refused a carried shape: ${(planBase.errors[0] || planMut.errors[0]).message}`);
  }
  const declMut = renderDeclHeader(planMut);
  const regMut = renderRegisterCpp(planMut);
  const jsMut = renderWrapper(planMut);
  const globalsMut = renderGlobals(planMut);
  const expectDecl = [
    'double bro_probe_gain_get(void);',
    'void bro_probe_gain_set(double v);',
    'const char* bro_probe_report(void);',
    'void bro_probe_sample(int32_t count, bronze_native_buffer* out);',
    'void bro_probe_configure(int32_t cfg_retries, bool cfg_label_given, const char* cfg_label, const double* cfg_weights, uint32_t cfg_weights_len);',
    'void* bro_probe_ProbeDevice_ctor(const char* id);',
    'void bro_probe_ProbeDevice_dtor(void* self);',
    'const char* bro_probe_ProbeDevice_deviceId_get(void* self);',
    'void bro_probe_ProbeDevice_deviceId_set(void* self, const char* v);',
    'const char* bro_probe_ProbeDevice_ping(void* self, const char* payload);',
    'void bro_probe_ProbeDevice_executeProbe(void* self, int32_t timeoutMs, bool force);',
    'int32_t bro_probe_ProbeDevice_hardwareRevision_get(void* self);',
    'const char* bro_probe_ProbeDevice_mutatedOperationProbe(void* self, const char* probeNonce, int32_t flags);',
  ];
  for (const line of expectDecl) {
    if (!declMut.includes(line)) fail(`Step 2 FAIL: natives decl header lacks prototype: ${line}`);
  }
  if (declMut.includes('bro_probe_openPanel')) fail('Step 2 FAIL: [manual] member grew a native prototype.');
  if (/"dynamic"/.test(regMut)) fail('Step 2 FAIL: register.cpp carries a dynamic where the IDL declared a shape.');
  const expectReg = [
    '"__bro_native.probe.gain"',
    '"__bro_native.probe.report"',
    '"__bro_native.probe.ProbeDevice"',
    '"__bro_native.probe.ProbeDevice_mutatedOperationProbe"',
    '"__bro_native.probe.ProbeDevice_hardwareRevision_get"',
    'registerNatives_probe',
  ];
  for (const s of expectReg) {
    if (!regMut.includes(s)) fail(`Step 2 FAIL: natives register.cpp lacks: ${s}`);
  }
  const expectJs = [
    'mutatedOperationProbe',
    'hardwareRevision',
    'JSON.parse(',                  // [json] result
    'd_cfg.retries === undefined ? 3', // dictionary default
    'toF64(',                       // sequence<double> -> Float64Array
    'bro.probe.openPanel',          // [manual] placeholder comment
    'new __bro_native.probe.ProbeDevice(',
    // [strict]: the wrapper refuses a non-string before the native lowering
    // can ToString-coerce it, for a dictionary member and for a parameter.
    `if (d_cfg.label !== undefined && typeof d_cfg.label !== 'string') throw new TypeError("bro.probe.configure: cfg.label must be a string");`,
    `if (payload !== undefined && typeof payload !== 'string') throw new TypeError("bro.probe.ProbeDevice.prototype.ping: payload must be a string");`,
  ];
  for (const s of expectJs) {
    if (!jsMut.includes(s)) fail(`Step 2 FAIL: natives wrapper lacks: ${s}`);
  }
  if (!globalsMut.includes('__bro_native') || !globalsMut.includes('bro')) fail('Step 2 FAIL: module.globals lacks the roots the wrapper reads.');
  // [strict] means a typeof check, which only a string has; on any other type
  // it is refused, not silently dropped.
  const strictMisuse = planProbe(nativesIdl('  void tune([strict] long gain);\n'));
  const misuse = strictMisuse.errors.find((e) => /tune.*\[strict\]/.test(e.message));
  if (!misuse || !misuse.line) fail('Step 2 FAIL: natives planner accepted [strict] on a non-string parameter.');

  // A shape the vocabulary cannot carry is refused with the IDL line and the
  // nearest spelling, never degraded to dynamic.
  const refused = planProbe(nativesIdl('  void inspect(any what);\n'));
  const refusal = refused.errors.find((e) => /inspect/.test(e.message));
  if (!refusal) fail('Step 2 FAIL: natives planner accepted `any` without [manual].');
  if (!/nearest expressible spelling/.test(refusal.message) || !refusal.line) {
    fail(`Step 2 FAIL: refusal lacks the IDL line or the nearest spelling: ${refusal.message}`);
  }

  console.log('  ✅ 2b PASS: All emitters dynamically respond to AST mutations (0 transcription).\n');

  // ---------------------------------------------------------------------------
  // STEP 3: Generator Output Freshness Check
  // ---------------------------------------------------------------------------
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log(' STEP 3: Generator Output Freshness Gate (Byte-for-Byte out/ Verification)');
  console.log('════════════════════════════════════════════════════════════════════════════════');
  const freshPassed = runCheckOutFresh();
  if (!freshPassed) {
    console.error('❌ Step 3 FAIL: Committed out/ tree has drifted from IDL sources.');
    process.exit(1);
  }
  console.log('✅ Step 3 PASS: Committed out/ tree is 100% fresh (0 drift across artifacts).\n');

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log(` 🎉 ALL ACCEPTANCE GATES PASSED SUCCESSFULLY (${elapsedSec}s)`);
  console.log('════════════════════════════════════════════════════════════════════════════════');
}

runAcceptanceSuite().catch(err => {
  console.error(`Unhandled exception during acceptance suite: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
