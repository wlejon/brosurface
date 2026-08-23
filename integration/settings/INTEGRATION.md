# Integration Bundle: `settings` (bro.settings)

- **Census Surface:** #29 — Settings Management & Action Bindings (bro.settings)
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/settings.idl`):

- `src/js/settings_bindings.cpp`
- `docs/settings-api.js`

## 2. Generated Artifacts in Bundle

- `settings_bindings.cpp`
- `settings-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh settings"
```

### Executed Test Files:
- `tests/settings/test_action_bindings.js` (PASS)
- `tests/settings/test_settings.js` (PASS)

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. Key rebinding, multi-key action triggers, JSON configuration persistence, and display mode queries.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs settings
```
