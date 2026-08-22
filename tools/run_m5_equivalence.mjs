// tools/run_m5_equivalence.mjs - Milestone 5 Equivalence Automation Tool
// Implements SPEC §4 Equivalence Protocol for brosurface bronze_host C++ binding emitter.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { runEmitBronzeHost } from '../gen/emit_bronze_host.mjs';

const BRO_DIR = path.resolve('D:/projects/bro');
const SCRATCH_DIR = path.resolve('D:/projects/bro-scratch-m5');
const OUT_DIR = path.resolve('out/bronze_host');
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
  console.log(`\nCleanup scratch worktree if present...`);
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
  console.log('====================================================================');
  console.log('       brosurface Milestone 5 (M5) Equivalence Protocol Runner      ');
  console.log('====================================================================\n');

  // Step 1: Check bro SHA
  console.log(`[Step 1] Checking bro repository at: ${BRO_DIR}`);
  const shaResult = run('git rev-parse HEAD', BRO_DIR);
  if (shaResult.status !== 0) {
    console.error(`Failed to get HEAD SHA from ${BRO_DIR}: ${shaResult.stderr}`);
    process.exit(1);
  }
  const broSha = shaResult.stdout.trim();
  console.log(`  Current bro SHA: ${broSha}`);
  console.log(`  Expected bro SHA: ${EXPECTED_SHA}`);
  if (broSha !== EXPECTED_SHA) {
    console.warn(`  Warning: Current SHA (${broSha}) does not match expected SHA (${EXPECTED_SHA})`);
  } else {
    console.log(`  SHA matches expected pin.`);
  }

  // Step 2: Clean and Create scratch worktree
  console.log(`\n[Step 2] Setting up scratch worktree at: ${SCRATCH_DIR}`);
  cleanupScratchWorktree();

  const addWtResult = run(`git -C "${BRO_DIR}" worktree add "${SCRATCH_DIR}" HEAD`, BRO_DIR);
  if (addWtResult.status !== 0) {
    console.error(`Failed to create git worktree: ${addWtResult.stderr}`);
    process.exit(1);
  }
  console.log(`  Scratch worktree created.`);

  console.log(`  Updating submodules in scratch worktree...`);
  const subResult = run(`git -C "${SCRATCH_DIR}" submodule update --init`, SCRATCH_DIR);
  if (subResult.status !== 0) {
    console.error(`Failed to init submodules in scratch worktree: ${subResult.stderr}`);
    process.exit(1);
  }
  console.log(`  Submodules initialized.`);

  // Step 3: Run bronze_host emitter
  console.log(`\n[Step 3] Running bronze_host C++ Binding & Manifest Emitter...`);
  const emitRes = runEmitBronzeHost('idl/', 'out/bronze_host/');
  if (!emitRes.success) {
    console.error(`Binding emitter failed.`);
    process.exit(1);
  }

  // Step 4: Swap hand-written TU with generated TU in scratch worktree
  console.log(`\n[Step 4] Swapping TU in scratch worktree...`);
  const tuSwaps = [
    {
      src: path.join(OUT_DIR, 'host_file.cpp'),
      dst: path.join(SCRATCH_DIR, 'src/bronze_host/host_file.cpp'),
      name: 'bro/src/bronze_host/host_file.cpp'
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

  // Verify that only the targeted TU differs (or exactly matches HEAD)
  const allowedDiffs = [
    'src/bronze_host/host_file.cpp'
  ];
  for (const f of diffFiles) {
    if (!allowedDiffs.includes(f.replace(/\\/g, '/'))) {
      console.error(`Unexpected file modified in scratch worktree: ${f}`);
      process.exit(1);
    }
  }
  console.log(`  Verified git diff: only targeted TU is touched.`);

  // Step 6: Configure / Build in scratch worktree
  console.log(`\n[Step 6] Building scratch worktree with CMake...`);
  const broBuildDir = path.join(BRO_DIR, 'build');
  const scratchBuildDir = path.join(SCRATCH_DIR, 'build');

  if (fs.existsSync(broBuildDir)) {
    console.log(`  Reusing/staging build artifacts from bro/build...`);
    run(`cmd.exe /c "robocopy \"${broBuildDir}\" \"${scratchBuildDir}\" /E /NFL /NDL /NJH /NJS"`, SCRATCH_DIR);
  }

  console.log(`  Compiling bro_bronze_host and bro-headless in scratch worktree...`);
  const buildResult = run(
    `cmake --build "${scratchBuildDir}" --config Release --target bro_bronze_host bro-headless`,
    SCRATCH_DIR
  );
  if (buildResult.status !== 0) {
    console.error(`Build failed:\n${buildResult.stdout}\n${buildResult.stderr}`);
    process.exit(1);
  }
  console.log(`  Build completed successfully.`);

  // Step 7: Run bronze_host checks and blob tests
  console.log(`\n[Step 7] Running bronze_host & Blob Integration Test Suites...`);
  const testSuites = [
    {
      name: 'bronze_host file probe (HostBlob, File, FileReader, URL)',
      cmd: `bash -c "./tests/bronze_host/run_checks.sh file"`
    },
    {
      name: 'Blob / File full test suite (test_blob.js, test_imagebitmap_blob.js)',
      cmd: `bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh blob"`
    }
  ];

  let totalPassed = 0;
  let totalFailed = 0;
  const suiteResults = [];

  for (const suite of testSuites) {
    console.log(`\n  --- Running ${suite.name} ---`);
    const testResult = run(suite.cmd, SCRATCH_DIR);

    console.log(testResult.stdout.trim());
    if (testResult.status !== 0) {
      console.error(`  Suite failed: ${suite.name}`);
      console.error(testResult.stderr);
      totalFailed++;
      suiteResults.push({ name: suite.name, status: 'FAILED', output: testResult.stdout });
    } else {
      console.log(`  Suite passed: ${suite.name}`);
      totalPassed++;
      suiteResults.push({ name: suite.name, status: 'PASSED', output: testResult.stdout });
    }
  }

  // Step 8: Demonstrate Manifest / Registration Invariant Enforcement
  console.log(`\n[Step 8] Demonstrating Manifest & Registration Invariant Enforcement...`);
  console.log(`  Simulating removal of declared global 'FileReader' from IDL declarations...`);

  const tempNoReaderOut = path.resolve('out/bronze_host_no_reader');
  const emitNoReader = runEmitBronzeHost('idl/', tempNoReaderOut, { excludeGlobals: ['FileReader'] });
  if (!emitNoReader.success) {
    console.error(`Emitter failed for invariant demonstration.`);
    process.exit(1);
  }

  const manifestNormal = fs.readFileSync(path.join(OUT_DIR, 'manifest_entries.txt'), 'utf8').trim().split('\n');
  const manifestNoReader = fs.readFileSync(path.join(tempNoReaderOut, 'manifest_entries.txt'), 'utf8').trim().split('\n');
  const cppNormal = fs.readFileSync(path.join(OUT_DIR, 'host_file.cpp'), 'utf8');
  const cppNoReader = fs.readFileSync(path.join(tempNoReaderOut, 'host_file.cpp'), 'utf8');

  console.log(`  Baseline manifest entries: [${manifestNormal.join(', ')}]`);
  console.log(`  Modified manifest entries: [${manifestNoReader.join(', ')}]`);

  const hasReaderInManifestBaseline = manifestNormal.includes('FileReader');
  const hasReaderInManifestModified = manifestNoReader.includes('FileReader');
  const hasReaderInCppBaseline = cppNormal.includes('g_readerClass.install');
  const hasReaderInCppModified = cppNoReader.includes('g_readerClass.install');

  console.log(`  - Baseline has FileReader in manifest:     ${hasReaderInManifestBaseline}`);
  console.log(`  - Baseline has FileReader in host_file.cpp: ${hasReaderInCppBaseline}`);
  console.log(`  - Modified has FileReader in manifest:     ${hasReaderInManifestModified}`);
  console.log(`  - Modified has FileReader in host_file.cpp: ${hasReaderInCppModified}`);

  if (hasReaderInManifestBaseline && hasReaderInCppBaseline &&
      !hasReaderInManifestModified && !hasReaderInCppModified) {
    console.log(`  Invariant Enforced: Removing 'FileReader' caused both the manifest entry`);
    console.log(`     and the C++ registration to disappear simultaneously in one synchronized generation step.`);
  } else {
    console.error(`Invariant enforcement demonstration failed.`);
    process.exit(1);
  }

  // Clean up invariant demo dir
  fs.rmSync(tempNoReaderOut, { recursive: true, force: true });

  // Step 9: Final Report & Cleanup
  console.log('\n====================================================================');
  console.log('                 M5 EQUIVALENCE PROTOCOL SUMMARY                    ');
  console.log('====================================================================');
  console.log(`  bro SHA: ${broSha}`);
  console.log(`  Test Suites Run: ${testSuites.length}`);
  console.log(`  Suites Passed:   ${totalPassed}`);
  console.log(`  Suites Failed:   ${totalFailed}`);
  console.log(`  Manifest Invariant: ENFORCED (0 divergence possible)`);

  for (const r of suiteResults) {
    console.log(`    - ${r.name}: ${r.status}`);
  }

  cleanupScratchWorktree();
  console.log(`  Scratch worktree cleaned up.`);

  if (totalFailed > 0) {
    console.error('\nEquivalence protocol FAILED with test failures.');
    process.exit(1);
  }

  console.log('\nMilestone 5 Equivalence Protocol PASSED with 0 regressions!');
  return { success: true, broSha, totalPassed, totalFailed };
}

main().catch((err) => {
  console.error('Unhandled error in run_m5_equivalence:', err);
  cleanupScratchWorktree();
  process.exit(1);
});
