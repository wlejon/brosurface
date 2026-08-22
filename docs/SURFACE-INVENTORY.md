# bro Engine Surface Census & Five-Copy Inventory

> **Status:** Machine-extracted on `2026-08-22` via `node tools/census.mjs`.  
> **Source of Truth:** [D:/projects/bro](file:///D:/projects/bro)  
> **Scope Specification:** [SPEC.md §6](file:///D:/projects/brosurface/SPEC.md) & [WORK-ORDER-1.md M1](file:///D:/projects/brosurface/WORK-ORDER-1.md)

---

## 1. Executive Summary: The Five-Copy Tax

The bro engine currently maintains its JS API surface across **five hand-written, parallel copies** that suffer from drift, redundant boilerplate, and synchronization hazards.

| Copy Target | Files / Layer | Purpose | Total Hand-Maintained LOC |
| :--- | :--- | :--- | :--- |
| **1. QuickJS Bindings** | `src/js/*_bindings.cpp`, `brokit` | QuickJS interpreter C++ bindings | **107,138** LOC |
| **2. bronze_host Bindings** | `src/bronze_host/host_*.cpp`, `gl_*.cpp` | AOT-compiled JavaScript host runtime | **21,864** LOC |
| **3. Availability Stubs** | `src/js/feature_stubs.cpp` | Fallback `{ available: false }` for compiled-out features | **153** LOC |
| **4. Documentation** | `docs/*-api.js`, `docs/*.md` | Hand-written JSDoc & API specifications | **27,985** LOC |
| **5. TypeScript App Definitions** | *(None / new)* | `.d.ts` autocomplete & app typechecking | **0** LOC |
| **6. Headless Injection Seams** | `src/headless/*`, `src/js/headless_bindings.cpp` | Test harnesses & driver injection | **1,762** LOC |
| **TOTAL TAX TO ELIMINATE** | **All 5 Hand Copies** | **Hand-maintained surface across engine** | **158,902 LOC** |

*Note: Generating all five artifacts from single `.idl` declarations will eliminate approximately **158,902 LOC** of synchronized boilerplate while introducing real TypeScript definition files for app developers.*

---

## 2. Proven Pilot Candidates (Milestone 2–5 Scope)

Per [SPEC.md §7](file:///D:/projects/brosurface/SPEC.md), three namespaces of distinct character are selected as initial pilots to prove the generator model end-to-end:

| Pilot Namespace | Character & Rationale | Current QuickJS LOC | Current bronze_host LOC | Current Docs LOC | Current Total Tax |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`bro.noise (FastNoise)`** | **Pilot Candidate (Stateless)**: Pure stateless math functions over typed arrays (Float32Array). Simplest marshalling contract. | 811 LOC | 0 LOC | 797 LOC | **1,608 LOC** |
| **`bro.time`** | **Pilot Candidate (Stateful Clock)**: Small stateful namespace bound to one engine-owned clock. Tests scalar properties & time control. | 128 LOC | 4 LOC | 96 LOC | **239 LOC** |
| **`Blob / File / FileReader / URL`** | **Pilot Candidate (Class / Prototype)**: Real classes with prototypes, instanceof, inheritance (File extends Blob), and cross-API reach. Exercises HostClass. | 1045 LOC | 1116 LOC | 260 LOC | **2,462 LOC** |

---

## 3. Master Surface Inventory Table

| # | Surface Name | Category / Character | Feature Gate | QuickJS LOC | bronze_host LOC | Stubs LOC | Docs LOC | Headless LOC | Total Tax LOC | Marshalling Shapes |
| :-: | :--- | :--- | :--- | :-: | :-: | :-: | :-: | :-: | :-: | :--- |
| 1 | **bro.noise (FastNoise)** | Pilot Candidate (Stateless) | `None` | 811 | 0 | 0 | 797 | 0 | **1608** | typedarray (Float32Array), number (float, int), string (enum), handle (FastNoise) |
| 2 | **bro.time** | Pilot Candidate (Stateful Clock) | `None` | 128 | 4 | 0 | 96 | 11 | **239** | number (now, scale, delta), boolean (paused) |
| 3 | **Blob / File / FileReader / URL** | Pilot Candidate (Class / Prototype) | `None` | 1045 | 1116 | 0 | 260 | 41 | **2462** | handle (HostBlob, HostReader, HostUrl), typedarray (Uint8Array, ArrayBuffer), string, number, dict/options ({type, lastModified}), callback (EventListener, onload, onerror), promise (text(), arrayBuffer(), bytes()) |
| 4 | **bro.flora** | Ecosystem Simulation | `BRO_WITH_FLORA` | 1314 | 0 | 6 | 501 | 0 | **1821** | handle (FloraSimulation), typedarray (Float32Array), vec3/vec4, dict/options, number |
| 5 | **bro.math** | Math Utilities | `None` | 751 | 0 | 0 | 338 | 0 | **1089** | vec2/vec3/vec4 (dual accept array/object), quat, mat4, handle (SpatialHash3D), number |
| 6 | **bro.image / Image / bro.image.gpu** | Image Processing & CPU/GPU Kernels | `None` | 3407 | 318 | 0 | 810 | 0 | **4535** | typedarray (Uint8Array, Float32Array), handle, callback, dict/options ({width, height, channels}), number |
| 7 | **ImageBitmap / createImageBitmap** | Bitmap Transfer | `None` | 478 | 0 | 0 | 186 | 0 | **664** | handle (ImageBitmap), promise, dict/options, number |
| 8 | **AudioContext / broaudio** | Real-Time Audio Graph | `None` | 3199 | 2831 | 0 | 1415 | 0 | **7445** | handle (AudioContext, AudioNode, AudioParam, AudioBuffer), typedarray (Float32Array), vec3, number, string (enum), callback/promise |
| 9 | **bro.mesh / Mesh** | Mesh Geometry & Operations | `BRO_WITH_3D` | 3119 | 225 | 5 | 2200 | 0 | **5549** | handle (Mesh), typedarray (Float32Array, Uint32Array), vec3/vec2, color, dict/options, string |
| 10 | **bro.scene (SceneGraph / Nodes)** | 3D Scene Graph | `BRO_WITH_3D` | 4995 | 72 | 0 | 2926 | 51 | **8044** | handle (SceneGraph, SceneNode), vec2/vec3/vec4, quat, color, dual array/object, callback, typedarray |
| 11 | **AnimationPlayer / Animation** | Skeletal & Property Animation | `BRO_WITH_3D` | 1306 | 0 | 0 | 554 | 0 | **1860** | handle (AnimationPlayer, Clip, BlendSpace, StateMachine), dict/options, vec3/quat, number, string, callback |
| 12 | **PBR Lighting & Materials** | 3D Rendering / Shading | `BRO_WITH_3D` | 1325 | 0 | 0 | 423 | 0 | **1748** | handle (LightNode, Material), vec3/color, number, string/enum |
| 13 | **bro.net** | Low-Level Networking | `BRO_WITH_NET` | 662 | 922 | 9 | 314 | 0 | **1907** | handle (NetPeer, Host, Client), typedarray (Uint8Array), string, number, callback (onMessage, onConnect), dict/options |
| 14 | **bro.net.sync** | High-Level Replication | `BRO_WITH_NET` | 743 | 0 | 0 | 369 | 0 | **1112** | object, string, number, callback |
| 15 | **Gamepad API** | Input Hardware | `None` | 238 | 138 | 0 | 195 | 54 | **625** | dict/options (Gamepad, GamepadButton), number (axes, rumble), string, callback |
| 16 | **Pointer / Touch Events** | Input Events & Dispatch | `None` | 1720 | 761 | 0 | 234 | 277 | **2992** | handle/object (Event subclasses), number, string, boolean, callback (event listeners) |
| 17 | **element.animate() (WAAPI)** | DOM Animation | `None` | 909 | 0 | 0 | 159 | 0 | **1068** | handle (Animation), array of keyframe objects, dict/options (timing), number, callback, promise |
| 18 | **window.matchMedia()** | CSS Media Queries | `None` | 551 | 14 | 0 | 146 | 0 | **711** | handle/object (MediaQueryList), string (query), boolean (matches), callback |
| 19 | **bro.window / window.*** | Window & Display Management | `None` | 1494 | 576 | 0 | 404 | 20 | **2494** | dict/options (Display, BatteryManager, WindowHandle), number, string, boolean, callback/events |
| 20 | **Native Dialogs** | Modal Dialogs | `None` | 532 | 100 | 0 | 141 | 5 | **778** | string (paths, text), boolean, dict/options (file filters), callback/promise |
| 21 | **bro.menu** | Native Menu Bar | `None` | 197 | 5 | 0 | 139 | 0 | **341** | array/object of menu items ({id, label, accel, children}), string, callback (onAction) |
| 22 | **bro.gizmo** | 3D Gizmo Controls | `BRO_WITH_3D` | 329 | 0 | 0 | 128 | 0 | **457** | handle (Gizmo), vec3/quat, color, string (mode), callback (onTransform), number |
| 23 | **Video / VideoEncoder / GifEncoder / bro.media** | Media & Codecs | `BRO_WITH_VIDEO` | 782 | 651 | 4 | 604 | 0 | **2041** | handle (VideoEncoder, GifEncoder, VideoPlayer), typedarray (RGBA pixels, waveform floats), promise, dict/options (codec config, filmstrip), number, string, callback |
| 24 | **IFrame (<iframe src>)** | Sub-Document Isolation | `None` | 101 | 0 | 0 | 175 | 0 | **276** | handle (Element, Document), string (src, origin), callback/events |
| 25 | **bro.steam** | Platform / Steamworks | `BRO_WITH_STEAM` | 1240 | 0 | 0 | 0 | 0 | **1240** | dict/options, string, number, boolean, callback |
| 26 | **bro.text** | Typography & Text Diagnostics | `BRO_WITH_TEXT_SHAPING` | 304 | 0 | 0 | 0 | 0 | **304** | string (text), object (clusters, glyphs, advance, bidi runs), number |
| 27 | **Rig / IK** | Rigging & Inverse Kinematics | `BRO_WITH_3D` | 1521 | 0 | 0 | 0 | 0 | **1521** | handle (Rig, Skeleton, IKSolver), vec3/quat, typedarray, dict/options, number |
| 28 | **bro.server** | Dedicated Server Host | `None` | 187 | 0 | 0 | 0 | 0 | **187** | number (tickrate, uptime), callback (tick loop), dict/options |
| 29 | **bro.settings** | Settings Management | `None` | 583 | 0 | 0 | 408 | 0 | **991** | dict/options (categories, keys/values), string, number, boolean, callback (change listener) |
| 30 | **bro.wake** | Audio ML / Wake-Word | `BRO_WITH_SOUNDML` | 753 | 0 | 3 | 161 | 0 | **917** | handle (WakeDetector), typedarray (Float32Array), number, callback (onWake), dict/options |
| 31 | **bro.kws** | Audio ML / Keyword Spotting | `BRO_WITH_SOUNDML` | 1221 | 0 | 3 | 304 | 0 | **1528** | handle (KwsDetector), string (keywords), typedarray (Float32Array), number, callback (onSpot), dict/options |
| 32 | **bro.mic** | Audio Capture | `None` | 479 | 0 | 0 | 141 | 0 | **620** | handle (MicTap), typedarray (Float32Array), number, callback (onData), dict/options ({peak, rms}) |
| 33 | **bro.sense** | Audio Sensor Hub | `BRO_WITH_SOUNDML` | 519 | 0 | 3 | 185 | 0 | **707** | handle (SensorHub), number, boolean, dict/options ({vad, onset, pitch, tonality}), callback |
| 34 | **bro.gesture** | Audio Gesture Matching | `BRO_WITH_SOUNDML` | 595 | 0 | 3 | 145 | 0 | **743** | handle (GestureMatcher), string (pattern), number, callback (onMatch), dict/options |
| 35 | **bro.listen** | Audio Stream Multiplexing | `BRO_WITH_SOUNDML` | 1142 | 0 | 3 | 137 | 0 | **1282** | handle (ListenStream), number, string, callback, dict/options |
| 36 | **Worker** | Threading & Concurrency | `None` | 2049 | 0 | 0 | 320 | 0 | **2369** | handle (Worker), structured clone (objects, typed arrays, ArrayBuffer transfer), callback (onmessage, onerror), string |
| 37 | **bro.ai (Game AI / NavMesh / MCTS)** | Game AI & Pathfinding | `BRO_WITH_GAMEAI` | 10361 | 1459 | 16 | 2191 | 0 | **14027** | handle (NavMesh, NavGrid, Agent, MCTS, Prior, Evaluator), vec2/vec3, typedarray (Float32Array), dict/options, callback, number |
| 38 | **bro.gpu** | System / Device Probe | `BRO_WITH_TENSOR` | 248 | 0 | 16 | 161 | 0 | **425** | dict/options ({available, backend, devices, compiledBackends}), string, number, boolean |
| 39 | **bro.appDir / bro.resolvePath** | Filesystem Path Resolution | `None` | 147 | 100 | 0 | 84 | 0 | **331** | string (file paths) |
| 40 | **bro.tensor** | Machine Learning / Tensor Engine | `BRO_WITH_TENSOR` | 4977 | 0 | 3 | 1402 | 0 | **6382** | handle (Tensor), typedarray (Float32Array, Int32Array, Uint8Array), array of dims/shape, number, string (dtype, device), dict/options |
| 41 | **bro.diffusion** | Machine Learning / Generative Vision | `BRO_WITH_DIFFUSION` | 1980 | 0 | 3 | 701 | 0 | **2684** | handle (DiffusionPipeline), promise, dict/options (step options, LoRA), typedarray (latents, images), string, number, callback (progress) |
| 42 | **bro.lm (Large Language Models)** | Machine Learning / LLMs | `BRO_WITH_LM` | 3272 | 0 | 5 | 561 | 0 | **3838** | handle (LanguageModel, Tokenizer), promise, string, typedarray, dict/options, callback (stream tokens), number |
| 43 | **bro.stt** | Machine Learning / Speech-to-Text | `BRO_WITH_SOUNDML` | 2658 | 0 | 1 | 458 | 0 | **3117** | handle (STTModel), promise, typedarray (Float32Array PCM), string, dict/options (timestamps, segments), callback |
| 44 | **bro.diar** | Machine Learning / Diarization | `BRO_WITH_SOUNDML` | 1015 | 0 | 1 | 225 | 0 | **1241** | handle (Diarizer), promise, typedarray (Float32Array PCM), dict/options (speakers, segments), callback |
| 45 | **bro.tts** | Machine Learning / Text-to-Speech | `BRO_WITH_SOUNDML` | 3382 | 0 | 1 | 675 | 0 | **4058** | handle (TTSModel), promise, string (text, voice), typedarray (Float32Array PCM), dict/options, callback (stream PCM) |
| 46 | **bro.rave** | Machine Learning / Audio Neural Codec | `BRO_WITH_SOUNDML` | 586 | 0 | 1 | 161 | 0 | **748** | handle (RaveModel), promise, typedarray (Float32Array PCM, latents), dict/options |
| 47 | **bro.vision** | Machine Learning / Vision AI | `BRO_WITH_VISION` | 2854 | 0 | 4 | 401 | 0 | **3259** | handle (VisionModel), promise, typedarray (Uint8Array, Float32Array), dict/options (points, boxes, masks), number |
| 48 | **bro.triposplat** | Machine Learning / 3D Gaussian Splatting | `BRO_WITH_TRIPOSPLAT` | 854 | 0 | 4 | 124 | 0 | **982** | handle (TripoSplatModel), promise, typedarray (image buffer in, splat buffer out), dict/options |
| 49 | **bro.worldgen** | Machine Learning / Learned Terrain | `BRO_WITH_DIFFUSION` | 1033 | 0 | 5 | 215 | 0 | **1253** | handle (WorldgenModel), promise, typedarray (Float32Array elevation), number (coords, seed), dict/options |
| 50 | **bro.motion** | Machine Learning / Motion Generation | `BRO_WITH_DIFFUSION && BRO_WITH_LM` | 564 | 0 | 6 | 168 | 0 | **738** | handle (MotionModel), promise, string (prompt), typedarray (Float32Array joint angles), dict/options |
| 51 | **Physics (Jolt Physics)** | Rigid Body Physics | `BRO_WITH_PHYSICS` | 4170 | 2350 | 0 | 1966 | 0 | **8486** | handle (Body, Shape, World, Character, Constraint, SoftBody), vec3/quat, color, dual array/object, callback (contacts), dict/options (raycast, body config), typedarray |
| 52 | **scene.createTerrain** | Heightfield Terrain | `BRO_WITH_3D` | 482 | 0 | 0 | 286 | 0 | **768** | handle (Terrain), typedarray (Float32Array heights, edits), vec3, dict/options, number |
| 53 | **scene.createClipmapTerrain** | GPU Clipmap Terrain | `BRO_WITH_3D` | 556 | 0 | 0 | 506 | 0 | **1062** | handle (ClipmapTerrain), dict/options (pyramid, rings), vec3, number |
| 54 | **scene.createTileWorld** | Tile World & Meshing | `BRO_WITH_3D` | 1121 | 0 | 0 | 504 | 0 | **1625** | handle (TileWorld), typedarray (tile buffers), vec3, dict/options, number |
| 55 | **Canvas 2D Context** | 2D Graphics Rendering | `None` | 836 | 82 | 0 | 0 | 52 | **970** | handle (CanvasRenderingContext2D, CanvasGradient, ImageData), typedarray (Uint8ClampedArray), color, number, string, dict/options |
| 56 | **WebGL2RenderingContext** | GPU 3D Pipeline | `None` | 3610 | 2716 | 0 | 100 | 0 | **6426** | handle (WebGLBuffer, WebGLShader, WebGLProgram, WebGLTexture, WebGLFramebuffer, WebGLVAO), typedarray (all TypedArrays), number (enums, sizes), string (GLSL source), boolean |
| 57 | **customElements** | Web Components | `None` | 512 | 0 | 0 | 0 | 0 | **512** | string (tag name), class constructor callback (define), dict/options |
| 58 | **MutationObserver / ResizeObserver** | DOM Observers | `None` | 331 | 609 | 0 | 0 | 0 | **940** | handle (Observer), callback, array of record objects ({type, target, addedNodes, removedNodes, contentRect}), element handle |
| 59 | **DOMParser** | XML / HTML Parser | `None` | 259 | 128 | 0 | 0 | 0 | **387** | handle (DOMParser), string (source, mime), returns Document handle |
| 60 | **AbortController / AbortSignal** | Async Cancellation | `None` | 19 | 281 | 0 | 0 | 0 | **300** | handle (AbortController, AbortSignal), boolean (aborted), callback (onabort / EventListener), any (reason) |
| 61 | **Intl (ECMA-402)** | Internationalization | `None` | 714 | 98 | 0 | 0 | 0 | **812** | string, number, dict/options |
| 62 | **Vendor Globals (CodeMirror, acorn, etc.)** | Vendored Library Bridges | `None` | 0 | 82 | 0 | 0 | 0 | **82** | object, function, string |
| 63 | **brokit (System & Web APIs)** | Node / Web Core Runtime | `None` | 7151 | 1389 | 0 | 856 | 0 | **9396** | handle (Stream, Request, Response, Headers, Socket, Process), typedarray (Buffer, Uint8Array), dict/options, promise, callback, string, number |
| 64 | **Headless Injection & Test Surface** | Headless Test Framework | `None` | 1587 | 0 | 0 | 925 | 1251 | **3763** | string, number, boolean, dict/options, callback/listener handle |
| 65 | **DOM Core (Element / Node / Document)** | DOM Core Machinery (Out of Scope for M1-M6) | `None` | 9609 | 2053 | 0 | 0 | 0 | **11662** | handle (Element, Node, Document, Range, Selection, CSSStyleDeclaration), string, number, boolean, dict/options, callback |
| 66 | **Runtime Core & Interp Bridge** | Runtime Machinery (Out of Scope for M1-M6) | `None` | 1521 | 2784 | 48 | 0 | 0 | **4353** | Engine JSValue / bronze Value internal machinery |

---

## 4. Comprehensive Per-Surface Details

### 1. bro.noise (FastNoise)
- **Category:** Pilot Candidate (Stateless)
- **Feature Gate:** `None`
- **Description:** SIMD procedural noise generator (FastNoise2), pure stateless functions over typed arrays
- **Marshalling Shapes:** `typedarray (Float32Array)`, `number (float, int)`, `string (enum)`, `handle (FastNoise)`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 811 LOC
    `third_party/brokit/src/api/noise.cpp`: **811** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 797 LOC
    `docs/noise-api.js`: **797** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **1608 LOC**
- **Test Coverage Pointers:**
  * `tests/brokit/test_noise.js`
  * `tests/brokit/test_noise_extras.js`
  * `tests/brokit/test_noise_position_array.js`

### 2. bro.time
- **Category:** Pilot Candidate (Stateful Clock)
- **Feature Gate:** `None`
- **Description:** Global pause & timescale control over engine-owned scaled clock
- **Marshalling Shapes:** `number (now, scale, delta)`, `boolean (paused)`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 128 LOC
    `src/js/time_bindings.cpp`: **104** LOC<br>`src/js/time_bindings.h`: **24** LOC
  * **bronze_host Bindings:** 4 LOC
    `src/bronze_host/dom_globals.cpp` (L818-821): **4** LOC *(bro.time inline builder)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 96 LOC
    `docs/time-api.js`: **96** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 11 LOC
    `src/js/headless_bindings.cpp` (L162-172): **11** LOC *(advanceTime / sleep)*
- **Total Copy Tax:** **239 LOC**
- **Test Coverage Pointers:**
  * `tests/time/test_time.js`

### 3. Blob / File / FileReader / URL
- **Category:** Pilot Candidate (Class / Prototype)
- **Feature Gate:** `None`
- **Description:** W3C File API: in-memory binary blobs, files, FileReader event stream, object URLs
- **Marshalling Shapes:** `handle (HostBlob, HostReader, HostUrl)`, `typedarray (Uint8Array, ArrayBuffer)`, `string`, `number`, `dict/options ({type, lastModified})`, `callback (EventListener, onload, onerror)`, `promise (text(), arrayBuffer(), bytes())`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 1045 LOC
    `third_party/brokit/src/api/blob.cpp`: **531** LOC<br>`src/js/js/file_polyfills.js`: **319** LOC<br>`src/js/anchor_download.cpp`: **158** LOC<br>`src/js/anchor_download.h`: **37** LOC
  * **bronze_host Bindings:** 1116 LOC
    `src/bronze_host/host_file.cpp`: **1116** LOC
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 260 LOC
    `docs/file-api.js`: **260** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 41 LOC
    `src/js/headless_bindings.cpp` (L622-662): **41** LOC *(lastDownload, setPickedFiles, setDialogAnswer)*
- **Total Copy Tax:** **2462 LOC**
- **Test Coverage Pointers:**
  * `tests/brokit/test_blob.js`
  * `tests/brokit/test_file.js`
  * `tests/brokit/test_url.js`
  * `tests/bronze_host/appdir_file/main.js`
  * `tests/dom/test_anchor_download.js`

### 4. bro.flora
- **Category:** Ecosystem Simulation
- **Feature Gate:** `BRO_WITH_FLORA`
- **Description:** Procedural ecosystem simulation (plants, foliage, bloom generation and instance transforms)
- **Marshalling Shapes:** `handle (FloraSimulation)`, `typedarray (Float32Array)`, `vec3/vec4`, `dict/options`, `number`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 1314 LOC
    `src/js/flora_bindings.cpp`: **375** LOC<br>`src/js/flora_bindings.h`: **30** LOC<br>`src/js/flora_bindings_emit.cpp`: **525** LOC<br>`src/js/flora_bindings_internal.h`: **384** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 6 LOC
    `src/js/feature_stubs.cpp` (L126-131): **6** LOC
  * **Docs:** 501 LOC
    `docs/flora-api.js`: **501** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **1821 LOC**
- **Test Coverage Pointers:**
  * `tests/flora/test_bindings_smoke.js`

### 5. bro.math
- **Category:** Math Utilities
- **Feature Gate:** `None`
- **Description:** Vector / matrix / spatial acceleration utilities (SpatialHash3D, dual array/object accept)
- **Marshalling Shapes:** `vec2/vec3/vec4 (dual accept array/object)`, `quat`, `mat4`, `handle (SpatialHash3D)`, `number`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 751 LOC
    `src/js/math_bindings.cpp`: **732** LOC<br>`src/js/math_bindings.h`: **19** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 338 LOC
    `docs/math-api.js`: **338** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **1089 LOC**
- **Test Coverage Pointers:**
  * `tests/math/test_spatial_hash.js`
  * `tests/math/test_rng_smoother.js`

### 6. bro.image / Image / bro.image.gpu
- **Category:** Image Processing & CPU/GPU Kernels
- **Feature Gate:** `None`
- **Description:** CPU image decode/encode + processing kernels and WebGL2 GPU image pipeline
- **Marshalling Shapes:** `typedarray (Uint8Array, Float32Array)`, `handle`, `callback`, `dict/options ({width, height, channels})`, `number`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 3407 LOC
    `src/js/image_bindings.cpp`: **1834** LOC<br>`src/js/image_bindings.h`: **70** LOC<br>`src/js/js/image_gpu.js`: **788** LOC<br>`third_party/brokit/src/api/image.cpp`: **715** LOC
  * **bronze_host Bindings:** 318 LOC
    `src/bronze_host/host_image.cpp`: **133** LOC<br>`src/bronze_host/host_element_image.cpp`: **185** LOC
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 810 LOC
    `docs/image-api.js`: **810** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **4535 LOC**
- **Test Coverage Pointers:**
  * `tests/image/test_image_kernels.js`
  * `tests/canvas/test_image_loading.js`

### 7. ImageBitmap / createImageBitmap
- **Category:** Bitmap Transfer
- **Feature Gate:** `None`
- **Description:** W3C ImageBitmap interface for off-thread image decoding and GPU texture upload
- **Marshalling Shapes:** `handle (ImageBitmap)`, `promise`, `dict/options`, `number`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 478 LOC
    `src/js/imagebitmap_bindings.cpp`: **422** LOC<br>`src/js/imagebitmap_bindings.h`: **56** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 186 LOC
    `docs/imagebitmap-api.js`: **186** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **664 LOC**
- **Test Coverage Pointers:**
  * `tests/image/test_imagebitmap.js`
  * `tests/canvas/test_create_image_bitmap.js`

### 8. AudioContext / broaudio
- **Category:** Real-Time Audio Graph
- **Feature Gate:** `None`
- **Description:** Web Audio API graph implementation, DSP synthesis, spatial nodes, audio buses, MIDI
- **Marshalling Shapes:** `handle (AudioContext, AudioNode, AudioParam, AudioBuffer)`, `typedarray (Float32Array)`, `vec3`, `number`, `string (enum)`, `callback/promise`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 3199 LOC
    `src/js/audio_bindings.cpp`: **3065** LOC<br>`src/js/audio_bindings.h`: **24** LOC<br>`src/js/audio_scene_sync.cpp`: **74** LOC<br>`src/js/audio_scene_sync.h`: **36** LOC
  * **bronze_host Bindings:** 2831 LOC
    `src/bronze_host/host_audio_core.cpp`: **871** LOC<br>`src/bronze_host/host_audio_nodes.cpp`: **816** LOC<br>`src/bronze_host/host_audio_buffer.cpp`: **162** LOC<br>`src/bronze_host/host_audio_param.cpp`: **166** LOC<br>`src/bronze_host/host_audio_spatial.cpp`: **211** LOC<br>`src/bronze_host/host_audio_dsp.cpp`: **242** LOC<br>`src/bronze_host/host_audio_internal.h`: **363** LOC
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 1415 LOC
    `docs/audio-api.js`: **1415** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **7445 LOC**
- **Test Coverage Pointers:**
  * `tests/audio/test_context.js`
  * `tests/audio/test_buses.js`
  * `tests/audio/test_spatial.js`
  * `tests/bronze_host/appdir_audio/`

### 9. bro.mesh / Mesh
- **Category:** Mesh Geometry & Operations
- **Feature Gate:** `BRO_WITH_3D`
- **Description:** Procedural mesh generation, CSG boolean ops, mesh simplification, UV unwrapping, Draco codec
- **Marshalling Shapes:** `handle (Mesh)`, `typedarray (Float32Array, Uint32Array)`, `vec3/vec2`, `color`, `dict/options`, `string`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 3119 LOC
    `src/js/mesh_bindings.cpp`: **3074** LOC<br>`src/js/mesh_bindings.h`: **45** LOC
  * **bronze_host Bindings:** 225 LOC
    `src/bronze_host/host_codecs.cpp`: **225** LOC *(Draco encode/decode bridge)*
  * **Availability Stubs:** 5 LOC
    `src/js/feature_stubs.cpp` (L173-177): **5** LOC
  * **Docs:** 2200 LOC
    `docs/mesh-api.js`: **2200** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **5549 LOC**
- **Test Coverage Pointers:**
  * `tests/mesh/test_analysis.js`
  * `tests/mesh/test_baking.js`
  * `tests/mesh/test_bvh.js`
  * `tests/bronze_host/appdir_codecs/`

### 10. bro.scene (SceneGraph / Nodes)
- **Category:** 3D Scene Graph
- **Feature Gate:** `BRO_WITH_3D`
- **Description:** Hierarchical 3D scene graph, ShapeNode, SpriteNode, MeshNode, SplatNode, CameraNode
- **Marshalling Shapes:** `handle (SceneGraph, SceneNode)`, `vec2/vec3/vec4`, `quat`, `color`, `dual array/object`, `callback`, `typedarray`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 4995 LOC
    `src/js/scene_bindings.cpp`: **1935** LOC<br>`src/js/scene_bindings.h`: **36** LOC<br>`src/js/scene_bindings_mesh.cpp`: **1492** LOC<br>`src/js/scene_bindings_view.cpp`: **956** LOC<br>`src/js/scene_bindings_internal.h`: **379** LOC<br>`src/js/js/impostor_layer.js`: **197** LOC
  * **bronze_host Bindings:** 72 LOC
    `src/bronze_host/host_canvas2d.cpp`: **72** LOC
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 2926 LOC
    `docs/scene-api.js`: **2926** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 51 LOC
    `src/headless/main.cpp` (L80-130): **51** LOC *(__host.sceneContext, __host.sceneLink)*
- **Total Copy Tax:** **8044 LOC**
- **Test Coverage Pointers:**
  * `tests/scene/test_scenegraph.js`
  * `tests/scene/test_mesh_node.js`
  * `tests/bronze_host/appdir_instanced/`

### 11. AnimationPlayer / Animation
- **Category:** Skeletal & Property Animation
- **Feature Gate:** `BRO_WITH_3D`
- **Description:** Keyframe track clips, blend spaces, layered skeletal blending, and state machines
- **Marshalling Shapes:** `handle (AnimationPlayer, Clip, BlendSpace, StateMachine)`, `dict/options`, `vec3/quat`, `number`, `string`, `callback`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 1306 LOC
    `src/js/scene_bindings_anim.cpp`: **800** LOC<br>`src/js/scene_bindings_clip.cpp`: **506** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 554 LOC
    `docs/animation-api.js`: **554** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **1860 LOC**
- **Test Coverage Pointers:**
  * `tests/scene/test_animation_clips.js`
  * `tests/scene/test_blend_spaces.js`
  * `tests/scene/test_anim_state_machine.js`

### 12. PBR Lighting & Materials
- **Category:** 3D Rendering / Shading
- **Feature Gate:** `BRO_WITH_3D`
- **Description:** PBR lighting pipeline: LightNode (directional, point, spot), PBRMaterial, tonemapping, ambient
- **Marshalling Shapes:** `handle (LightNode, Material)`, `vec3/color`, `number`, `string/enum`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 1325 LOC
    `src/js/scene_bindings_fx.cpp`: **1325** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 423 LOC
    `docs/lighting-api.js`: **423** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **1748 LOC**
- **Test Coverage Pointers:**
  * `tests/scene/test_pbr_materials.js`
  * `tests/scene/test_lighting.js`

### 13. bro.net
- **Category:** Low-Level Networking
- **Feature Gate:** `BRO_WITH_NET`
- **Description:** Game networking over GameNetworkingSockets (host/connect, message channels, reliable/unreliable)
- **Marshalling Shapes:** `handle (NetPeer, Host, Client)`, `typedarray (Uint8Array)`, `string`, `number`, `callback (onMessage, onConnect)`, `dict/options`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 662 LOC
    `src/js/net_bindings.cpp`: **630** LOC<br>`src/js/net_bindings.h`: **32** LOC
  * **bronze_host Bindings:** 922 LOC
    `src/bronze_host/host_net.cpp`: **922** LOC
  * **Availability Stubs:** 9 LOC
    `src/js/feature_stubs.cpp` (L137-145): **9** LOC
  * **Docs:** 314 LOC
    `docs/net-api.js`: **314** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **1907 LOC**
- **Test Coverage Pointers:**
  * `tests/net/test_net_loopback.js`
  * `tests/net/test_net_channels_clone.js`
  * `tests/bronze_host/appdir_net/`

### 14. bro.net.sync
- **Category:** High-Level Replication
- **Feature Gate:** `BRO_WITH_NET`
- **Description:** Entity state replication, RPC dispatcher, star-topology host replication engine
- **Marshalling Shapes:** `object`, `string`, `number`, `callback`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 743 LOC
    `src/js/js/net_sync.js`: **743** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 369 LOC
    `docs/net-sync-api.js`: **369** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **1112 LOC**
- **Test Coverage Pointers:**
  * `tests/net/test_net_sync.js`

### 15. Gamepad API
- **Category:** Input Hardware
- **Feature Gate:** `None`
- **Description:** W3C Gamepad API, dual-motor rumble, settings action bindings, headless virtual gamepad injection
- **Marshalling Shapes:** `dict/options (Gamepad, GamepadButton)`, `number (axes, rumble)`, `string`, `callback`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 238 LOC
    `src/js/gamepad_bindings.cpp`: **214** LOC<br>`src/js/gamepad_bindings.h`: **24** LOC
  * **bronze_host Bindings:** 138 LOC
    `src/bronze_host/dom_gamepad.cpp`: **138** LOC
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 195 LOC
    `docs/gamepad-api.js`: **195** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 54 LOC
    `src/js/headless_bindings.cpp` (L757-810): **54** LOC *(gamepadConnect, gamepadDisconnect, gamepadButton, gamepadAxis)*
- **Total Copy Tax:** **625 LOC**
- **Test Coverage Pointers:**
  * `tests/gamepad/test_gamepad.js`
  * `tests/bronze_host/appdir_input/`

### 16. Pointer / Touch Events
- **Category:** Input Events & Dispatch
- **Feature Gate:** `None`
- **Description:** W3C Pointer & Touch events, 3-phase DOM event dispatch, pointer capture, compat mouse synthesis
- **Marshalling Shapes:** `handle/object (Event subclasses)`, `number`, `string`, `boolean`, `callback (event listeners)`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 1720 LOC
    `src/js/event_bindings.cpp`: **111** LOC<br>`src/js/event_dispatch.cpp`: **356** LOC<br>`src/js/event_dispatch_populate.cpp`: **664** LOC<br>`src/js/event_dispatch_invoke.cpp`: **418** LOC<br>`src/js/event_dispatch.h`: **84** LOC<br>`src/js/event_dispatch_internal.h`: **87** LOC
  * **bronze_host Bindings:** 761 LOC
    `src/bronze_host/host_events.cpp`: **164** LOC<br>`src/bronze_host/host_dom_events.cpp`: **597** LOC
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 234 LOC
    `docs/pointer-api.js`: **234** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 277 LOC
    `src/js/headless_bindings.cpp` (L256-532): **277** LOC *(mouse, touch, key, IME simulation)*
- **Total Copy Tax:** **2992 LOC**
- **Test Coverage Pointers:**
  * `tests/events/test_add_remove_listener.js`
  * `tests/touch/test_touch_gesture.js`
  * `tests/bronze_host/appdir_events/`

### 17. element.animate() (WAAPI)
- **Category:** DOM Animation
- **Feature Gate:** `None`
- **Description:** Web Animations API subset running over CSS-transition interpolator engine
- **Marshalling Shapes:** `handle (Animation)`, `array of keyframe objects`, `dict/options (timing)`, `number`, `callback`, `promise`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 909 LOC
    `src/js/web_animation_bindings.cpp`: **876** LOC<br>`src/js/web_animation_bindings.h`: **33** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 159 LOC
    `docs/web-animations-api.js`: **159** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **1068 LOC**
- **Test Coverage Pointers:**
  * `tests/dom/test_web_animations.js`

### 18. window.matchMedia()
- **Category:** CSS Media Queries
- **Feature Gate:** `None`
- **Description:** MediaQueryList evaluation, live change listeners, per-realm media query resolution
- **Marshalling Shapes:** `handle/object (MediaQueryList)`, `string (query)`, `boolean (matches)`, `callback`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 551 LOC
    `src/js/matchmedia_bindings.cpp`: **518** LOC<br>`src/js/matchmedia_bindings.h`: **33** LOC
  * **bronze_host Bindings:** 14 LOC
    `src/bronze_host/dom_globals.cpp` (L643-656): **14** LOC *(matchMedia inline implementation)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 146 LOC
    `docs/matchmedia-api.js`: **146** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **711 LOC**
- **Test Coverage Pointers:**
  * `tests/dom/test_match_media.js`

### 19. bro.window / window.*
- **Category:** Window & Display Management
- **Feature Gate:** `None`
- **Description:** Runtime OS window control (borderless, always-on-top, limits, multi-window open), screen, battery
- **Marshalling Shapes:** `dict/options (Display, BatteryManager, WindowHandle)`, `number`, `string`, `boolean`, `callback/events`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 1494 LOC
    `src/js/window_bindings.cpp`: **631** LOC<br>`src/js/window_bindings.h`: **46** LOC<br>`src/js/window_host_bindings.cpp`: **519** LOC<br>`src/js/window_host_bindings.h`: **51** LOC<br>`src/js/js/window_polyfill.js`: **247** LOC
  * **bronze_host Bindings:** 576 LOC
    `src/bronze_host/host_platform.cpp`: **444** LOC<br>`src/bronze_host/dom_globals.cpp` (L565-696): **132** LOC *(makeWindowValue)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 404 LOC
    `docs/window-api.js`: **404** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 20 LOC
    `src/js/headless_bindings.cpp` (L236-255): **20** LOC *(argWindowId routing)*
- **Total Copy Tax:** **2494 LOC**
- **Test Coverage Pointers:**
  * `tests/window/test_battery.js`
  * `tests/manual/multiwindow_demo/`

### 20. Native Dialogs
- **Category:** Modal Dialogs
- **Feature Gate:** `None`
- **Description:** Native modal file/folder pickers, alert/confirm/prompt modal dialogs
- **Marshalling Shapes:** `string (paths, text)`, `boolean`, `dict/options (file filters)`, `callback/promise`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 532 LOC
    `src/js/dialog_bindings.cpp`: **468** LOC<br>`src/js/dialog_bindings.h`: **64** LOC
  * **bronze_host Bindings:** 100 LOC
    `src/bronze_host/host_platform.cpp` (L101-200): **100** LOC *(alert/confirm/prompt)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 141 LOC
    `docs/dialogs-api.js`: **141** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 5 LOC
    `src/js/headless_bindings.cpp` (L658-662): **5** LOC *(setDialogAnswer)*
- **Total Copy Tax:** **778 LOC**
- **Test Coverage Pointers:**
  * `tests/dom/test_dialogs.js`

### 21. bro.menu
- **Category:** Native Menu Bar
- **Feature Gate:** `None`
- **Description:** OS native top menu bar management (items, submenus, accelerators, action events)
- **Marshalling Shapes:** `array/object of menu items ({id, label, accel, children})`, `string`, `callback (onAction)`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 197 LOC
    `src/js/menu_bindings.cpp`: **180** LOC<br>`src/js/menu_bindings.h`: **17** LOC
  * **bronze_host Bindings:** 5 LOC
    `src/bronze_host/dom_globals.cpp` (L812-816): **5** LOC *(bro.menu builder)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 139 LOC
    `docs/menu-api.js`: **139** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **341 LOC**
- **Test Coverage Pointers:**
  * `tests/engine/test_menu.js`

### 22. bro.gizmo
- **Category:** 3D Gizmo Controls
- **Feature Gate:** `BRO_WITH_3D`
- **Description:** 3D transform handles (translation, rotation, scale) with mouse picking and manipulation
- **Marshalling Shapes:** `handle (Gizmo)`, `vec3/quat`, `color`, `string (mode)`, `callback (onTransform)`, `number`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 329 LOC
    `src/js/gizmo_bindings.cpp`: **314** LOC<br>`src/js/gizmo_bindings.h`: **15** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 128 LOC
    `docs/gizmo-api.js`: **128** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **457 LOC**
- **Test Coverage Pointers:**
  * `tests/scene/test_gizmo.js`

### 23. Video / VideoEncoder / GifEncoder / bro.media
- **Category:** Media & Codecs
- **Feature Gate:** `BRO_WITH_VIDEO`
- **Description:** HTMLMediaElement video playback (VP9/Opus), WebM/GIF video encoding, media waveform & filmstrip analysis
- **Marshalling Shapes:** `handle (VideoEncoder, GifEncoder, VideoPlayer)`, `typedarray (RGBA pixels, waveform floats)`, `promise`, `dict/options (codec config, filmstrip)`, `number`, `string`, `callback`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 782 LOC
    `src/js/video_bindings.cpp`: **536** LOC<br>`src/js/video_bindings.h`: **18** LOC<br>`src/js/media_bindings.cpp`: **208** LOC<br>`src/js/media_bindings.h`: **20** LOC
  * **bronze_host Bindings:** 651 LOC
    `src/bronze_host/host_video.cpp`: **651** LOC
  * **Availability Stubs:** 4 LOC
    `src/js/feature_stubs.cpp` (L151-154): **4** LOC
  * **Docs:** 604 LOC
    `docs/video-api.js`: **604** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **2041 LOC**
- **Test Coverage Pointers:**
  * `tests/video/test_encoders.js`
  * `tests/video/test_audio_only.js`
  * `tests/bronze_host/appdir_video/`

### 24. IFrame (<iframe src>)
- **Category:** Sub-Document Isolation
- **Feature Gate:** `None`
- **Description:** Isolated sub-document realm with independent DOM, styles, timers, and input routing
- **Marshalling Shapes:** `handle (Element, Document)`, `string (src, origin)`, `callback/events`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 101 LOC
    `src/js/dom_bindings.cpp` (L400-500): **101** LOC *(iframe binding slice)*
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 175 LOC
    `docs/iframe-api.js`: **175** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **276 LOC**
- **Test Coverage Pointers:**
  * `tests/dom/test_iframe.js`
  * `tests/test_app/iframe_child/`

### 25. bro.steam
- **Category:** Platform / Steamworks
- **Feature Gate:** `BRO_WITH_STEAM`
- **Description:** Steamworks SDK runtime bindings (stats, achievements, overlay, auth)
- **Marshalling Shapes:** `dict/options`, `string`, `number`, `boolean`, `callback`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 1240 LOC
    `src/js/steam_bindings.cpp`: **1213** LOC<br>`src/js/steam_bindings.h`: **27** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 0 LOC
    *(none)*
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **1240 LOC**
- **Test Coverage Pointers:**
  * `tests/engine/test_steam.js`

### 26. bro.text
- **Category:** Typography & Text Diagnostics
- **Feature Gate:** `BRO_WITH_TEXT_SHAPING`
- **Description:** HarfBuzz cluster map diagnostics, shaped runs, bidi levels, glyph metrics
- **Marshalling Shapes:** `string (text)`, `object (clusters, glyphs, advance, bidi runs)`, `number`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 304 LOC
    `src/js/text_bindings.cpp`: **270** LOC<br>`src/js/text_bindings.h`: **34** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 0 LOC
    *(none)*
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **304 LOC**
- **Test Coverage Pointers:**
  * `tests/style/test_caret_clusters.js`
  * `tests/layout/test_bidi_conformance.js`

### 27. Rig / IK
- **Category:** Rigging & Inverse Kinematics
- **Feature Gate:** `BRO_WITH_3D`
- **Description:** Skeleton rig hierarchy, bone constraints, two-bone / FABRIK inverse kinematics solvers
- **Marshalling Shapes:** `handle (Rig, Skeleton, IKSolver)`, `vec3/quat`, `typedarray`, `dict/options`, `number`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 1521 LOC
    `src/js/rigging_bindings.cpp`: **1479** LOC<br>`src/js/rigging_bindings.h`: **42** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 0 LOC
    *(none)*
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **1521 LOC**
- **Test Coverage Pointers:**
  * `tests/rigging/probe_meshy.js`
  * `tests/rigging/diag_autorig_locomotion.js`

### 28. bro.server
- **Category:** Dedicated Server Host
- **Feature Gate:** `None`
- **Description:** Dedicated headless server runtime control, fixed-tickrate loop lifecycle
- **Marshalling Shapes:** `number (tickrate, uptime)`, `callback (tick loop)`, `dict/options`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 187 LOC
    `src/js/server_bindings.cpp`: **160** LOC<br>`src/js/server_bindings.h`: **27** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 0 LOC
    *(none)*
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **187 LOC**
- **Test Coverage Pointers:**
  * `tests/manual/net_roundtrip.js`

### 29. bro.settings
- **Category:** Settings Management
- **Feature Gate:** `None`
- **Description:** Three-layer configuration hierarchy (engine < app < user), persistent .bro_settings.json
- **Marshalling Shapes:** `dict/options (categories, keys/values)`, `string`, `number`, `boolean`, `callback (change listener)`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 583 LOC
    `src/js/settings_bindings.cpp`: **562** LOC<br>`src/js/settings_bindings.h`: **21** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 408 LOC
    `docs/settings.md`: **408** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **991 LOC**
- **Test Coverage Pointers:**
  * `tests/settings/test_settings.js`
  * `tests/settings/test_action_bindings.js`

### 30. bro.wake
- **Category:** Audio ML / Wake-Word
- **Feature Gate:** `BRO_WITH_SOUNDML`
- **Description:** Streaming neural wake-word detection pipeline with AGC audio tap
- **Marshalling Shapes:** `handle (WakeDetector)`, `typedarray (Float32Array)`, `number`, `callback (onWake)`, `dict/options`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 753 LOC
    `src/js/wake_bindings.cpp`: **686** LOC<br>`src/js/wake_bindings.h`: **67** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 3 LOC
    `src/js/feature_stubs.cpp` (L108-110): **3** LOC
  * **Docs:** 161 LOC
    `docs/wake-api.js`: **161** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **917 LOC**
- **Test Coverage Pointers:**
  * `tests/audio/test_wake.js`

### 31. bro.kws
- **Category:** Audio ML / Keyword Spotting
- **Feature Gate:** `BRO_WITH_SOUNDML`
- **Description:** Open-vocabulary streaming keyword spotting using shared ListenBus PhonemeNet features
- **Marshalling Shapes:** `handle (KwsDetector)`, `string (keywords)`, `typedarray (Float32Array)`, `number`, `callback (onSpot)`, `dict/options`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 1221 LOC
    `src/js/kws_bindings.cpp`: **1159** LOC<br>`src/js/kws_bindings.h`: **62** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 3 LOC
    `src/js/feature_stubs.cpp` (L111-113): **3** LOC
  * **Docs:** 304 LOC
    `docs/kws-api.js`: **304** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **1528 LOC**
- **Test Coverage Pointers:**
  * `tests/audio/test_kws.js`

### 32. bro.mic
- **Category:** Audio Capture
- **Feature Gate:** `None`
- **Description:** Live microphone capture with chunk callback, peak/RMS measurement, resampling and AGC
- **Marshalling Shapes:** `handle (MicTap)`, `typedarray (Float32Array)`, `number`, `callback (onData)`, `dict/options ({peak, rms})`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 479 LOC
    `src/js/mic_bindings.cpp`: **444** LOC<br>`src/js/mic_bindings.h`: **35** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 141 LOC
    `docs/mic-api.js`: **141** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **620 LOC**
- **Test Coverage Pointers:**
  * `tests/audio/test_mic_chunks.js`

### 33. bro.sense
- **Category:** Audio Sensor Hub
- **Feature Gate:** `BRO_WITH_SOUNDML`
- **Description:** Model-free acoustic sensors: VAD, spectral onset detector, tonality & pitch tracking
- **Marshalling Shapes:** `handle (SensorHub)`, `number`, `boolean`, `dict/options ({vad, onset, pitch, tonality})`, `callback`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 519 LOC
    `src/js/sense_bindings.cpp`: **465** LOC<br>`src/js/sense_bindings.h`: **54** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 3 LOC
    `src/js/feature_stubs.cpp` (L114-116): **3** LOC
  * **Docs:** 185 LOC
    `docs/sense-api.js`: **185** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **707 LOC**
- **Test Coverage Pointers:**
  * `tests/audio/test_sense.js`

### 34. bro.gesture
- **Category:** Audio Gesture Matching
- **Feature Gate:** `BRO_WITH_SOUNDML`
- **Description:** Non-speech acoustic gesture pattern matcher (rhythm and tonal frequency patterns)
- **Marshalling Shapes:** `handle (GestureMatcher)`, `string (pattern)`, `number`, `callback (onMatch)`, `dict/options`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 595 LOC
    `src/js/gesture_bindings.cpp`: **549** LOC<br>`src/js/gesture_bindings.h`: **46** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 3 LOC
    `src/js/feature_stubs.cpp` (L117-119): **3** LOC
  * **Docs:** 145 LOC
    `docs/gesture-api.js`: **145** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **743 LOC**
- **Test Coverage Pointers:**
  * `tests/audio/test_gesture.js`

### 35. bro.listen
- **Category:** Audio Stream Multiplexing
- **Feature Gate:** `BRO_WITH_SOUNDML`
- **Description:** N concurrent unmixed audio streams (mic, system loopback) with sensor/kws/wake attach
- **Marshalling Shapes:** `handle (ListenStream)`, `number`, `string`, `callback`, `dict/options`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 1142 LOC
    `src/js/listen_bindings.cpp`: **368** LOC<br>`src/js/listen_bindings.h`: **25** LOC<br>`src/js/listen_host.cpp`: **556** LOC<br>`src/js/listen_host.h`: **193** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 3 LOC
    `src/js/feature_stubs.cpp` (L120-122): **3** LOC
  * **Docs:** 137 LOC
    `docs/listen-api.js`: **137** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **1282 LOC**
- **Test Coverage Pointers:**
  * `tests/audio/test_listen.js`

### 36. Worker
- **Category:** Threading & Concurrency
- **Feature Gate:** `None`
- **Description:** W3C Web Workers with structured clone, ArrayBuffer transfer, and realm isolation
- **Marshalling Shapes:** `handle (Worker)`, `structured clone (objects, typed arrays, ArrayBuffer transfer)`, `callback (onmessage, onerror)`, `string`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 2049 LOC
    `src/js/worker.cpp`: **758** LOC<br>`src/js/worker.h`: **142** LOC<br>`src/js/message_serializer.cpp`: **1003** LOC<br>`src/js/message_serializer.h`: **32** LOC<br>`src/js/message_queue.h`: **114** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 320 LOC
    `docs/worker-api.js`: **320** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **2369 LOC**
- **Test Coverage Pointers:**
  * `tests/workers/test_basic.js`
  * `tests/workers/test_event_loop.js`

### 37. bro.ai (Game AI / NavMesh / MCTS)
- **Category:** Game AI & Pathfinding
- **Feature Gate:** `BRO_WITH_GAMEAI`
- **Description:** Game AI engine: NavMesh, 2D/3D NavGrid, crowd steering, perception, generic MCTS, NN learn
- **Marshalling Shapes:** `handle (NavMesh, NavGrid, Agent, MCTS, Prior, Evaluator)`, `vec2/vec3`, `typedarray (Float32Array)`, `dict/options`, `callback`, `number`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 10361 LOC
    `src/js/ai_bindings.cpp`: **4045** LOC<br>`src/js/ai_bindings.h`: **191** LOC<br>`src/js/ai_binding_integration.cpp`: **967** LOC<br>`src/js/ai_nn_bindings.cpp`: **1227** LOC<br>`src/js/ai_learn_bindings.cpp`: **867** LOC<br>`src/js/ai_belief_bindings.cpp`: **556** LOC<br>`src/js/ai_extras_bindings.cpp`: **584** LOC<br>`src/js/ai_generic_mcts_bindings.cpp`: **517** LOC<br>`src/js/ai_grid_bindings.cpp`: **1128** LOC<br>`src/js/ai_parallel_bindings.cpp`: **279** LOC
  * **bronze_host Bindings:** 1459 LOC
    `src/bronze_host/host_ai_core.cpp`: **123** LOC<br>`src/bronze_host/host_ai_navgrid.cpp`: **279** LOC<br>`src/bronze_host/host_ai_navmesh.cpp`: **346** LOC<br>`src/bronze_host/host_ai_agent.cpp`: **426** LOC<br>`src/bronze_host/host_ai_internal.h`: **285** LOC
  * **Availability Stubs:** 16 LOC
    `src/js/feature_stubs.cpp` (L161-167): **7** LOC<br>`src/js/feature_stubs.cpp` (L198-206): **9** LOC
  * **Docs:** 2191 LOC
    `docs/ai-game-api.js`: **2191** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **14027 LOC**
- **Test Coverage Pointers:**
  * `tests/aigame/test_agent_groundfollow.js`
  * `tests/aigame/test_navmesh.js`
  * `tests/bronze_host/appdir_ai/`

### 38. bro.gpu
- **Category:** System / Device Probe
- **Feature Gate:** `BRO_WITH_TENSOR`
- **Description:** Hardware acceleration probe (CUDA/CPU backend availability, device count, memory info)
- **Marshalling Shapes:** `dict/options ({available, backend, devices, compiledBackends})`, `string`, `number`, `boolean`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 248 LOC
    `src/js/gpu_bindings.cpp`: **227** LOC<br>`src/js/gpu_bindings.h`: **21** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 16 LOC
    `src/js/feature_stubs.cpp` (L59-74): **16** LOC
  * **Docs:** 161 LOC
    `docs/gpu-api.js`: **161** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **425 LOC**
- **Test Coverage Pointers:**
  * `tests/gpu/test_gpu_binding.js`

### 39. bro.appDir / bro.resolvePath
- **Category:** Filesystem Path Resolution
- **Feature Gate:** `None`
- **Description:** Resolves real filesystem paths for sidecar binaries, external CLI tools, and app asset mounts
- **Marshalling Shapes:** `string (file paths)`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 147 LOC
    `src/js/asset_path.cpp`: **87** LOC<br>`src/js/asset_path.h`: **60** LOC
  * **bronze_host Bindings:** 100 LOC
    `src/bronze_host/host_platform.cpp` (L1-100): **100** LOC *(resolvePath bridge)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 84 LOC
    `docs/paths-api.js`: **84** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **331 LOC**
- **Test Coverage Pointers:**
  * `tests/headless/test_app_paths.js`

### 40. bro.tensor
- **Category:** Machine Learning / Tensor Engine
- **Feature Gate:** `BRO_WITH_TENSOR`
- **Description:** GPU-accelerated tensor manipulation: matmul, convolutions, attention, activations, safetensors IO
- **Marshalling Shapes:** `handle (Tensor)`, `typedarray (Float32Array, Int32Array, Uint8Array)`, `array of dims/shape`, `number`, `string (dtype, device)`, `dict/options`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 4977 LOC
    `src/js/tensor_bindings.cpp`: **1146** LOC<br>`src/js/tensor_bindings_activations.cpp`: **399** LOC<br>`src/js/tensor_bindings_attention.cpp`: **799** LOC<br>`src/js/tensor_bindings_audio.cpp`: **858** LOC<br>`src/js/tensor_bindings_conv.cpp`: **714** LOC<br>`src/js/tensor_bindings_diffusion.cpp`: **99** LOC<br>`src/js/tensor_bindings_int8.cpp`: **459** LOC<br>`src/js/tensor_bindings_safetensors.cpp`: **278** LOC<br>`src/js/tensor_bindings_internal.h`: **225** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 3 LOC
    `src/js/feature_stubs.cpp` (L56-58): **3** LOC
  * **Docs:** 1402 LOC
    `docs/tensor-api.js`: **1402** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **6382 LOC**
- **Test Coverage Pointers:**
  * `tests/tensor/test_tensor_binding.js`

### 41. bro.diffusion
- **Category:** Machine Learning / Generative Vision
- **Feature Gate:** `BRO_WITH_DIFFUSION`
- **Description:** Diffusion text-to-image pipeline: U-Net / DiT / VAE step execution, LoRA loading, attention tracing
- **Marshalling Shapes:** `handle (DiffusionPipeline)`, `promise`, `dict/options (step options, LoRA)`, `typedarray (latents, images)`, `string`, `number`, `callback (progress)`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 1980 LOC
    `src/js/diffusion_bindings.cpp`: **1746** LOC<br>`src/js/diffusion_bindings.h`: **37** LOC<br>`src/js/async_job.cpp`: **125** LOC<br>`src/js/async_job.h`: **72** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 3 LOC
    `src/js/feature_stubs.cpp` (L86-88): **3** LOC
  * **Docs:** 701 LOC
    `docs/diffusion-api.js`: **701** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **2684 LOC**
- **Test Coverage Pointers:**
  * `tests/diffusion/test_diffusion_binding.js`

### 42. bro.lm (Large Language Models)
- **Category:** Machine Learning / LLMs
- **Feature Gate:** `BRO_WITH_LM`
- **Description:** LLM inference engine: token generation, streaming callbacks, chat templates, sampling parameters
- **Marshalling Shapes:** `handle (LanguageModel, Tokenizer)`, `promise`, `string`, `typedarray`, `dict/options`, `callback (stream tokens)`, `number`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 3272 LOC
    `src/js/lm_bindings.cpp`: **3050** LOC<br>`src/js/lm_bindings.h`: **25** LOC<br>`src/js/async_job.cpp`: **125** LOC<br>`src/js/async_job.h`: **72** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 5 LOC
    `src/js/feature_stubs.cpp` (L78-82): **5** LOC
  * **Docs:** 561 LOC
    `docs/lm-api.js`: **561** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **3838 LOC**
- **Test Coverage Pointers:**
  * `tests/lm/test_lm_binding.js`

### 43. bro.stt
- **Category:** Machine Learning / Speech-to-Text
- **Feature Gate:** `BRO_WITH_SOUNDML`
- **Description:** Whisper / Parakeet / Qwen3-ASR speech recognition inference with word-level timestamps
- **Marshalling Shapes:** `handle (STTModel)`, `promise`, `typedarray (Float32Array PCM)`, `string`, `dict/options (timestamps, segments)`, `callback`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 2658 LOC
    `src/js/stt_bindings.cpp`: **2436** LOC<br>`src/js/stt_bindings.h`: **25** LOC<br>`src/js/async_job.cpp`: **125** LOC<br>`src/js/async_job.h`: **72** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 1 LOC
    `src/js/feature_stubs.cpp` (L104-104): **1** LOC
  * **Docs:** 458 LOC
    `docs/stt-api.js`: **458** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **3117 LOC**
- **Test Coverage Pointers:**
  * `tests/stt/test_stt_binding.js`

### 44. bro.diar
- **Category:** Machine Learning / Diarization
- **Feature Gate:** `BRO_WITH_SOUNDML`
- **Description:** Streaming Sortformer & ClusterDiarizer speaker diarization and voice clustering
- **Marshalling Shapes:** `handle (Diarizer)`, `promise`, `typedarray (Float32Array PCM)`, `dict/options (speakers, segments)`, `callback`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 1015 LOC
    `src/js/diar_bindings.cpp`: **793** LOC<br>`src/js/diar_bindings.h`: **25** LOC<br>`src/js/async_job.cpp`: **125** LOC<br>`src/js/async_job.h`: **72** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 1 LOC
    `src/js/feature_stubs.cpp` (L106-106): **1** LOC
  * **Docs:** 225 LOC
    `docs/diar-api.js`: **225** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **1241 LOC**
- **Test Coverage Pointers:**
  * `tests/diar/test_diar_binding.js`

### 45. bro.tts
- **Category:** Machine Learning / Text-to-Speech
- **Feature Gate:** `BRO_WITH_SOUNDML`
- **Description:** Kokoro (phoneme) & Qwen3-TTS neural text-to-speech generation to 24 kHz PCM audio
- **Marshalling Shapes:** `handle (TTSModel)`, `promise`, `string (text, voice)`, `typedarray (Float32Array PCM)`, `dict/options`, `callback (stream PCM)`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 3382 LOC
    `src/js/tts_bindings.cpp`: **3142** LOC<br>`src/js/tts_bindings.h`: **43** LOC<br>`src/js/async_job.cpp`: **125** LOC<br>`src/js/async_job.h`: **72** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 1 LOC
    `src/js/feature_stubs.cpp` (L105-105): **1** LOC
  * **Docs:** 675 LOC
    `docs/tts-api.js`: **675** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **4058 LOC**
- **Test Coverage Pointers:**
  * `tests/tts/test_tts_binding.js`

### 46. bro.rave
- **Category:** Machine Learning / Audio Neural Codec
- **Feature Gate:** `BRO_WITH_SOUNDML`
- **Description:** RAVE neural audio autoencoder for real-time latent audio representation and editing
- **Marshalling Shapes:** `handle (RaveModel)`, `promise`, `typedarray (Float32Array PCM, latents)`, `dict/options`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 586 LOC
    `src/js/rave_bindings.cpp`: **358** LOC<br>`src/js/rave_bindings.h`: **31** LOC<br>`src/js/async_job.cpp`: **125** LOC<br>`src/js/async_job.h`: **72** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 1 LOC
    `src/js/feature_stubs.cpp` (L107-107): **1** LOC
  * **Docs:** 161 LOC
    `docs/rave-api.js`: **161** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **748 LOC**
- **Test Coverage Pointers:**
  * `tests/rave/test_rave_binding.js`

### 47. bro.vision
- **Category:** Machine Learning / Vision AI
- **Feature Gate:** `BRO_WITH_VISION`
- **Description:** Vision models: Segment Anything (SAM), Depth Anything V2, DSINE surface normals, BiRefNet matting
- **Marshalling Shapes:** `handle (VisionModel)`, `promise`, `typedarray (Uint8Array, Float32Array)`, `dict/options (points, boxes, masks)`, `number`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 2854 LOC
    `src/js/vision_bindings.cpp`: **2625** LOC<br>`src/js/vision_bindings.h`: **32** LOC<br>`src/js/async_job.cpp`: **125** LOC<br>`src/js/async_job.h`: **72** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 4 LOC
    `src/js/feature_stubs.cpp` (L97-100): **4** LOC
  * **Docs:** 401 LOC
    `docs/vision-api.js`: **401** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **3259 LOC**
- **Test Coverage Pointers:**
  * `tests/vision/test_vision_binding.js`

### 48. bro.triposplat
- **Category:** Machine Learning / 3D Gaussian Splatting
- **Feature Gate:** `BRO_WITH_TRIPOSPLAT`
- **Description:** Single-image to 3D Gaussian splat generation
- **Marshalling Shapes:** `handle (TripoSplatModel)`, `promise`, `typedarray (image buffer in, splat buffer out)`, `dict/options`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 854 LOC
    `src/js/triposplat_bindings.cpp`: **635** LOC<br>`src/js/triposplat_bindings.h`: **22** LOC<br>`src/js/async_job.cpp`: **125** LOC<br>`src/js/async_job.h`: **72** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 4 LOC
    `src/js/feature_stubs.cpp` (L180-183): **4** LOC
  * **Docs:** 124 LOC
    `docs/triposplat-api.js`: **124** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **982 LOC**
- **Test Coverage Pointers:**
  * `tests/triposplat/test_triposplat_binding.js`

### 49. bro.worldgen
- **Category:** Machine Learning / Learned Terrain
- **Feature Gate:** `BRO_WITH_DIFFUSION`
- **Description:** Learned neural elevation field terrain generation
- **Marshalling Shapes:** `handle (WorldgenModel)`, `promise`, `typedarray (Float32Array elevation)`, `number (coords, seed)`, `dict/options`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 1033 LOC
    `src/js/worldgen_bindings.cpp`: **782** LOC<br>`src/js/worldgen_bindings.h`: **54** LOC<br>`src/js/async_job.cpp`: **125** LOC<br>`src/js/async_job.h`: **72** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 5 LOC
    `src/js/feature_stubs.cpp` (L89-93): **5** LOC
  * **Docs:** 215 LOC
    `docs/worldgen-api.js`: **215** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **1253 LOC**
- **Test Coverage Pointers:**
  * `tests/worldgen/test_worldgen_stage.js`

### 50. bro.motion
- **Category:** Machine Learning / Motion Generation
- **Feature Gate:** `BRO_WITH_DIFFUSION && BRO_WITH_LM`
- **Description:** ARDY text-to-motion generative model for humanoid skeletal joint animation
- **Marshalling Shapes:** `handle (MotionModel)`, `promise`, `string (prompt)`, `typedarray (Float32Array joint angles)`, `dict/options`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 564 LOC
    `src/js/motion_bindings.cpp`: **336** LOC<br>`src/js/motion_bindings.h`: **31** LOC<br>`src/js/async_job.cpp`: **125** LOC<br>`src/js/async_job.h`: **72** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 6 LOC
    `src/js/feature_stubs.cpp` (L187-192): **6** LOC
  * **Docs:** 168 LOC
    `docs/motion-api.js`: **168** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **738 LOC**
- **Test Coverage Pointers:**
  * `tests/motion/test_motion_binding.js`

### 51. Physics (Jolt Physics)
- **Category:** Rigid Body Physics
- **Feature Gate:** `BRO_WITH_PHYSICS`
- **Description:** Jolt physics: rigid bodies, collision shapes, raycasts, contact callbacks, character controller, vehicles
- **Marshalling Shapes:** `handle (Body, Shape, World, Character, Constraint, SoftBody)`, `vec3/quat`, `color`, `dual array/object`, `callback (contacts)`, `dict/options (raycast, body config)`, `typedarray`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 4170 LOC
    `src/js/physics_bindings.cpp`: **4136** LOC<br>`src/js/physics_bindings.h`: **34** LOC
  * **bronze_host Bindings:** 2350 LOC
    `src/bronze_host/host_physics_core.cpp`: **543** LOC<br>`src/bronze_host/host_physics_constraints.cpp`: **496** LOC<br>`src/bronze_host/host_physics_character.cpp`: **155** LOC<br>`src/bronze_host/host_physics_softbody.cpp`: **196** LOC<br>`src/bronze_host/host_physics_queries.cpp`: **265** LOC<br>`src/bronze_host/host_physics_internal.h`: **695** LOC
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 1966 LOC
    `docs/physics-api.js`: **1966** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **8486 LOC**
- **Test Coverage Pointers:**
  * `tests/physics/test_character.js`
  * `tests/physics/test_body_props.js`
  * `tests/bronze_host/appdir_physics/`

### 52. scene.createTerrain
- **Category:** Heightfield Terrain
- **Feature Gate:** `BRO_WITH_3D`
- **Description:** Chunked height-field terrain streaming, procedural height generator, surface edits, raycast
- **Marshalling Shapes:** `handle (Terrain)`, `typedarray (Float32Array heights, edits)`, `vec3`, `dict/options`, `number`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 482 LOC
    `src/js/terrain_bindings.cpp`: **446** LOC<br>`src/js/terrain_bindings.h`: **36** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 286 LOC
    `docs/terrain-api.js`: **286** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **768 LOC**
- **Test Coverage Pointers:**
  * `tests/scene/test_terrain.js`

### 53. scene.createClipmapTerrain
- **Category:** GPU Clipmap Terrain
- **Feature Gate:** `BRO_WITH_3D`
- **Description:** Camera-centered GPU clipmap terrain with concentric ring meshes and streamed height pyramids
- **Marshalling Shapes:** `handle (ClipmapTerrain)`, `dict/options (pyramid, rings)`, `vec3`, `number`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 556 LOC
    `src/js/clipmap_bindings.cpp`: **532** LOC<br>`src/js/clipmap_bindings.h`: **24** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 506 LOC
    `docs/clipmap-api.js`: **506** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **1062 LOC**
- **Test Coverage Pointers:**
  * `tests/scene/test_clipmap.js`

### 54. scene.createTileWorld
- **Category:** Tile World & Meshing
- **Feature Gate:** `BRO_WITH_3D`
- **Description:** Hexagonal and square tile-grid meshing, multi-layer elevation, cliffs, ambient occlusion
- **Marshalling Shapes:** `handle (TileWorld)`, `typedarray (tile buffers)`, `vec3`, `dict/options`, `number`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 1121 LOC
    `src/js/tile_bindings.cpp`: **1091** LOC<br>`src/js/tile_bindings.h`: **30** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 504 LOC
    `docs/tile-api.js`: **504** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **1625 LOC**
- **Test Coverage Pointers:**
  * `tests/scene/test_tile_world.js`

### 55. Canvas 2D Context
- **Category:** 2D Graphics Rendering
- **Feature Gate:** `None`
- **Description:** W3C HTML Canvas 2D rendering context, path drawing, image rasterization, gradients
- **Marshalling Shapes:** `handle (CanvasRenderingContext2D, CanvasGradient, ImageData)`, `typedarray (Uint8ClampedArray)`, `color`, `number`, `string`, `dict/options`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 836 LOC
    `src/js/canvas_bindings.cpp`: **817** LOC<br>`src/js/canvas_bindings.h`: **19** LOC
  * **bronze_host Bindings:** 82 LOC
    `src/bronze_host/host_canvas2d.cpp`: **72** LOC<br>`src/bronze_host/host_canvas2d.h`: **10** LOC
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 0 LOC
    *(none)*
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 52 LOC
    `src/js/headless_bindings.cpp` (L109-160): **52** LOC *(screenshotCanvas)*
- **Total Copy Tax:** **970 LOC**
- **Test Coverage Pointers:**
  * `tests/canvas/test_canvas2d.js`
  * `tests/canvas/test_canvas_advanced.js`
  * `tests/bronze_host/appdir_dom/`

### 56. WebGL2RenderingContext
- **Category:** GPU 3D Pipeline
- **Feature Gate:** `None`
- **Description:** WebGL 2.0 (OpenGL 3.3 Core via glad) rendering context, shaders, buffers, VAOs, textures, FBOs
- **Marshalling Shapes:** `handle (WebGLBuffer, WebGLShader, WebGLProgram, WebGLTexture, WebGLFramebuffer, WebGLVAO)`, `typedarray (all TypedArrays)`, `number (enums, sizes)`, `string (GLSL source)`, `boolean`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 3610 LOC
    `src/js/webgl2_bindings.cpp`: **657** LOC<br>`src/js/webgl2_bindings_state.cpp`: **345** LOC<br>`src/js/webgl2_bindings_buffers.cpp`: **373** LOC<br>`src/js/webgl2_bindings_shaders.cpp`: **646** LOC<br>`src/js/webgl2_bindings_textures.cpp`: **362** LOC<br>`src/js/webgl2_bindings_framebuffers.cpp`: **278** LOC<br>`src/js/webgl2_bindings_queries.cpp`: **305** LOC<br>`src/js/webgl2_bindings_objects.cpp`: **301** LOC<br>`src/js/webgl2_bindings.h`: **22** LOC<br>`src/js/webgl2_bindings_util.h`: **321** LOC
  * **bronze_host Bindings:** 2716 LOC
    `src/bronze_host/gl_constants.cpp`: **513** LOC<br>`src/bronze_host/gl_state.cpp`: **177** LOC<br>`src/bronze_host/gl_buffers.cpp`: **159** LOC<br>`src/bronze_host/gl_shaders.cpp`: **336** LOC<br>`src/bronze_host/gl_textures.cpp`: **347** LOC<br>`src/bronze_host/gl_framebuffers.cpp`: **183** LOC<br>`src/bronze_host/gl_queries.cpp`: **324** LOC<br>`src/bronze_host/gl_context.cpp`: **62** LOC<br>`src/bronze_host/gl_profile.cpp`: **187** LOC<br>`src/bronze_host/gl_profile.h`: **45** LOC<br>`src/bronze_host/gl_internal.h`: **383** LOC
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 100 LOC
    `docs/headless.md` (L1-100): **100** LOC *(WebGL2 support matrix)*
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **6426 LOC**
- **Test Coverage Pointers:**
  * `tests/webgl/test_webgl_basic.js`
  * `tests/webgl/test_webgl_buffers.js`
  * `tests/bronze_host/appdir_instanced/`
  * `tests/bronze_host/appdir_pixi/`

### 57. customElements
- **Category:** Web Components
- **Feature Gate:** `None`
- **Description:** Custom element registry (customElements.define, lifecycle callbacks, observedAttributes)
- **Marshalling Shapes:** `string (tag name)`, `class constructor callback (define)`, `dict/options`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 512 LOC
    `src/js/custom_elements.cpp`: **463** LOC<br>`src/js/custom_elements.h`: **49** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 0 LOC
    *(none)*
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **512 LOC**
- **Test Coverage Pointers:**
  * `tests/custom_elements/test_define.js`
  * `tests/custom_elements/test_attributes.js`

### 58. MutationObserver / ResizeObserver
- **Category:** DOM Observers
- **Feature Gate:** `None`
- **Description:** W3C DOM MutationObserver and ResizeObserver interfaces with microtask batching
- **Marshalling Shapes:** `handle (Observer)`, `callback`, `array of record objects ({type, target, addedNodes, removedNodes, contentRect})`, `element handle`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 331 LOC
    `src/js/mutation_observer.cpp`: **184** LOC<br>`src/js/js/observer_polyfills.js`: **147** LOC
  * **bronze_host Bindings:** 609 LOC
    `src/bronze_host/host_observers.cpp`: **609** LOC
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 0 LOC
    *(none)*
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **940 LOC**
- **Test Coverage Pointers:**
  * `tests/dom/test_mutation_observer.js`
  * `tests/bronze_host/appdir_observer/`

### 59. DOMParser
- **Category:** XML / HTML Parser
- **Feature Gate:** `None`
- **Description:** W3C DOMParser interface parsing text/html and application/xml into a DOM Document
- **Marshalling Shapes:** `handle (DOMParser)`, `string (source, mime)`, `returns Document handle`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 259 LOC
    `src/js/html_interfaces.cpp`: **224** LOC<br>`src/js/html_interfaces.h`: **35** LOC
  * **bronze_host Bindings:** 128 LOC
    `src/bronze_host/host_parser.cpp`: **128** LOC
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 0 LOC
    *(none)*
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **387 LOC**
- **Test Coverage Pointers:**
  * `tests/dom/test_dom_parser.js`
  * `tests/bronze_host/appdir_parser/`

### 60. AbortController / AbortSignal
- **Category:** Async Cancellation
- **Feature Gate:** `None`
- **Description:** W3C AbortController and AbortSignal cancellation tokens for async operations & fetch
- **Marshalling Shapes:** `handle (AbortController, AbortSignal)`, `boolean (aborted)`, `callback (onabort / EventListener)`, `any (reason)`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 19 LOC
    `third_party/brokit/src/api/abort.cpp`: **19** LOC
  * **bronze_host Bindings:** 281 LOC
    `src/bronze_host/host_abort.cpp`: **281** LOC
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 0 LOC
    *(none)*
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **300 LOC**
- **Test Coverage Pointers:**
  * `tests/brokit/test_abort.js`
  * `tests/bronze_host/appdir_abort/`

### 61. Intl (ECMA-402)
- **Category:** Internationalization
- **Feature Gate:** `None`
- **Description:** ECMA-402 Intl polyfill: PluralRules, NumberFormat, DateTimeFormat, Collator, DisplayNames
- **Marshalling Shapes:** `string`, `number`, `dict/options`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 714 LOC
    `src/js/js/intl_polyfill.js`: **714** LOC
  * **bronze_host Bindings:** 98 LOC
    `src/bronze_host/dom_globals.cpp` (L995-1092): **98** LOC *(Intl object builder)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 0 LOC
    *(none)*
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **812 LOC**
- **Test Coverage Pointers:**
  * `tests/intl/test_intl.js`

### 62. Vendor Globals (CodeMirror, acorn, etc.)
- **Category:** Vendored Library Bridges
- **Feature Gate:** `None`
- **Description:** AOT host global bindings for compiled editors/parsers: CodeMirror, acorn, tern, esprima, jsonlint, draco_encoder, signals
- **Marshalling Shapes:** `object`, `function`, `string`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 0 LOC
    *(none)*
  * **bronze_host Bindings:** 82 LOC
    `src/bronze_host/host_vendor_globals.cpp`: **75** LOC<br>`src/bronze_host/web_host.globals` (L118-124): **7** LOC *(Vendor globals manifest entries)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 0 LOC
    *(none)*
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **82 LOC**
- **Test Coverage Pointers:**
  * `tests/bronze_host/appdir_codecs/`

### 63. brokit (System & Web APIs)
- **Category:** Node / Web Core Runtime
- **Feature Gate:** `None`
- **Description:** brokit runtime: fs, path, os, child_process, crypto, fetch, storage, stream, console
- **Marshalling Shapes:** `handle (Stream, Request, Response, Headers, Socket, Process)`, `typedarray (Buffer, Uint8Array)`, `dict/options`, `promise`, `callback`, `string`, `number`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 7151 LOC
    `third_party/brokit/src/api/api.cpp`: **323** LOC<br>`third_party/brokit/src/api/crypto.cpp`: **120** LOC<br>`third_party/brokit/src/api/crypto_subtle.cpp`: **799** LOC<br>`third_party/brokit/src/api/encoding.cpp`: **99** LOC<br>`third_party/brokit/src/api/eventsource.cpp`: **20** LOC<br>`third_party/brokit/src/api/fetch.cpp`: **1028** LOC<br>`third_party/brokit/src/api/fetch_classes.cpp`: **20** LOC<br>`third_party/brokit/src/api/formdata.cpp`: **20** LOC<br>`third_party/brokit/src/api/fs.cpp`: **1103** LOC<br>`third_party/brokit/src/api/fs_watch.cpp`: **270** LOC<br>`third_party/brokit/src/api/indexeddb.cpp`: **625** LOC<br>`third_party/brokit/src/api/indexeddb_js.cpp`: **20** LOC<br>`third_party/brokit/src/api/message_channel.cpp`: **20** LOC<br>`third_party/brokit/src/api/navigator.cpp`: **20** LOC<br>`third_party/brokit/src/api/net.cpp`: **942** LOC<br>`third_party/brokit/src/api/os.cpp`: **141** LOC<br>`third_party/brokit/src/api/path.cpp`: **19** LOC<br>`third_party/brokit/src/api/process.cpp`: **239** LOC<br>`third_party/brokit/src/api/readable_stream.cpp`: **20** LOC<br>`third_party/brokit/src/api/storage.cpp`: **270** LOC<br>`third_party/brokit/src/api/structuredclone.cpp`: **20** LOC<br>`third_party/brokit/src/api/timers.cpp`: **19** LOC<br>`third_party/brokit/src/api/treewalker.cpp`: **20** LOC<br>`third_party/brokit/src/api/url.cpp`: **19** LOC<br>`third_party/brokit/src/api/util.cpp`: **19** LOC<br>`third_party/brokit/src/api/websocket.cpp`: **564** LOC<br>`third_party/brokit/src/api/writable_stream.cpp`: **20** LOC<br>`src/js/storage_bindings.cpp`: **331** LOC<br>`src/js/storage_bindings.h`: **21** LOC
  * **bronze_host Bindings:** 1389 LOC
    `src/bronze_host/host_fetch.cpp`: **524** LOC<br>`src/bronze_host/host_xhr.cpp`: **383** LOC<br>`src/bronze_host/dom_storage.cpp`: **209** LOC<br>`src/bronze_host/host_timers.cpp`: **273** LOC
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 856 LOC
    `docs/brokit-api.js`: **856** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **9396 LOC**
- **Test Coverage Pointers:**
  * `tests/brokit/test_child_process.js`
  * `tests/brokit/test_fetch.js`
  * `tests/bronze_host/appdir_fetch/`

### 64. Headless Injection & Test Surface
- **Category:** Headless Test Framework
- **Feature Gate:** `None`
- **Description:** Driver globals (screenshot, advanceTime, assert, simulated inputs, inspection, __host)
- **Marshalling Shapes:** `string`, `number`, `boolean`, `dict/options`, `callback/listener handle`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 1587 LOC
    `src/js/headless_bindings.cpp`: **1548** LOC<br>`src/js/headless_bindings.h`: **39** LOC
  * **bronze_host Bindings:** 0 LOC
    *(none)*
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 925 LOC
    `docs/headless.md`: **710** LOC<br>`docs/inspect.md`: **215** LOC
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 1251 LOC
    `src/headless/main.cpp`: **443** LOC<br>`src/engine/headless_driver.cpp`: **731** LOC<br>`src/engine/headless_driver.h`: **77** LOC
- **Total Copy Tax:** **3763 LOC**
- **Test Coverage Pointers:**
  * `tests/headless/test_app_paths.js`
  * `tests/scene/test_host_scene_context.js`

### 65. DOM Core (Element / Node / Document)
- **Category:** DOM Core Machinery (Out of Scope for M1-M6)
- **Feature Gate:** `None`
- **Description:** Core DOM nodes, elements, layout binding, attributes, styles, selectors (deeply entangled with gumbo/htmlayout)
- **Marshalling Shapes:** `handle (Element, Node, Document, Range, Selection, CSSStyleDeclaration)`, `string`, `number`, `boolean`, `dict/options`, `callback`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 9609 LOC
    `src/js/dom_bindings.cpp`: **745** LOC<br>`src/js/dom_bindings.h`: **120** LOC<br>`src/js/dom_bindings_internal.h`: **211** LOC<br>`src/js/element_bindings.cpp`: **4944** LOC<br>`src/js/node_bindings.cpp`: **866** LOC<br>`src/js/document_bindings.cpp`: **565** LOC<br>`src/js/range_bindings.cpp`: **461** LOC<br>`src/js/selection_bindings.cpp`: **231** LOC<br>`src/js/shadowroot_bindings.cpp`: **299** LOC<br>`src/js/style_bindings.cpp`: **542** LOC<br>`src/js/js/dom_polyfills.js`: **580** LOC<br>`src/js/js/dataset_proxy.js`: **45** LOC
  * **bronze_host Bindings:** 2053 LOC
    `src/bronze_host/host_element.cpp`: **821** LOC<br>`src/bronze_host/host_element_style.cpp`: **278** LOC<br>`src/bronze_host/host_element_dataset.cpp`: **221** LOC<br>`src/bronze_host/host_element_forms.cpp`: **192** LOC<br>`src/bronze_host/host_node.cpp`: **541** LOC
  * **Availability Stubs:** 0 LOC
    *(none)*
  * **Docs:** 0 LOC
    *(none)*
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **11662 LOC**
- **Test Coverage Pointers:**
  * `tests/dom/test_append_remove.js`
  * `tests/gc/test_node_wrapper_invalidation.js`
  * `tests/bronze_host/appdir_dom/`

### 66. Runtime Core & Interp Bridge
- **Category:** Runtime Machinery (Out of Scope for M1-M6)
- **Feature Gate:** `None`
- **Description:** QuickJS runtime lifecycle, bronze HostClass / HostProxy, interpreter bridge, GC contracts
- **Marshalling Shapes:** `Engine JSValue / bronze Value internal machinery`
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** 1521 LOC
    `src/js/runtime.cpp`: **823** LOC<br>`src/js/runtime.h`: **208** LOC<br>`src/js/timers.cpp`: **366** LOC<br>`src/js/timers.h`: **124** LOC
  * **bronze_host Bindings:** 2784 LOC
    `src/bronze_host/host_class.cpp`: **127** LOC<br>`src/bronze_host/host_proxy.cpp`: **192** LOC<br>`src/bronze_host/host_interp.cpp`: **1298** LOC<br>`src/bronze_host/host_interp.h`: **75** LOC<br>`src/bronze_host/host_internal.h`: **733** LOC<br>`src/bronze_host/bronze_host.h`: **37** LOC<br>`src/bronze_host/app_module.cpp`: **227** LOC<br>`src/bronze_host/app_module.h`: **95** LOC
  * **Availability Stubs:** 48 LOC
    `src/js/feature_stub.h`: **48** LOC
  * **Docs:** 0 LOC
    *(none)*
  * **TypeScript / App Defs:** 0 LOC *(to be emitted by M3)*
  * **Headless Injection:** 0 LOC
    *(none)*
- **Total Copy Tax:** **4353 LOC**
- **Test Coverage Pointers:**
  * `tests/gc/test_create_remove_cycle.js`
  * `tests/bronze_host/appdir_interp/`

---

## 5. Serial-Core Marshalling Vocabulary Census

Across all **66** engine surfaces, the census reveals a finite, closed set of cross-boundary marshalling patterns that the IDL schema must support first-class:

1. **Vectors & Geometric Types (Dual Accept)**: `vec2`, `vec3`, `vec4`, `quat`, `mat4`, `color`. Accepted as `{x,y,z}` / `{r,g,b,a}` objects *or* flat arrays `[x,y,z]` on input; always emitted as objects on return.
2. **Typed Arrays with Byte/Layout Contracts**: `Float32Array`, `Uint8Array`, `Uint8ClampedArray`, `Int32Array`, `ArrayBuffer`. Used for noise lattices, image pixels, audio PCM, mesh geometry, and neural tensors.
3. **Opaque Native Handles**: Native object pointer wrappers (e.g. `FastNoise`, `HostBlob`, `SceneGraph`, `SceneNode`, `Mesh`, `AudioContext`, `AudioNode`, `PhysicsWorld`, `Body`, `Tensor`, `LanguageModel`).
4. **Structured Dictionaries & Option Objects**: Options with default values (e.g. step options, sampling configs, noise settings, dialog filters).
5. **Asynchronous Promises**: Promises for async engine jobs (e.g. `blob.text()`, `blob.arrayBuffer()`, `createImageBitmap()`, `lm.generate()`, `diffusion.generate()`, `stt.transcribe()`).
6. **Callbacks & Event Listeners**: Function values for streaming tokens, audio frame callbacks, contact notifications, and DOM 3-phase events.
7. **Enum Strings & Primitive Scalars**: Numbers (`f32`, `f64`, `i32`, `u32`, `u64`), booleans, and string literal union enums.

---

## 6. Spot-Check Verifications (5 Surfaces)

The following 5 spot checks verify line counts directly against the reference code in `D:/projects/bro`:

### Spot Check 1: bro.noise (FastNoise)
- **Feature Gate:** `None`
- **QuickJS Files:**
  * `third_party/brokit/src/api/noise.cpp`: **811** LOC
  * *QuickJS Subtotal:* **811** LOC
- **bronze_host Files:**
  * *(none)*: 0 LOC
- **Availability Stubs:**
  * *(none)*: 0 LOC
- **Documentation Files:**
  * `docs/noise-api.js`: **797** LOC
  * *Docs Subtotal:* **797** LOC
- **Headless Injection:**
  * *(none)*: 0 LOC
- **Total Five-Copy Tax:** **1608 LOC**

### Spot Check 2: bro.time
- **Feature Gate:** `None`
- **QuickJS Files:**
  * `src/js/time_bindings.cpp`: **104** LOC
  * `src/js/time_bindings.h`: **24** LOC
  * *QuickJS Subtotal:* **128** LOC
- **bronze_host Files:**
  * `src/bronze_host/dom_globals.cpp` (L818-821): **4** LOC
  * *bronze_host Subtotal:* **4** LOC
- **Availability Stubs:**
  * *(none)*: 0 LOC
- **Documentation Files:**
  * `docs/time-api.js`: **96** LOC
  * *Docs Subtotal:* **96** LOC
- **Headless Injection:**
  * `src/js/headless_bindings.cpp` (L162-172): **11** LOC
  * *Headless Subtotal:* **11** LOC
- **Total Five-Copy Tax:** **239 LOC**

### Spot Check 3: Blob / File / FileReader / URL
- **Feature Gate:** `None`
- **QuickJS Files:**
  * `third_party/brokit/src/api/blob.cpp`: **531** LOC
  * `src/js/js/file_polyfills.js`: **319** LOC
  * `src/js/anchor_download.cpp`: **158** LOC
  * `src/js/anchor_download.h`: **37** LOC
  * *QuickJS Subtotal:* **1045** LOC
- **bronze_host Files:**
  * `src/bronze_host/host_file.cpp`: **1116** LOC
  * *bronze_host Subtotal:* **1116** LOC
- **Availability Stubs:**
  * *(none)*: 0 LOC
- **Documentation Files:**
  * `docs/file-api.js`: **260** LOC
  * *Docs Subtotal:* **260** LOC
- **Headless Injection:**
  * `src/js/headless_bindings.cpp` (L622-662): **41** LOC
  * *Headless Subtotal:* **41** LOC
- **Total Five-Copy Tax:** **2462 LOC**

### Spot Check 4: bro.flora
- **Feature Gate:** `BRO_WITH_FLORA`
- **QuickJS Files:**
  * `src/js/flora_bindings.cpp`: **375** LOC
  * `src/js/flora_bindings.h`: **30** LOC
  * `src/js/flora_bindings_emit.cpp`: **525** LOC
  * `src/js/flora_bindings_internal.h`: **384** LOC
  * *QuickJS Subtotal:* **1314** LOC
- **bronze_host Files:**
  * *(none)*: 0 LOC
- **Availability Stubs:**
  * `src/js/feature_stubs.cpp` (L126-131): **6** LOC (`#if !BRO_WITH_FLORA`)
  * *Stubs Subtotal:* **6** LOC
- **Documentation Files:**
  * `docs/flora-api.js`: **501** LOC
  * *Docs Subtotal:* **501** LOC
- **Headless Injection:**
  * *(none)*: 0 LOC
- **Total Five-Copy Tax:** **1821 LOC**

### Spot Check 5: bro.lm (Large Language Models)
- **Feature Gate:** `BRO_WITH_LM`
- **QuickJS Files:**
  * `src/js/lm_bindings.cpp`: **3050** LOC
  * `src/js/lm_bindings.h`: **25** LOC
  * `src/js/async_job.cpp`: **125** LOC
  * `src/js/async_job.h`: **72** LOC
  * *QuickJS Subtotal:* **3272** LOC
- **bronze_host Files:**
  * *(none)*: 0 LOC
- **Availability Stubs:**
  * `src/js/feature_stubs.cpp` (L78-82): **5** LOC (`#if !BRO_WITH_LM`)
  * *Stubs Subtotal:* **5** LOC
- **Documentation Files:**
  * `docs/lm-api.js`: **561** LOC
  * *Docs Subtotal:* **561** LOC
- **Headless Injection:**
  * *(none)*: 0 LOC
- **Total Five-Copy Tax:** **3838 LOC**

