# Integration Bundle: `custom_elements` (customElements (CustomElementRegistry / HTMLElement))

- **Census Surface:** #57 — Web Components (customElements / HTMLElement)
- **Bro Pin SHA:** `a2311f347a2eae6926c0799ace2978dcab1edf55`
- **Equivalence Status:** 100% Verified (0 Regressions)

---

## 1. Files Replaced in Bro

The following hand-maintained files in `D:/projects/bro` are superseded by the single AST-driven IDL declaration (`idl/custom_elements.idl`):

- `src/js/custom_elements.cpp`
- `docs/custom_elements-api.js`

## 2. Generated Artifacts in Bundle

- `custom_elements.cpp`
- `custom_elements-api.js`
- `diff.patch` (clean unified diff against `a2311f347a2eae6926c0799ace2978dcab1edf55`)

## 3. Exact Test Commands & Passing Test Suites

```bash
bash -c "BRO_ALLOW_STALE=1 ./tests/run_tests.sh custom_elements"
```

### Executed Test Files:
- `tests/custom_elements/test_attributes.js` (PASS)
- `tests/custom_elements/test_define.js` (PASS)

**Result:** All test suites passed with 0 regressions.

## 4. Behavioral Diffs & Triage

Zero behavioral diffs. Standard custom element lifecycle callbacks (connected, disconnected, attributeChanged), observedAttributes reflection, and constructor instantiation.

## 5. Reviewer Re-Verification Command

To independently verify this bundle in an isolated scratch worktree:

```bash
node tools/verify_integration_bundle.mjs custom_elements
```
