# Integration Bundle: `abort` (abort (AbortController / AbortSignal))

- **Census Surface:** #1 — AbortController / AbortSignal
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/abort.idl`):

- `src/bronze_host/host_abort.cpp`
- `docs/abort-api.js`

## 2. Generated Artifacts in Bundle

- `abort.cpp`
- `host_abort.cpp`
- `abort-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh abort"
```

### Executed Test Files:
- `tests/brokit/test_abort.js (PASS)`
- `tests/bronze_host/appdir_abort/ (PASS)`

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. Full signal abort dispatch, AbortSignal.timeout(), AbortSignal.any(), and bronze_host manifest lockstep.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs abort
```
