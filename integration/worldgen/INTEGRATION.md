# Integration Bundle: `worldgen` (worldgen (bro.worldgen))

- **Census Surface:** #49 — Neural World Generation (bro.worldgen)
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/worldgen.idl`):

- `src/js/worldgen_bindings.cpp`
- `docs/worldgen-api.js`

## 2. Generated Artifacts in Bundle

- `worldgen_bindings.cpp`
- `worldgen-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 BRO_TERRAIN_WEIGHTS=none ./tests/run_tests.sh worldgen"
```

### Executed Test Files:
- `tests/worldgen/test_worldgen_stage.js (PASS)`

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. Multi-stage neural world pipeline, coarse/latent/residual stages, synchronous and asynchronous elevation reconstruction.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs worldgen
```
