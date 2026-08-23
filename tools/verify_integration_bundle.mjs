// tools/verify_integration_bundle.mjs - Milestone 3 (M3) Integration Bundle Verification Suite
// Implements automated scratch worktree verification for brosurface integration bundles.
//
// Usage:
//   node tools/verify_integration_bundle.mjs <namespace>
//   node tools/verify_integration_bundle.mjs --random
//   node tools/verify_integration_bundle.mjs --all

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  BRO_DIR,
  assertScratchWorktree,
  recordLiveTreeSnapshot,
  assertLiveTreeUnchanged
} from './isolation.mjs';

const ROOT = path.resolve('.');
const EXPECTED_SHA = 'a2311f347a2eae6926c0799ace2978dcab1edf55';

function logStep(stepNum, title) {
  console.log(`\n--------------------------------------------------------------------------------`);
  console.log(` STEP ${stepNum}: ${title}`);
  console.log(`--------------------------------------------------------------------------------`);
}

function runCmd(cmd, cwd, options = {}) {
  console.log(`[EXEC] (cwd: ${cwd}) ${cmd}`);
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

function cleanupWorktree(scratchDir) {
  console.log(`\n🧹 Cleaning up scratch worktree at: ${scratchDir}`);
  runCmd(`git -C "${BRO_DIR}" worktree remove --force "${scratchDir}"`, BRO_DIR);
  runCmd(`git -C "${BRO_DIR}" worktree prune`, BRO_DIR);
  if (fs.existsSync(scratchDir)) {
    try {
      execSync(`cmd.exe /c "rd /s /q \\"${scratchDir}\\""`);
    } catch (_) {}
  }
}

export function getAvailableBundles() {
  const integrationDir = path.join(ROOT, 'integration');
  if (!fs.existsSync(integrationDir)) return [];
  return fs.readdirSync(integrationDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && fs.existsSync(path.join(integrationDir, e.name, 'INTEGRATION.md')))
    .map(e => e.name);
}

export function parseBundleInfo(namespace) {
  const bundleDir = path.join(ROOT, 'integration', namespace);
  const docPath = path.join(bundleDir, 'INTEGRATION.md');
  const patchPath = path.join(bundleDir, 'diff.patch');

  if (!fs.existsSync(docPath)) {
    throw new Error(`Missing INTEGRATION.md in ${bundleDir}`);
  }
  if (!fs.existsSync(patchPath)) {
    throw new Error(`Missing diff.patch in ${bundleDir}`);
  }

  const docText = fs.readFileSync(docPath, 'utf8');
  let testCmd = '';
  const codeBlockMatch = docText.match(/```bash\r?\n([\s\S]*?)\r?\n```/);
  if (codeBlockMatch) {
    const blockLines = codeBlockMatch[1].split('\n').map(l => l.trim()).filter(l => l.length > 0);
    testCmd = blockLines[0];
  }

  if (!testCmd) {
    throw new Error(`Could not parse test command from ${docPath}`);
  }

  return { namespace, bundleDir, docPath, patchPath, testCmd };
}

export async function verifySingleBundle(bundleInfo, options = {}) {
  const { namespace, patchPath, testCmd } = bundleInfo;
  console.log(`\n════════════════════════════════════════════════════════════════════════════════`);
  console.log(`       Verifying Integration Bundle: [ ${namespace.toUpperCase()} ]`);
  console.log(`════════════════════════════════════════════════════════════════════════════════`);

  const scratchDir = path.resolve(`D:/projects/bro-scratch-verify-${namespace}-${Date.now()}`);
  let success = false;

  try {
    // Step 1: Verify Bro SHA
    logStep(1, 'Verifying Bro Repository SHA Pin');
    const shaRes = runCmd('git rev-parse HEAD', BRO_DIR);
    if (shaRes.status !== 0) {
      throw new Error(`Failed to read HEAD SHA: ${shaRes.stderr}`);
    }
    const currentSha = shaRes.stdout.trim();
    console.log(`  Current Bro SHA : ${currentSha}`);
    console.log(`  Expected Bro SHA: ${EXPECTED_SHA}`);
    if (currentSha !== EXPECTED_SHA) {
      console.warn(`  ⚠️ SHA mismatch warning: current (${currentSha}) != expected (${EXPECTED_SHA})`);
    } else {
      console.log(`  ✅ SHA matches expected pin.`);
    }

    // Step 2: Create Scratch Worktree
    logStep(2, `Creating Isolated Scratch Worktree: ${scratchDir}`);
    cleanupWorktree(scratchDir);

    const wtRes = runCmd(`git -C "${BRO_DIR}" worktree add "${scratchDir}" HEAD`, BRO_DIR);
    if (wtRes.status !== 0) {
      throw new Error(`Failed to create worktree: ${wtRes.stderr}`);
    }
    console.log(`  ✅ Worktree created successfully.`);

    // Machine-enforced isolation assertion
    assertScratchWorktree(scratchDir, options);
    console.log(`  ✅ Verified scratch worktree isolation (linked worktree under scratch root).`);

    console.log(`  Initializing required submodules...`);
    const subRes = runCmd(`git -C "${scratchDir}" submodule update --init`, scratchDir);
    if (subRes.status !== 0) {
      throw new Error(`Failed to init submodules: ${subRes.stderr}`);
    }
    console.log(`  ✅ Submodules initialized.`);

    // Step 3: Apply diff.patch
    logStep(3, `Applying diff.patch from integration/${namespace}/`);
    const patchAbs = path.resolve(patchPath);
    const applyRes = runCmd(`git -C "${scratchDir}" apply "${patchAbs}"`, scratchDir);
    if (applyRes.status !== 0) {
      throw new Error(`Failed to apply patch ${patchAbs}:\n${applyRes.stderr}`);
    }
    console.log(`  ✅ diff.patch applied cleanly with 0 rejects.`);

    // Step 4: Build bro-headless (Incremental MSVC compilation)
    logStep(4, 'Building bro-headless (Release) in Scratch Worktree');
    const broBuildDir = path.join(BRO_DIR, 'build');
    const scratchBuildDir = path.join(scratchDir, 'build');

    // Terminate any lingering bro-headless processes
    runCmd(`cmd.exe /c "taskkill /F /IM bro-headless.exe /T 2>nul || exit 0"`, scratchDir);

    if (fs.existsSync(broBuildDir)) {
      console.log(`  Staging cached build artifacts from bro/build...`);
      fs.mkdirSync(scratchBuildDir, { recursive: true });
      try {
        execSync(`robocopy "${broBuildDir}" "${scratchBuildDir}" /E /NFL /NDL /NJH /NJS`, {
          cwd: scratchDir,
          stdio: 'ignore',
        });
      } catch (err) {
        if (err.status > 7) {
          console.warn(`  ⚠️ Robocopy staging warning (status ${err.status}): ${err.message}`);
        }
      }
    }

    console.log(`  Compiling target bro-headless...`);
    const buildRes = runCmd(`cmake --build "${scratchBuildDir}" --config Release --target bro-headless`, scratchDir);
    if (buildRes.status !== 0) {
      throw new Error(`Build failed:\n${buildRes.stdout}\n${buildRes.stderr}`);
    }
    console.log(`  ✅ Compilation succeeded.`);

    // Step 5: Execute Test Command
    logStep(5, `Executing Equivalence Test Command: ${testCmd}`);
    const testRes = runCmd(testCmd, scratchDir);
    console.log(testRes.stdout.trim());
    if (testRes.status !== 0 || /0 passed,\s+[1-9]\d*\s+failed/.test(testRes.stdout) || /FAIL\s+/.test(testRes.stdout)) {
      throw new Error(`Test suite failed for bundle ${namespace}:\n${testRes.stdout}\n${testRes.stderr}`);
    }
    console.log(`\n  ✅ All tests passed with 100% equivalence (0 failures/regressions)!`);
    success = true;
  } finally {
    cleanupWorktree(scratchDir);
  }

  return success;
}

export async function main() {
  const args = process.argv.slice(2);
  const liveTreeIAmSure = args.includes('--live-tree-i-am-sure');
  const bundles = getAvailableBundles();

  if (bundles.length === 0) {
    console.error('❌ No integration bundles found in integration/');
    process.exit(1);
  }

  console.log(`╔════════════════════════════════════════════════════════════════════╗`);
  console.log(`║      brosurface Integration Bundle Verification Runner (M3/M4)     ║`);
  console.log(`╚════════════════════════════════════════════════════════════════════╝`);
  console.log(`Available bundles (${bundles.length}): ${bundles.join(', ')}\n`);

  // Pre-guard snapshot of live trees
  console.log(`[Guard] Recording pre-run live repository status (bro & brokit)...`);
  const liveSnapshot = recordLiveTreeSnapshot();
  console.log(`  ✅ Pre-run live tree status clean.\n`);

  let targetBundles = [];

  if (args.includes('--all')) {
    targetBundles = [...bundles];
  } else if (args.includes('--random') || args.filter(a => !a.startsWith('--')).length === 0) {
    const idx = Math.floor(Math.random() * bundles.length);
    targetBundles = [bundles[idx]];
    console.log(`🎲 Randomly selected bundle for verification: ${bundles[idx]}`);
  } else {
    const selected = args.find(a => !a.startsWith('--'));
    if (!bundles.includes(selected)) {
      console.error(`❌ Unknown bundle '${selected}'. Available: ${bundles.join(', ')}`);
      process.exit(1);
    }
    targetBundles = [selected];
  }

  let totalPassed = 0;
  let totalFailed = 0;

  try {
    for (const b of targetBundles) {
      try {
        const info = parseBundleInfo(b);
        const ok = await verifySingleBundle(info, { liveTreeIAmSure });
        if (ok) totalPassed++;
        else totalFailed++;
      } catch (err) {
        console.error(`\n❌ Verification failed for bundle '${b}':`, err.message);
        totalFailed++;
      }
    }
  } finally {
    // Post-guard snapshot assertion of live trees
    console.log(`\n[Guard] Verifying post-run live repository status (bro & brokit)...`);
    assertLiveTreeUnchanged(liveSnapshot);
    console.log(`  ✅ Live repository state unchanged (0 unintended side effects).`);
  }

  console.log(`\n════════════════════════════════════════════════════════════════════════════════`);
  console.log(`                     BUNDLE VERIFICATION SUMMARY                               `);
  console.log(`════════════════════════════════════════════════════════════════════════════════`);
  console.log(`  - Total Bundles Tested : ${targetBundles.length}`);
  console.log(`  - Passed (0 Regressions): ${totalPassed}`);
  console.log(`  - Failed               : ${totalFailed}`);
  console.log(`════════════════════════════════════════════════════════════════════════════════\n`);

  if (totalFailed === 0) {
    console.log(`OVERALL STATUS: ✅ ALL BUNDLE VERIFICATIONS PASSED\n`);
    return true;
  } else {
    console.error(`OVERALL STATUS: ❌ BUNDLE VERIFICATION ENCOUNTERED FAILURES\n`);
    return false;
  }
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirect) {
  main().then(ok => {
    if (!ok) process.exit(1);
  }).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
