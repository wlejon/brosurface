# Integration Bundle: `noise` (bro.noise (FastNoise))

- **Census Surface:** #1 — Stateless Math (FastNoise)
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/noise.idl`):

- `third_party/brokit/src/api/noise.cpp`
- `docs/noise-api.js`

## 2. Generated Artifacts in Bundle

- `noise.cpp`
- `noise-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh noise"
```

### Executed Test Files:
- `tests/brokit/test_noise.js` (PASS)

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. 100% SIMD lattice generator and graph builder parity with FastNoise2.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs noise
```
