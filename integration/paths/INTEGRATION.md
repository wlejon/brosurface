# Integration Bundle: `paths` (paths (bro.appDir / bro.resolvePath))

- **Census Surface:** #20 — Asset & Application Paths (bro.appDir / bro.resolvePath)
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/paths.idl`):

- `src/js/asset_path.cpp`
- `docs/paths-api.js`

## 2. Generated Artifacts in Bundle

- `asset_path.cpp`
- `paths-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh app_paths"
```

### Executed Test Files:
- `tests/headless/test_app_paths.js (PASS)`

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. Dynamic appDir retrieval, relative and mounted asset path normalization across OS platforms.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs paths
```
