// tools/isolation.mjs — Machine-Enforced Worktree Isolation and Live-Tree Pre/Post Guard
// Enforces that all execution against bro/brokit runs strictly within linked scratch worktrees.
//
// Rules enforced:
// 1. REFUSE to operate on a working tree that is not a linked worktree (git-dir != git-common-dir).
// 2. REFUSE to operate on a worktree unless it lives under a designated scratch root (contains 'scratch').
// 3. Pre/post snapshot of live bro and brokit working trees asserting zero modifications.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export const BRO_DIR = path.resolve('D:/projects/bro');
export const BROKIT_DIR = path.resolve('D:/projects/bro/third_party/brokit');

function execGit(cmd, cwd) {
  try {
    return execSync(cmd, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      maxBuffer: 50 * 1024 * 1024,
    }).trim();
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim() : err.message;
    throw new Error(`Git command failed in ${cwd} (${cmd}): ${stderr}`);
  }
}

/**
 * Asserts that targetDir is a linked git worktree and lives under a scratch root.
 * Refuses live trees unless explicitly bypassed with --live-tree-i-am-sure (which warns).
 *
 * @param {string} targetDir
 * @param {Object} options
 * @param {boolean} [options.liveTreeIAmSure=false]
 * @returns {boolean}
 */
export function assertScratchWorktree(targetDir, options = {}) {
  const absTarget = path.resolve(targetDir);

  if (options.liveTreeIAmSure) {
    console.warn(`\x1b[31m⚠️ WARNING: Operating directly on LIVE tree: ${absTarget} (--live-tree-i-am-sure override active)!\x1b[0m`);
    return true;
  }

  if (!fs.existsSync(absTarget)) {
    throw new Error(`Target directory does not exist: ${absTarget}`);
  }

  let gitDir;
  let gitCommonDir;
  try {
    gitDir = execGit('git rev-parse --git-dir', absTarget);
    gitCommonDir = execGit('git rev-parse --git-common-dir', absTarget);
  } catch (err) {
    throw new Error(`Failed to inspect git directories for ${absTarget}: ${err.message}`);
  }

  const absGitDir = path.resolve(absTarget, gitDir);
  const absGitCommonDir = path.resolve(absTarget, gitCommonDir);

  // In a linked worktree, gitDir (e.g. .../.git/worktrees/<name>) differs from gitCommonDir (.../.git)
  if (absGitDir === absGitCommonDir) {
    throw new Error(
      `❌ FATAL ISOLATION VIOLATION: REFUSING to operate on LIVE working tree at '${absTarget}'.\n` +
      `   Target is the main repository (--git-dir == --git-common-dir == '${absGitCommonDir}').\n` +
      `   Automated operations must ONLY run in an isolated scratch worktree (e.g. D:/projects/bro-scratch-*).`
    );
  }

  // Verify target is located under a scratch root (directory name or path contains 'scratch')
  const baseName = path.basename(absTarget).toLowerCase();
  const dirName = path.dirname(absTarget).toLowerCase();
  const isScratch = baseName.includes('scratch') || dirName.includes('scratch');

  if (!isScratch) {
    throw new Error(
      `❌ FATAL ISOLATION VIOLATION: Working tree '${absTarget}' is not located in a scratch root.\n` +
      `   Path must contain 'scratch' (e.g. 'bro-scratch-*' or a scratch directory).`
    );
  }

  return true;
}

/**
 * Records snapshot of live bro and brokit repository statuses before starting an operation.
 *
 * @param {string} [broRoot=BRO_DIR]
 * @returns {{ broRoot: string, brokitRoot: string, broStatus: string, brokitStatus: string }}
 */
export function recordLiveTreeSnapshot(broRoot = BRO_DIR) {
  const brokitRoot = path.join(broRoot, 'third_party/brokit');

  let broStatus = '';
  if (fs.existsSync(broRoot)) {
    broStatus = execGit('git status --porcelain', broRoot);
  }

  let brokitStatus = '';
  if (fs.existsSync(brokitRoot)) {
    brokitStatus = execGit('git status --porcelain', brokitRoot);
  }

  return {
    broRoot,
    brokitRoot,
    broStatus,
    brokitStatus,
  };
}

/**
 * Asserts that the live bro and brokit repositories remain 100% untouched after operation.
 *
 * @param {{ broRoot: string, brokitRoot: string, broStatus: string, brokitStatus: string }} snapshot
 */
export function assertLiveTreeUnchanged(snapshot) {
  if (!snapshot) return;

  const { broRoot, brokitRoot, broStatus, brokitStatus } = snapshot;

  if (fs.existsSync(broRoot)) {
    const currentBroStatus = execGit('git status --porcelain', broRoot);
    if (currentBroStatus !== broStatus) {
      const diff = execGit('git diff', broRoot);
      throw new Error(
        `❌ FATAL ISOLATION VIOLATION: LIVE bro repository was modified!\n` +
        `  Before status: "${broStatus}"\n` +
        `  After status:  "${currentBroStatus}"\n` +
        `  Live diff:\n${diff || '(untracked files only)'}`
      );
    }
  }

  if (fs.existsSync(brokitRoot)) {
    const currentBrokitStatus = execGit('git status --porcelain', brokitRoot);
    if (currentBrokitStatus !== brokitStatus) {
      const diff = execGit('git diff', brokitRoot);
      throw new Error(
        `❌ FATAL ISOLATION VIOLATION: LIVE brokit repository was modified!\n` +
        `  Before status: "${brokitStatus}"\n` +
        `  After status:  "${currentBrokitStatus}"\n` +
        `  Live diff:\n${diff || '(untracked files only)'}`
      );
    }
  }
}
