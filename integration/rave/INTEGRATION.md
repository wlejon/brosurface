# Integration Bundle: `rave` (rave (bro.rave))

- **Census Surface:** #29 — RAVE Real-Time Audio VAE (bro.rave)
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/rave.idl`):

- `src/js/rave_bindings.cpp`
- `docs/rave-api.js`

## 2. Generated Artifacts in Bundle

- `rave_bindings.cpp`
- `rave-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh rave"
```

### Executed Test Files:
- `tests/rave/test_rave_binding.js (PASS)`

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. RAVE 48kHz neural audio codec encoding, latent manipulation, decoding, torchscript and onnx loading.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs rave
```
