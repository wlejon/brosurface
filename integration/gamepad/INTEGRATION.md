# Integration Bundle: `gamepad` (gamepad (Gamepad API))

- **Census Surface:** #10 — Gamepad API
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/gamepad.idl`):

- `src/js/gamepad_bindings.cpp`
- `src/bronze_host/dom_gamepad.cpp`
- `docs/gamepad-api.js`

## 2. Generated Artifacts in Bundle

- `gamepad_bindings.cpp`
- `dom_gamepad.cpp`
- `gamepad-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh gamepad"
```

### Executed Test Files:
- `tests/gamepad/test_gamepad.js (PASS)`

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. Gamepad snapshots, 17 standard buttons, 4 analog axes, dual-rumble / trigger-rumble vibration effects.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs gamepad
```
