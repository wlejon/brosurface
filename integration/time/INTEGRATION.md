# Integration Bundle: `time` (bro.time)

- **Census Surface:** #2 — Stateful Clock (bro.time)
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/time.idl`):

- `src/js/time_bindings.cpp`
- `docs/time-api.js`

## 2. Generated Artifacts in Bundle

- `time_bindings.cpp`
- `time-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh time"
```

### Executed Test Files:
- `tests/time/test_time.js` (PASS)

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. Complete equivalence for time scaling, paused state, and monotonically increasing high-resolution clock.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs time
```
