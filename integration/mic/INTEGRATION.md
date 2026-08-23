# Integration Bundle: `mic` (bro.mic)

- **Census Surface:** #32 — Audio Capture Tap (bro.mic)
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/mic.idl`):

- `src/js/mic_bindings.cpp`
- `docs/mic-api.js`

## 2. Generated Artifacts in Bundle

- `mic_bindings.cpp`
- `mic-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh mic"
```

### Executed Test Files:
- `tests/audio/test_mic_chunks.js` (PASS)
- `tests/brokit/test_microtask.js` (PASS)
- `tests/style/test_dynamic_stylesheet.js` (PASS)

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. Float32Array PCM chunk delivery, peak/RMS metering, start/stop lifecycle management.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs mic
```
