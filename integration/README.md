# brosurface Integration Bundles Index

> **Status:** 23 Complete Bundles — 100% Behavioral Equivalence Verified  
> **Target Engine Commit:** `a2311f347a2eae6926c0799ace2978dcab1edf55` (`D:/projects/bro`)  
> **Execution Mode:** Isolated scratch worktrees under `tools/isolation.mjs` (0 writes to live repository trees)

---

## 1. Overview & Verification Protocol

Each subdirectory in `integration/` represents a self-contained, drop-in integration bundle containing:
1. `diff.patch`: Clean unified git diff applying the generator-emitted artifacts onto the pinned `bro` tree.
2. `INTEGRATION.md`: Technical specification, target files, exact test commands, and diff triage.
3. Generator-emitted artifacts for the surface (`.cpp`, `-api.js`).

Every bundle is verified by applying `diff.patch` in an isolated scratch worktree (`D:/projects/bro-scratch-verify-<name>-<timestamp>`), compiling `bro-headless.exe` in Release mode, and executing the corresponding regression test suite.

---

## 2. Master Bundle Verification Index

| # | Bundle ID | Surface / Namespace | Pinned Bro SHA | Standalone Verification Command | Behavioral Equivalence Status |
| :-: | :--- | :--- | :---: | :--- | :---: |
| 1 | **[`abort`](abort/)** | `AbortController / AbortSignal` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs abort` | ✅ **100% PASS** (0 regressions) |
| 2 | **[`custom_elements`](custom_elements/)** | `customElements (CustomElementRegistry)` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs custom_elements` | ✅ **100% PASS** (0 regressions) |
| 3 | **[`diar`](diar/)** | `bro.diar (Sortformer & ClusterDiarizer)` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs diar` | ✅ **100% PASS** (0 regressions) |
| 4 | **[`diffusion`](diffusion/)** | `bro.diffusion (Text-to-Image)` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs diffusion` | ✅ **100% PASS** (0 regressions) |
| 5 | **[`domparser`](domparser/)** | `DOMParser (HTML/XML parsing)` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs domparser` | ✅ **100% PASS** (0 regressions) |
| 6 | **[`file`](file/)** | `Blob / File / FileReader / URL` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs file` | ✅ **100% PASS** (0 regressions) |
| 7 | **[`flora`](flora/)** | `bro.flora (Ecosystem Simulation)` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs flora` | ✅ **100% PASS** (0 regressions) |
| 8 | **[`gamepad`](gamepad/)** | `Gamepad / GamepadButton / GamepadEvent` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs gamepad` | ✅ **100% PASS** (0 regressions) |
| 9 | **[`gizmo`](gizmo/)** | `bro.gizmo (3D Transform Controls)` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs gizmo` | ✅ **100% PASS** (0 regressions) |
| 10 | **[`gpu`](gpu/)** | `bro.gpu (Device & Backend Probe)` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs gpu` | ✅ **100% PASS** (0 regressions) |
| 11 | **[`lm`](lm/)** | `bro.lm (Large Language Models)` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs lm` | ✅ **100% PASS** (0 regressions) |
| 12 | **[`math`](math/)** | `bro.math (SpatialHash, PRNG, Smoother)` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs math` | ✅ **100% PASS** (0 regressions) |
| 13 | **[`mic`](mic/)** | `bro.mic (Microphone Audio Capture)` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs mic` | ✅ **100% PASS** (0 regressions) |
| 14 | **[`motion`](motion/)** | `bro.motion (ARDY Motion Diffusion)` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs motion` | ✅ **100% PASS** (0 regressions) |
| 15 | **[`noise`](noise/)** | `bro.noise (FastNoise2 SIMD)` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs noise` | ✅ **100% PASS** (0 regressions) |
| 16 | **[`paths`](paths/)** | `bro.appDir / bro.resolvePath` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs paths` | ✅ **100% PASS** (0 regressions) |
| 17 | **[`rave`](rave/)** | `bro.rave (Neural Audio VAE)` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs rave` | ✅ **100% PASS** (0 regressions) |
| 18 | **[`settings`](settings/)** | `bro.settings (Engine Configuration)` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs settings` | ✅ **100% PASS** (0 regressions) |
| 19 | **[`terrain`](terrain/)** | `scene.createTerrain (Heightfield)` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs terrain` | ✅ **100% PASS** (0 regressions) |
| 20 | **[`text`](text/)** | `bro.text (HarfBuzz Font Shaping)` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs text` | ✅ **100% PASS** (0 regressions) |
| 21 | **[`time`](time/)** | `bro.time (Engine Clock & TimeScale)` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs time` | ✅ **100% PASS** (0 regressions) |
| 22 | **[`triposplat`](triposplat/)** | `bro.triposplat (Single-Image 3D Splat)` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs triposplat` | ✅ **100% PASS** (0 regressions) |
| 23 | **[`worldgen`](worldgen/)** | `bro.worldgen (Neural Terrain Pipeline)` | `a2311f347a2eae6926c0799ace2978dcab1edf55` | `node tools/verify_integration_bundle.mjs worldgen` | ✅ **100% PASS** (0 regressions) |

---

## 3. Standing Acceptance & Verification Suite

To verify all generator health checks, generator freshness, mutation gates, and a spot-checked integration bundle in a single command, execute:

```bash
npm test
# or: node tools/acceptance.mjs
```
