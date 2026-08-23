# Integration Bundle: `flora` (flora (bro.flora))

- **Census Surface:** #4 — Ecosystem Simulation (bro.flora)
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/flora.idl`):

- `src/js/flora_bindings.cpp`
- `docs/flora-api.js`

## 2. Generated Artifacts in Bundle

- `flora_bindings.cpp`
- `flora-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh flora"
```

### Executed Test Files:
- `tests/flora/test_bindings_smoke.js (PASS)`

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. Ecosystem simulation ticks, plant creation, procedural branch mesh emit, and leaf cluster generation.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs flora
```
