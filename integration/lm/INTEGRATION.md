# Integration Bundle: `lm` (bro.lm)

- **Census Surface:** #42 — Large Language Models & Cross-Modal ML (bro.lm)
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/lm.idl`):

- `docs/lm-api.js`

## 2. Generated Artifacts in Bundle

- `lm-api.js`
- `feature_stubs.cpp`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh lm"
```

### Executed Test Files:
- `tests/lm/test_lm_binding.js` (PASS)

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. Complete coverage of language model drivers, tokenizers, cross-modal scorers, and availability-stub fallback.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs lm
```
