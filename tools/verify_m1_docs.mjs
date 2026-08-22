// tools/verify_m1_docs.mjs - Comprehensive Milestone 1 (M1) Verification Harness
// Runs all validation, generation, semantic diff, and mutation tests for WO-2 M1.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { tokenize } from '../schema/lexer.mjs';
import { parse } from '../schema/parser.mjs';
import { validate } from '../schema/validator.mjs';
import { runEmitDocs } from '../gen/emit_docs.mjs';
import { diffDocs } from './diff_docs.mjs';
import { runEmitDts } from '../gen/emit_dts.mjs';
import { runVerifyExamples } from './verify_examples.mjs';

function header(title) {
  console.log(`\n================================================================================`);
  console.log(` ${title}`);
  console.log(`================================================================================\n`);
}

function subheader(title) {
  console.log(`\n--------------------------------------------------------------------------------`);
  console.log(` ${title}`);
  console.log(`--------------------------------------------------------------------------------`);
}

export function runVerifyM1Docs() {
  header('Work Order 2 — Milestone 1 (M1) Verification Harness');
  const results = [];

  // ---------------------------------------------------------------------------
  // STEP 1: Check Deletion of Hardcoded Per-Namespace Doc Emitters
  // ---------------------------------------------------------------------------
  subheader('STEP 1: Anti-Transcription Check (Deleted Per-Namespace Modules)');
  const deletedFiles = ['gen/docs_noise.mjs', 'gen/docs_file_time.mjs'];
  let step1Passed = true;
  for (const df of deletedFiles) {
    if (fs.existsSync(df)) {
      console.error(`  ❌ FAIL: File ${df} still exists! Must be deleted.`);
      step1Passed = false;
    } else {
      console.log(`  ✅ PASS: ${df} is deleted.`);
    }
  }

  // Check genericness of gen/emit_docs.mjs
  const emitDocsSrc = fs.readFileSync('gen/emit_docs.mjs', 'utf8');
  const forbiddenPatterns = [
    /base\s*===\s*['"]noise['"]/,
    /base\s*===\s*['"]time['"]/,
    /base\s*===\s*['"]file['"]/,
    /base\s*===\s*['"]lm['"]/,
    /emitNoiseDoc/,
    /emitTimeDoc/,
    /emitFileDoc/,
  ];
  for (const pat of forbiddenPatterns) {
    if (pat.test(emitDocsSrc)) {
      console.error(`  ❌ FAIL: gen/emit_docs.mjs contains hardcoded conditional matching ${pat}!`);
      step1Passed = false;
    }
  }
  if (step1Passed) {
    console.log(`  ✅ PASS: gen/emit_docs.mjs is 100% generic with zero per-namespace conditionals.`);
  }
  results.push({ name: 'Anti-Transcription & Generic Emitter', passed: step1Passed });

  // ---------------------------------------------------------------------------
  // STEP 2: File Size Limits Check (< 1,000 LOC for code, < 2,000 absolute)
  // ---------------------------------------------------------------------------
  subheader('STEP 2: File Size Limits Enforcement (< 1,000 LOC)');
  let step2Passed = true;
  const dirsToCheck = ['gen', 'schema', 'idl', 'tools'];
  const allFiles = [];
  for (const d of dirsToCheck) {
    const entries = fs.readdirSync(d);
    for (const e of entries) {
      const full = path.join(d, e);
      if (fs.statSync(full).isFile() && (e.endsWith('.mjs') || e.endsWith('.idl') || e.endsWith('.js'))) {
        allFiles.push(full);
      }
    }
  }

  for (const file of allFiles) {
    const lineCount = fs.readFileSync(file, 'utf8').split('\n').length;
    if (lineCount > 1000) {
      console.error(`  ❌ FAIL: ${file} has ${lineCount} lines (exceeds 1,000 limit)`);
      step2Passed = false;
    } else {
      console.log(`  ✅ ${file.padEnd(30)}: ${lineCount.toString().padStart(4)} lines (< 1,000 OK)`);
    }
  }
  results.push({ name: 'File Size Limits Enforcement', passed: step2Passed });

  // ---------------------------------------------------------------------------
  // STEP 3: IDL Validation and Lossless Round-Trip
  // ---------------------------------------------------------------------------
  subheader('STEP 3: IDL Validation and Lossless Round-Trip');
  let step3Passed = true;
  try {
    const valOutput = execSync('node gen/validate.mjs idl/', { encoding: 'utf8' });
    console.log(valOutput.trim());
    step3Passed = valOutput.includes('All 4 IDL file(s) passed validation and lossless round-trip!');
  } catch (err) {
    console.error(`  ❌ Validation failed:`, err.message);
    step3Passed = false;
  }
  results.push({ name: 'IDL Validation & Round-Trip', passed: step3Passed });

  // ---------------------------------------------------------------------------
  // STEP 4: Doc Generation
  // ---------------------------------------------------------------------------
  subheader('STEP 4: AST-Driven Documentation Page Generation');
  let step4Passed = true;
  try {
    const emitted = runEmitDocs('idl/', 'out/docs/');
    console.log(`  Emitted files:`, emitted);
    const expectedDocs = ['noise-api.js', 'time-api.js', 'file-api.js', 'lm-api.js'];
    for (const ed of expectedDocs) {
      const full = path.join('out/docs/', ed);
      if (!fs.existsSync(full)) {
        console.error(`  ❌ FAIL: Missing expected doc file ${full}`);
        step4Passed = false;
      } else {
        const lines = fs.readFileSync(full, 'utf8').split('\n').length;
        console.log(`  ✅ ${ed.padEnd(20)}: ${lines.toString().padStart(4)} lines generated`);
      }
    }
  } catch (err) {
    console.error(`  ❌ Doc generation failed:`, err.message);
    step4Passed = false;
  }
  results.push({ name: 'Doc Page Generation', passed: step4Passed });

  // ---------------------------------------------------------------------------
  // STEP 5: Semantic Coverage Diff Tool
  // ---------------------------------------------------------------------------
  subheader('STEP 5: Semantic Coverage Diff Suite (tools/diff_docs.mjs)');
  let step5Passed = true;
  try {
    const diffRes = diffDocs('out/docs/', 'D:/projects/bro/docs/');
    step5Passed = diffRes.success;
  } catch (err) {
    console.error(`  ❌ Semantic diff check failed:`, err.message);
    step5Passed = false;
  }
  results.push({ name: 'Semantic Documentation Coverage (100%)', passed: step5Passed });

  // ---------------------------------------------------------------------------
  // STEP 6: TypeScript Definitions & Example Typechecking
  // ---------------------------------------------------------------------------
  subheader('STEP 6: DTS Generation and tsc --strict Typechecking of IDL Examples');
  let step6Passed = true;
  try {
    runEmitDts('idl/', 'out/bro.d.ts');
    const exRes = runVerifyExamples('idl/', 'out/');
    step6Passed = exRes.success;
  } catch (err) {
    console.error(`  ❌ DTS / Example typecheck failed:`, err.message);
    step6Passed = false;
  }
  results.push({ name: 'DTS Generation & Strict Typecheck', passed: step6Passed });

  // ---------------------------------------------------------------------------
  // STEP 7: Mutation Test — Additive Mutation
  // ---------------------------------------------------------------------------
  subheader('STEP 7: Doc Emitter Mutation Test — Additive Gate');
  let step7Passed = true;
  const originalNoiseIdl = fs.readFileSync('idl/noise.idl', 'utf8');

  try {
    // Mutate noise.idl by adding FastNoise.version()
    const mutatedNoiseIdl = originalNoiseIdl.replace(
      'interface FastNoise {',
      'interface FastNoise {\n  /**\n   * Return the engine FastNoise binding version string.\n   * @returns FastNoise version identifier\n   */\n  static DOMString version();'
    );
    fs.writeFileSync('idl/noise.idl', mutatedNoiseIdl, 'utf8');

    // Regenerate doc pages
    runEmitDocs('idl/', 'out/docs/');
    const mutatedDoc = fs.readFileSync('out/docs/noise-api.js', 'utf8');

    if (!mutatedDoc.includes('static version()')) {
      console.error(`  ❌ FAIL: Additive mutation 'static version()' did not appear in out/docs/noise-api.js!`);
      step7Passed = false;
    } else {
      console.log(`  ✅ PASS: Additive mutation appeared in out/docs/noise-api.js`);
      console.log(`     Snippet found:`);
      const lines = mutatedDoc.split('\n');
      const idx = lines.findIndex(l => l.includes('static version()'));
      for (let i = Math.max(0, idx - 4); i <= Math.min(lines.length - 1, idx + 2); i++) {
        console.log(`       | ${lines[i]}`);
      }
    }

    // Revert noise.idl
    fs.writeFileSync('idl/noise.idl', originalNoiseIdl, 'utf8');
    runEmitDocs('idl/', 'out/docs/');
    const revertedDoc = fs.readFileSync('out/docs/noise-api.js', 'utf8');

    if (revertedDoc.includes('static version()')) {
      console.error(`  ❌ FAIL: Mutation still present after reverting IDL!`);
      step7Passed = false;
    } else {
      console.log(`  ✅ PASS: Additive mutation successfully disappeared upon IDL revert.`);
    }
  } catch (err) {
    console.error(`  ❌ Additive mutation test error:`, err.message);
    step7Passed = false;
  } finally {
    fs.writeFileSync('idl/noise.idl', originalNoiseIdl, 'utf8');
    runEmitDocs('idl/', 'out/docs/');
  }
  results.push({ name: 'Additive Mutation Gate', passed: step7Passed });

  // ---------------------------------------------------------------------------
  // STEP 8: Mutation Test — Destructive Mutation
  // ---------------------------------------------------------------------------
  subheader('STEP 8: Doc Emitter Mutation Test — Destructive Gate');
  let step8Passed = true;

  try {
    // Mutate genSingle2D in noise.idl: rename param 'seed' to 'customSeed' and return type 'Float64Array'
    const mutatedNoiseIdl2 = originalNoiseIdl.replace(
      'unrestricted double genSingle2D(unrestricted double x, unrestricted double y, long seed);',
      'Float64Array genSingle2D(unrestricted double x, unrestricted double y, long customSeed);'
    );
    fs.writeFileSync('idl/noise.idl', mutatedNoiseIdl2, 'utf8');

    runEmitDocs('idl/', 'out/docs/');
    const mutatedDoc2 = fs.readFileSync('out/docs/noise-api.js', 'utf8');

    const hasCustomSeed = mutatedDoc2.includes('customSeed');
    const hasFloat64 = mutatedDoc2.includes('@returns {Float64Array}') || mutatedDoc2.includes('Float64Array');

    if (!hasCustomSeed || !hasFloat64) {
      console.error(`  ❌ FAIL: Destructive mutation (customSeed / Float64Array) not reflected in out/docs/noise-api.js!`);
      console.error(`     hasCustomSeed: ${hasCustomSeed}, hasFloat64: ${hasFloat64}`);
      step8Passed = false;
    } else {
      console.log(`  ✅ PASS: Destructive mutation reflected in out/docs/noise-api.js`);
      console.log(`     Snippet found:`);
      const lines = mutatedDoc2.split('\n');
      const idx = lines.findIndex(l => l.includes('genSingle2D'));
      for (let i = Math.max(0, idx - 5); i <= Math.min(lines.length - 1, idx + 2); i++) {
        console.log(`       | ${lines[i]}`);
      }
    }

    // Revert noise.idl
    fs.writeFileSync('idl/noise.idl', originalNoiseIdl, 'utf8');
    runEmitDocs('idl/', 'out/docs/');
    const revertedDoc2 = fs.readFileSync('out/docs/noise-api.js', 'utf8');

    if (revertedDoc2.includes('customSeed')) {
      console.error(`  ❌ FAIL: Destructive mutation still present after reverting IDL!`);
      step8Passed = false;
    } else {
      console.log(`  ✅ PASS: Destructive mutation cleanly reverted to original signature.`);
    }
  } catch (err) {
    console.error(`  ❌ Destructive mutation test error:`, err.message);
    step8Passed = false;
  } finally {
    fs.writeFileSync('idl/noise.idl', originalNoiseIdl, 'utf8');
    runEmitDocs('idl/', 'out/docs/');
  }
  results.push({ name: 'Destructive Mutation Gate', passed: step8Passed });

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  header('Milestone 1 (M1) Verification Summary');
  let allPassed = true;
  for (const r of results) {
    console.log(`  - ${r.name.padEnd(45)}: ${r.passed ? '✅ PASS' : '❌ FAIL'}`);
    if (!r.passed) allPassed = false;
  }
  console.log(`\nOVERALL M1 ACCEPTANCE STATUS: ${allPassed ? '✅ ALL ACCEPTANCE CRITERIA MET' : '❌ FAILED'}\n`);

  if (!allPassed) {
    process.exit(1);
  }
}

// CLI entry point
runVerifyM1Docs();
