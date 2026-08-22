// tools/run_m4_equivalence.mjs - Milestone 4 Equivalence Automation Tool
// Implements SPEC §4 Equivalence Protocol for brosurface QuickJS C++ binding emitter.

import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import { runEmitQjsbind } from '../gen/emit_qjsbind.mjs';

const BRO_DIR = path.resolve('D:/projects/bro');
const SCRATCH_DIR = path.resolve('D:/projects/bro-scratch-m4');
const OUT_DIR = path.resolve('out/qjs');
const EXPECTED_SHA = 'a2311f347a2eae6926c0799ace2978dcab1edf55';

function run(cmd, cwd, options = {}) {
  console.log(`[EXEC] (cwd: ${cwd}) ${cmd}`);
  try {
    const stdout = execSync(cmd, {
      cwd,
      encoding: 'utf8',
      stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...options.env },
      windowsHide: true,
      maxBuffer: 50 * 1024 * 1024
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      status: err.status || 1,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : err.message
    };
  }
}

function cleanupScratchWorktree() {
  console.log(`\n🧹 Cleaning up scratch worktree if present...`);
  if (fs.existsSync(SCRATCH_DIR)) {
    run(`git -C "${BRO_DIR}" worktree remove --force "${SCRATCH_DIR}"`, BRO_DIR);
    if (fs.existsSync(SCRATCH_DIR)) {
      try {
        fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
      } catch (e) {
        // Ignore if git worktree remove already handled it
      }
    }
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║        brosurface Milestone 4 (M4) Equivalence Protocol Runner       ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  // Step 1: Check bro SHA
  console.log(`[Step 1] Checking bro repository at: ${BRO_DIR}`);
  const shaResult = run('git rev-parse HEAD', BRO_DIR);
  if (shaResult.status !== 0) {
    console.error(`❌ Failed to get HEAD SHA from ${BRO_DIR}: ${shaResult.stderr}`);
    process.exit(1);
  }
  const broSha = shaResult.stdout.trim();
  console.log(`  Current bro SHA: ${broSha}`);
  console.log(`  Expected bro SHA: ${EXPECTED_SHA}`);
  if (broSha !== EXPECTED_SHA) {
    console.warn(`  ⚠️ Warning: Current SHA (${broSha}) does not match expected SHA (${EXPECTED_SHA})`);
  } else {
    console.log(`  ✅ SHA matches expected pin.`);
  }

  // Step 2: Clean and Create scratch worktree
  console.log(`\n[Step 2] Setting up scratch worktree at: ${SCRATCH_DIR}`);
  cleanupScratchWorktree();

  const addWtResult = run(`git -C "${BRO_DIR}" worktree add "${SCRATCH_DIR}" HEAD`, BRO_DIR);
  if (addWtResult.status !== 0) {
    console.error(`❌ Failed to create git worktree: ${addWtResult.stderr}`);
    process.exit(1);
  }
  console.log(`  ✅ Scratch worktree created.`);

  console.log(`  Updating submodules in scratch worktree...`);
  const subResult = run(`git -C "${SCRATCH_DIR}" submodule update --init`, SCRATCH_DIR);
  if (subResult.status !== 0) {
    console.error(`❌ Failed to init submodules in scratch worktree: ${subResult.stderr}`);
    process.exit(1);
  }
  console.log(`  ✅ Submodules initialized.`);

  // Step 3: Run qjsbind emitter
  console.log(`\n[Step 3] Running QuickJS C++ Binding Emitter...`);
  const emitRes = runEmitQjsbind('idl/', 'out/qjs/');
  if (!emitRes.success) {
    console.error(`❌ Binding emitter failed.`);
    process.exit(1);
  }

  // Step 4: Swap hand-written TUs with generated TUs in scratch worktree
  console.log(`\n[Step 4] Swapping TUs in scratch worktree...`);
  const tuSwaps = [
    {
      src: path.join(OUT_DIR, 'time_bindings.cpp'),
      dst: path.join(SCRATCH_DIR, 'src/js/time_bindings.cpp'),
      name: 'bro/src/js/time_bindings.cpp'
    },
    {
      src: path.join(OUT_DIR, 'noise.cpp'),
      dst: path.join(SCRATCH_DIR, 'third_party/brokit/src/api/noise.cpp'),
      name: 'bro/third_party/brokit/src/api/noise.cpp'
    },
    {
      src: path.join(OUT_DIR, 'blob.cpp'),
      dst: path.join(SCRATCH_DIR, 'third_party/brokit/src/api/blob.cpp'),
      name: 'bro/third_party/brokit/src/api/blob.cpp'
    }
  ];

  for (const swap of tuSwaps) {
    fs.mkdirSync(path.dirname(swap.dst), { recursive: true });
    fs.copyFileSync(swap.src, swap.dst);
    console.log(`  - Replaced: ${swap.name}`);
  }

  // Step 5: Check git diff in scratch worktree
  console.log(`\n[Step 5] Checking git diff in scratch worktree...`);
  const diffResult = run(`git -C "${SCRATCH_DIR}" diff --name-only`, SCRATCH_DIR);
  const diffFiles = diffResult.stdout.trim().split('\n').filter(Boolean);
  console.log(`  Modified files in scratch worktree: ${diffFiles.length}`);
  for (const f of diffFiles) {
    console.log(`    - ${f}`);
  }

  // Verify that only the targeted TUs (or submodules) differ
  const allowedDiffs = [
    'src/js/time_bindings.cpp',
    'third_party/brokit'
  ];
  for (const f of diffFiles) {
    if (!allowedDiffs.includes(f.replace(/\\/g, '/'))) {
      console.error(`❌ Unexpected file modified in scratch worktree: ${f}`);
      process.exit(1);
    }
  }
  console.log(`  ✅ Verified git diff: only targeted TUs are touched.`);

  // Step 6: Configure / Build in scratch worktree
  console.log(`\n[Step 6] Building scratch worktree with CMake...`);
  const broBuildDir = path.join(BRO_DIR, 'build');
  const scratchBuildDir = path.join(SCRATCH_DIR, 'build');

  if (fs.existsSync(broBuildDir)) {
    console.log(`  Reusing/staging build artifacts from bro/build...`);
    run(`cmd.exe /c "robocopy \"${broBuildDir}\" \"${scratchBuildDir}\" /E /NFL /NDL /NJH /NJS"`, SCRATCH_DIR);
  }

  console.log(`  Compiling bro-headless in scratch worktree...`);
  const buildResult = run(
    `cmake --build "${scratchBuildDir}" --config Release --target bro-headless`,
    SCRATCH_DIR
  );
  if (buildResult.status !== 0) {
    console.error(`❌ Build failed:\n${buildResult.stdout}\n${buildResult.stderr}`);
    process.exit(1);
  }
  console.log(`  ✅ Build completed successfully.`);

  // Step 7: Run Pilot Integration Test Suites
  console.log(`\n[Step 7] Running Pilot Integration Test Suites...`);
  const testSuites = [
    { name: 'Noise (FastNoise)', filter: 'noise' },
    { name: 'Time (bro.time)', filter: 'time' },
    { name: 'Blob & File (Blob, File, ImageBitmap)', filter: 'blob' }
  ];

  let totalPassed = 0;
  let totalFailed = 0;
  const suiteResults = [];

  for (const suite of testSuites) {
    console.log(`\n  --- Running ${suite.name} test suite (filter: "${suite.filter}") ---`);
    const testResult = run(
      `bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh ${suite.filter}"`,
      SCRATCH_DIR
    );

    console.log(testResult.stdout.trim());
    if (testResult.status !== 0) {
      console.error(`  ❌ Suite failed: ${suite.name}`);
      console.error(testResult.stderr);
      totalFailed++;
      suiteResults.push({ name: suite.name, status: 'FAILED', output: testResult.stdout });
    } else {
      console.log(`  ✅ Suite passed: ${suite.name}`);
      totalPassed++;
      suiteResults.push({ name: suite.name, status: 'PASSED', output: testResult.stdout });
    }
  }

  // Step 8: Final Report & Verification
  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('                 M4 EQUIVALENCE PROTOCOL SUMMARY                    ');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log(`  bro SHA: ${broSha}`);
  console.log(`  Test Suites Run: ${testSuites.length}`);
  console.log(`  Suites Passed:   ${totalPassed}`);
  console.log(`  Suites Failed:   ${totalFailed}`);

  for (const r of suiteResults) {
    console.log(`    - ${r.name}: ${r.status}`);
  }

  // Step 9: Cleanup
  cleanupScratchWorktree();
  console.log(`  ✅ Scratch worktree cleaned up.`);

  if (totalFailed > 0) {
    console.error('\n❌ Equivalence protocol FAILED with test failures.');
    process.exit(1);
  }

  console.log('\n🎉 Milestone 4 Equivalence Protocol PASSED with 0 regressions!');
  return { success: true, broSha, totalPassed, totalFailed };
}

main().catch((err) => {
  console.error('Unhandled error in run_m4_equivalence:', err);
  cleanupScratchWorktree();
  process.exit(1);
});
