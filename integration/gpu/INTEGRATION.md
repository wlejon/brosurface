# Integration Bundle: `gpu` (bro.gpu)

- **Census Surface:** #38 — System / Device Probe (bro.gpu)
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/gpu.idl`):

- `src/js/gpu_bindings.cpp`
- `docs/gpu-api.js`

## 2. Generated Artifacts in Bundle

- `gpu_bindings.cpp`
- `gpu-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh gpu"
```

### Executed Test Files:
- `tests/gpu/test_gpu_binding.js` (PASS)
- `tests/aigame/test_nn_gpu.js` (PASS)
- `tests/headless/test_image_gpu_colormap.js` (PASS)
- `tests/headless/test_image_gpu_fbm.js` (PASS)

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. Memory info, device queries, backend enumeration, and cache trimming parity.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs gpu
```
