# Integration Bundle: `motion` (motion (bro.motion))

- **Census Surface:** #28 — Text-to-Motion Generation (bro.motion)
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/motion.idl`):

- `src/js/motion_bindings.cpp`
- `docs/motion-api.js`

## 2. Generated Artifacts in Bundle

- `motion_bindings.cpp`
- `motion-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh motion"
```

### Executed Test Files:
- `tests/motion/test_motion_binding.js (PASS)`
- `tests/scene/test_root_motion.js (PASS)`

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. ARDY-G1 diffusion pipeline loading, safetensors checkpoint parsing, text conditioning, and 25 fps motion generation.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs motion
```
