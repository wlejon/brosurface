# Integration Bundle: `file` (Blob / File / FileReader / URL)

- **Census Surface:** #3 — Class / Prototype (Blob / File / FileReader / URL)
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/file.idl`):

- `third_party/brokit/src/api/blob.cpp`
- `src/bronze_host/host_file.cpp`
- `docs/file-api.js`

## 2. Generated Artifacts in Bundle

- `blob.cpp`
- `host_file.cpp`
- `file-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh blob"
```

### Executed Test Files:
- `tests/brokit/test_blob.js` (PASS)
- `tests/canvas/test_imagebitmap_blob.js` (PASS)
- `tests/dom/test_file_input.js` (PASS)
- `tests/dom/test_filereader.js` (PASS)

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. Full binary slicing, arrayBuffer/text promise resolution, drag-and-drop file path retention, and bronze_host manifest lockstep.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs file
```
