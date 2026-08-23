# Integration Bundle: `diffusion` (diffusion (bro.diffusion))

- **Census Surface:** #41 — Neural Diffusion Pipeline (bro.diffusion)
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/diffusion.idl`):

- `src/js/diffusion_bindings.cpp`
- `docs/diffusion-api.js`

## 2. Generated Artifacts in Bundle

- `diffusion_bindings.cpp`
- `diffusion-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh diffusion"
```

### Executed Test Files:
- `tests/diffusion/test_diffusion_binding.js (PASS)`

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. Text-to-image neural diffusion inference pipeline, safetensors loading, schedulers, and expandNoise.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs diffusion
```
