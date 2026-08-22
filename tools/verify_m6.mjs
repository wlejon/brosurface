// tools/verify_m6.mjs - Milestone 6 Verification Tool
// Tests IDL validation, availability-stub emission, and standalone compilation with the gate off.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { runValidation } from '../gen/validate.mjs';
import { runEmitStubs } from '../gen/emit_stubs.mjs';

const BRO_DIR = path.resolve('D:/projects/bro');
const STUB_OUT = path.resolve('out/stubs/feature_stubs.cpp');

function run(cmd, cwd = process.cwd(), options = {}) {
  console.log(`[EXEC] ${cmd}`);
  try {
    const stdout = execSync(cmd, {
      cwd,
      encoding: 'utf8',
      stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...options.env },
      windowsHide: true,
      maxBuffer: 50 * 1024 * 1024,
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      status: err.status || 1,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : err.message,
    };
  }
}

export async function runVerifyM6() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║        brosurface Milestone 6 (M6) Availability Stub Verifier       ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  // Step 1: Validate IDLs
  console.log('[Step 1] Validating all IDL declarations (including idl/lm.idl)...');
  const valResult = runValidation('idl/');
  if (!valResult.success) {
    console.error('❌ IDL validation failed.');
    process.exit(1);
  }
  console.log('  ✅ IDL validation & round-trip verification passed.\n');

  // Step 2: Emit availability stubs
  console.log('[Step 2] Emitting availability stubs to out/stubs/feature_stubs.cpp...');
  const emitResult = runEmitStubs('idl/', 'out/stubs/feature_stubs.cpp');
  if (!emitResult.success) {
    console.error('❌ Stub emission failed.');
    process.exit(1);
  }
  console.log(`  ✅ Emitted ${emitResult.stubCount} stub block(s): [${emitResult.gatedSymbols.join(', ')}]\n`);

  // Step 3: Standalone C++ Compilation Check (Gate OFF: BRO_WITH_LM=0)
  console.log('[Step 3] Compiling generated stub TU with BRO_WITH_LM=0 (Gate OFF)...');
  console.log('  Testing strict syntax check under g++ -std=gnu++20 -Wall -Wextra -Werror...');

  const wslBroSrc = '/mnt/d/projects/bro/src';
  const wslQuickJs = '/mnt/d/projects/bro/third_party/quickjs';
  const wslStubFile = '/mnt/d/projects/brosurface/out/stubs/feature_stubs.cpp';

  const compileCheck = run(
    `bash -c "g++ -fsyntax-only -std=gnu++20 -Wall -Wextra -Werror -I ${wslBroSrc} -I ${wslQuickJs} -DBRO_WITH_LM=0 ${wslStubFile}"`
  );

  if (compileCheck.status !== 0) {
    console.error(`❌ Standalone compilation failed:\n${compileCheck.stderr}`);
    process.exit(1);
  }
  console.log('  ✅ Generated stub compiled standalone with ZERO warnings/errors!\n');

  // Step 4: Standalone Runtime Verification Harness
  console.log('[Step 4] Building & executing standalone QuickJS runtime test harness...');

  const harnessFile = path.resolve('out/stubs/test_m6_harness.cpp');
  const harnessSrc = `#include "js/feature_stub.h"
#include "js/lm_bindings.h"
#include <cassert>
#include <iostream>
#include <string>

// Include the generated stub TU directly
#include "feature_stubs.cpp"

int main() {
    std::cout << "[Test Harness] Initializing QuickJS runtime and context..." << std::endl;
    JSRuntime* rt = JS_NewRuntime();
    assert(rt != nullptr);
    JSContext* ctx = JS_NewContext(rt);
    assert(ctx != nullptr);

    std::cout << "[Test Harness] Installing generated lm stub bindings (BRO_WITH_LM=0)..." << std::endl;
    bro::js::installLmBindings(ctx);

    // Test 1: Feature detection property
    std::cout << "[Test Harness] Checking bro.lm.available property..." << std::endl;
    JSValue r1 = JS_Eval(ctx, "bro.lm.available === false", 26, "<test>", JS_EVAL_TYPE_GLOBAL);
    int isAvailFalse = JS_ToBool(ctx, r1);
    JS_FreeValue(ctx, r1);
    assert(isAvailFalse == 1);
    std::cout << "  ✅ PASS: bro.lm.available === false" << std::endl;

    // Test 2: Calling methods on stub throws clear "compiled without BRO_WITH_LM" error
    std::cout << "[Test Harness] Testing calling methods on stub proxy..." << std::endl;
    JSValue r2 = JS_Eval(ctx, "try { bro.lm.loadQwen(); false; } catch (e) { e.message; }", 57, "<test>", JS_EVAL_TYPE_GLOBAL);
    const char* errStr = JS_ToCString(ctx, r2);
    std::string errMsg = errStr ? errStr : "";
    JS_FreeCString(ctx, errStr);
    JS_FreeValue(ctx, r2);

    std::cout << "  Received exception: \\"" << errMsg << "\\"" << std::endl;
    assert(errMsg == "bro.lm is unavailable: this build was compiled without BRO_WITH_LM");
    std::cout << "  ✅ PASS: Caught expected unavailable exception on bro.lm.loadQwen()" << std::endl;

    // Test 3: Calling generate on stub throws same clear error
    JSValue r3 = JS_Eval(ctx, "try { bro.lm.generate(); false; } catch (e) { e.message; }", 57, "<test>", JS_EVAL_TYPE_GLOBAL);
    const char* errStr2 = JS_ToCString(ctx, r3);
    std::string errMsg2 = errStr2 ? errStr2 : "";
    JS_FreeCString(ctx, errStr2);
    JS_FreeValue(ctx, r3);
    assert(errMsg2 == "bro.lm is unavailable: this build was compiled without BRO_WITH_LM");
    std::cout << "  ✅ PASS: Caught expected unavailable exception on bro.lm.generate()" << std::endl;

    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);
    std::cout << "[Test Harness] Teardown clean." << std::endl;
    return 0;
}
`;

  fs.writeFileSync(harnessFile, harnessSrc, 'utf8');

  const wslHarnessFile = '/mnt/d/projects/brosurface/out/stubs/test_m6_harness.cpp';
  const harnessBin = '/tmp/test_m6_harness';

  const buildHarnessCmd = `bash -c "cd /tmp && gcc -c -O2 -I ${wslQuickJs} -DCONFIG_VERSION=\\\"2024-01-13\\\" -D_GNU_SOURCE ${wslQuickJs}/quickjs.c ${wslQuickJs}/libunicode.c ${wslQuickJs}/libregexp.c ${wslQuickJs}/dtoa.c && g++ -std=gnu++20 -I ${wslBroSrc} -I ${wslQuickJs} -I /mnt/d/projects/brosurface/out/stubs -DBRO_WITH_LM=0 -o ${harnessBin} quickjs.o libunicode.o libregexp.o dtoa.o ${wslHarnessFile}"`;
  const buildHarness = run(buildHarnessCmd);

  if (buildHarness.status !== 0) {
    console.error(`❌ Failed to build test harness:\n${buildHarness.stderr}`);
    process.exit(1);
  }

  const runHarness = run(`bash -c "${harnessBin}"`);
  console.log(runHarness.stdout.trim());
  if (runHarness.status !== 0) {
    console.error(`❌ Test harness execution failed:\n${runHarness.stderr}`);
    process.exit(1);
  }

  // Step 5: Summary
  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('                 M6 VERIFICATION PROTOCOL SUMMARY                   ');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('  1. IDL Validation:          PASSED (100% Lossless Round-Trip)');
  console.log('  2. Availability Emitter:    PASSED (out/stubs/feature_stubs.cpp)');
  console.log('  3. Standalone C++ Compile:  PASSED (Gate OFF, 0 Warnings/Errors)');
  console.log('  4. QuickJS Runtime Tests:   PASSED (Feature Detection & Throwing Proxy)');
  console.log('\n🎉 Milestone 6 Verification PASSED cleanly with 0 errors!');

  return { success: true };
}

// CLI execution
const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1'));
if (isDirectExecution || (process.argv[1] && process.argv[1].endsWith('verify_m6.mjs'))) {
  runVerifyM6().catch((err) => {
    console.error('Unhandled error in verify_m6:', err);
    process.exit(1);
  });
}
