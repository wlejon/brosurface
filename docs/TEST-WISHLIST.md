# brosurface — Test Wishlist for Unblocking Migration

> **Audience:** Engine Core Maintainers & Test Authors  
> **Status:** Active Deliverable (Work Order 4, Milestone 4)  
> **Purpose:** Per [SPEC.md §4](../SPEC.md), the behavioral equivalence test suite is the single authoritative acceptance oracle for migrating any engine API surface into `brosurface`. Surfaces lacking test harnesses in `D:/projects/bro` cannot be migrated without risking undetected regressions.

The table below catalogs all **13 blocked-on-tests surfaces** and defines the **minimal unit test harness** required in `bro` to unblock migration.

---

## 1. Minimal Test Specifications by Surface

| # | Surface ID | Surface Name | Feature Gate | Legacy Tax | Target Test Path | Minimal Unblocking Test Specification |
| :-: | :--- | :--- | :--- | :---: | :--- | :--- |
| 1 | `file.imagebitmap` | `ImageBitmap / createImageBitmap` | None | 664 LOC | `tests/image/test_imagebitmap.js` | Create `ImageBitmap` from `Blob`, `ImageData`, and `HTMLCanvasElement`; verify width/height attributes and `close()` lifetime cleanup. |
| 2 | `dom.waapi` | `element.animate() (WAAPI)` | None | 1,068 LOC | `tests/dom/test_web_animations.js` | Call `element.animate([{opacity: 0}, {opacity: 1}], {duration: 1000})`, verify returned `Animation` handle properties (`playState`, `currentTime`), and call `pause()`/`cancel()`. |
| 3 | `dom.matchmedia` | `window.matchMedia()` | None | 711 LOC | `tests/dom/test_match_media.js` | Call `window.matchMedia('(min-width: 800px)')`, query `.matches` boolean, register `.addEventListener('change', ...)` handler, and trigger simulated resize. |
| 4 | `dom.dialog` | `Native Dialogs (alert, confirm, prompt)` | None | 778 LOC | `tests/dom/test_dialogs.js` | In headless non-interactive mode, call `alert()`, `confirm()`, `prompt()` with mock response injection to verify fallback return values without popping GUI dialogs. |
| 5 | `engine.menu` | `bro.menu (Native Menu Bar)` | None | 341 LOC | `tests/engine/test_menu.js` | Call `bro.menu.setApplicationMenu([...])` with nested MenuItem items, accelerator strings, and click callback handlers. |
| 6 | `platform.steam` | `bro.steam (Steamworks API)` | `BRO_WITH_STEAM` | 1,240 LOC | `tests/engine/test_steam.js` | Call `bro.steam.init()`, query `bro.steam.loggedOn`, `bro.steam.getSteamId()`, and trigger mock achievement unlock. |
| 7 | `soundml.wake` | `bro.wake (Wake Word Engine)` | `BRO_WITH_SOUNDML` | 917 LOC | `tests/audio/test_wake.js` | Load small wake-word model via `bro.wake.load()`, feed 16 kHz PCM buffer, and assert boolean detection output. |
| 8 | `soundml.kws` | `bro.kws (Keyword Spotting)` | `BRO_WITH_SOUNDML` | 1,528 LOC | `tests/audio/test_kws.js` | Load KWS model via `bro.kws.load()`, stream keyword test clip, and assert detected keyword strings with timestamps. |
| 9 | `soundml.listen` | `bro.listen (Speech Activity Detection)` | `BRO_WITH_SOUNDML` | 1,215 LOC | `tests/audio/test_listen.js` | Initialize audio capture listener `bro.listen.start()`, push synthetic silence vs speech frames, and verify VAD state transitions. |
| 10 | `soundml.sense` | `bro.sense (Audio Event Classification)` | `BRO_WITH_SOUNDML` | 980 LOC | `tests/audio/test_sense.js` | Call `bro.sense.classify(audioBuffer)`, verify top-K label strings and confidence probabilities sum to ~1.0. |
| 11 | `soundml.whisper` | `bro.whisper (Whisper ASR)` | `BRO_WITH_SOUNDML` | 2,140 LOC | `tests/audio/test_whisper.js` | Load tiny Whisper weights via `bro.whisper.load()`, transcribe 3-second wav clip, and assert decoded text matches ground truth. |
| 12 | `dom.anchordownload` | `Anchor (<a download>)` | None | 412 LOC | `tests/dom/test_anchor_download.js` | Create `<a href="blob:..." download="test.txt">`, trigger synthetic click event, and assert file save handler invoked. |
| 13 | `dom.selection` | `Selection / Range` | None | 895 LOC | `tests/dom/test_selection.js` | Call `document.createRange()`, `range.setStart()`, `range.setEnd()`, `window.getSelection().addRange()`, and verify `selection.toString()`. |

---

## 2. Note on Testing Protocol

Per `WORK-ORDER-4.md` Hard Rules:
- `brosurface` **never writes or commits test files directly into `D:/projects/bro`**.
- The test harnesses above must be authored by the `bro` repository maintainers.
- Once committed into `bro` and verified with `tests/run_tests.sh`, the corresponding surface status in `docs/COVERAGE.md` will automatically transition from `blocked-on-tests` to `not-started` and become eligible for batch migration.
