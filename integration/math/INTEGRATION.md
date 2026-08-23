# Integration Bundle: `math` (math (bro.math))

- **Census Surface:** #5 — Fast Math & Spatial Indexing (bro.math)
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/math.idl`):

- `src/js/math_bindings.cpp`
- `docs/math-api.js`

## 2. Generated Artifacts in Bundle

- `math_bindings.cpp`
- `math-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh math"
```

### Executed Test Files:
- `tests/math/test_rng_smoother.js (PASS)`
- `tests/math/test_spatial_hash.js (PASS)`

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. 3D spatial hash index, SplitMix64 PRNG, exponential smoother filter, curve evaluators, and geometric intersection tests.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs math
```
