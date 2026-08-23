# Integration Bundle: `gizmo` (bro.gizmo)

- **Census Surface:** #22 — 3D Transform Gizmo Controls (bro.gizmo)
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/gizmo.idl`):

- `src/js/gizmo_bindings.cpp`
- `docs/gizmo-api.js`

## 2. Generated Artifacts in Bundle

- `gizmo_bindings.cpp`
- `gizmo-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh gizmo"
```

### Executed Test Files:
- `tests/scene/test_gizmo_drag.js` (PASS)
- `tests/scene/test_gizmo.js` (PASS)

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. Translation, rotation, scale manipulation modes, hit testing, and interactive drag handlers.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs gizmo
```
