# Integration Bundle: `domparser` (domparser (DOMParser))

- **Census Surface:** #12 — DOMParser Interface
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/domparser.idl`):

- `src/bronze_host/host_parser.cpp`
- `docs/domparser-api.js`

## 2. Generated Artifacts in Bundle

- `domparser.cpp`
- `host_parser.cpp`
- `domparser-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh domparser"
```

### Executed Test Files:
- `tests/dom/test_domparser.js (PASS)`

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. HTML markup parsing into Document tree, error handling on non-string inputs.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs domparser
```
