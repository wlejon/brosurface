# Integration Bundle: `diar` (diar (bro.diar))

- **Census Surface:** #44 — Speaker Diarization (bro.diar)
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/diar.idl`):

- `src/js/diar_bindings.cpp`
- `docs/diar-api.js`

## 2. Generated Artifacts in Bundle

- `diar_bindings.cpp`
- `diar-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh diar"
```

### Executed Test Files:
- `tests/diar/test_diar_binding.js (PASS)`

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. Sortformer 4-speaker Conformer diarization, streaming sessions, and offline cluster diarizer.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs diar
```
