# Integration Bundle: `triposplat` (triposplat (bro.triposplat))

- **Census Surface:** #48 — 3D Gaussian Splat Generation (bro.triposplat)
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/triposplat.idl`):

- `src/js/triposplat_bindings.cpp`
- `docs/triposplat-api.js`

## 2. Generated Artifacts in Bundle

- `triposplat_bindings.cpp`
- `triposplat-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh triposplat"
```

### Executed Test Files:
- `tests/triposplat/test_triposplat_binding.js (PASS)`

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. Single-image feedforward 3D gaussian splat reconstruction, FlowDiT sampling, and BiRefNet matte background removal.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs triposplat
```
