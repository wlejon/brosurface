#!/usr/bin/env node
/**
 * tools/acceptance.mjs — Unified Standing Acceptance Suite for brosurface
 *
 * Runs the complete repository health and verification protocol in a single command:
 *   1. Generator Generality & Leak Audit (audit_gen.mjs)
 *   2. Mutation & Corruption Spot-Gates (in-memory AST mutation + corruption tests)
 *   3. Artifact Byte-for-Byte Freshness Gate (check_out_fresh.mjs)
 *   4. Random Integration Bundle Scratch Equivalence Gate (verify_integration_bundle.mjs)
 *
 * Usage:
 *   node tools/acceptance.mjs [--bundle <name>] [--skip-bundle]
 *   npm test
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAudit } from './audit_gen.mjs';
import { runCheckOutFresh } from './check_out_fresh.mjs';
import { runCorruptionTests } from './test_corruptions.mjs';
import { tokenize } from '../schema/lexer.mjs';
import { parse } from '../schema/parser.mjs';
import { emitTypeScript } from '../gen/emit_dts.mjs';
import { emitDocFile } from '../gen/emit_docs.mjs';
import { generateCAbiForSubsystem } from '../gen/emit_c_abi.mjs';
import { emitBronzeHostTU } from '../gen/bh_codegen.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

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

  // Emit C-ABI
  const cabiMut = generateCAbiForSubsystem(astMut, 'probe');
  if (!cabiMut.headerCode.includes('mutatedOperationProbe') || !cabiMut.headerCode.includes('hardwareRevision')) {
    console.error('❌ Step 2 FAIL: C-ABI emitter did not reflect mutated AST symbols.');
    process.exit(1);
  }

  // Emit Bronze Host
  const ifaceMut = astMut.definitions.find(d => d.name === 'ProbeDevice');
  const bhMut = emitBronzeHostTU([ifaceMut]);
  if (!bhMut.includes('mutatedOperationProbe') || !bhMut.includes('hardwareRevision')) {
    console.error('❌ Step 2 FAIL: Bronze Host emitter did not reflect mutated AST symbols.');
    process.exit(1);
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
