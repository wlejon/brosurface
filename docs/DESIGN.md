# brosurface — Serial-Core Design Document

Status: Approved / Authoritative  
Applies to: brosurface schema, emitters (qjsbind, bronze_host, .d.ts, docs, stubs), and runtime bridges  
Reference: [SPEC.md §5](file:///D:/projects/brosurface/SPEC.md) & [WORK-ORDER-1.md M2](file:///D:/projects/brosurface/WORK-ORDER-1.md)

---

## 1. Marshalling Vocabulary

### 1.1 Finite Vocabulary Rule
An IDL system that permits arbitrary, per-API custom serialization fails the maintenance and cross-target uniformity requirements. Based on the machine extraction in `docs/SURFACE-INVENTORY.md`, the cross-boundary data shapes used across all 66 engine surfaces are frozen to the following finite set:

| Shape Category | Types | JS Input Contract | JS Output / Return Contract | Target C++ Type (QuickJS) | Target C++ Type (Bronze Host) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Scalar Primitives** | `boolean`, `int32`, `uint32`, `int64`, `uint64`, `float`, `double`, `string` | Strict type conversion via `JS_To*` / `ev::to*` | Primitive value (`JS_New*` / `ev::from*`) | `bool`, `int32_t`, `uint32_t`, `int64_t`, `uint64_t`, `float`, `double`, `std::string` | `bool`, `int32_t`, `uint32_t`, `int64_t`, `uint64_t`, `float`, `double`, `std::string` |
| **Dual Accept Vectors** | `vec2`, `vec3`, `vec4` | **Dual accept**: `{x,y,[z,w]}` plain object OR `[x,y,[z,w]]` array | Plain object `{x, y, z, w}` | `bromath::Vec2`, `bromath::Vec3`, `bromath::Vec4` | `bromath::Vec2`, `bromath::Vec3`, `bromath::Vec4` |
| **Colors** | `color`, `Color8` | Object `{r,g,b,a}` (floats 0..1 or uint8 0..255) | Object `{r,g,b,a}` | `bromath::Color`, `bromath::Color8` | `bromath::Color`, `bromath::Color8` |
| **Rotations / Transforms** | `quat`, `mat4` | `quat`: `{x,y,z,w}` or `[x,y,z,w]`; `mat4`: 16-element `Float32Array` or `number[]` | `quat`: `{x,y,z,w}`; `mat4`: `Float32Array` (16 floats) | `bromath::Quat`, `bromath::Mat4` | `bromath::Quat`, `bromath::Mat4` |
| **Geometric Primitives** | `AABB3`, `Sphere`, `Ray`, `Plane`, `Capsule` | Struct objects (`{min,max}`, `{center,radius}`, `{origin,dir}`, etc.) | Struct objects | `bromath::AABB3`, `bromath::Sphere`, `bromath::Ray`, etc. | `bromath::AABB3`, `bromath::Sphere`, etc. |
| **Typed Arrays with Layout** | `Float32Array`, `Uint8Array`, `Uint32Array`, `ArrayBuffer`, `Uint8ClampedArray`, etc. | TypedArray view with stride/offset checks (`resolve_f32`, `JS_GetTypedArrayBuffer`, `ev::typedArrayInfo`) | Fresh TypedArray (`JS_NewArrayBufferCopy`, `ev::createTypedArray`) | `std::span<float>`, `const uint8_t* + len` | `std::span<float>`, `std::span<const uint8_t>` |
| **Opaque Handles** | `interface` instances (e.g. `FastNoise`, `Blob`, `File`, `Mesh`, `SceneNode`) | JS object wrapping opaque native pointer validated by `JSClassID` / `kHost*Tag` | Instance minted via prototype (`wrap_node`, `HostClass::make`) | `T*` / `std::shared_ptr<T>` / `SmartNode<T>` | `T*` / `std::shared_ptr<T>` |
| **Dictionaries with Defaults** | `dictionary` types (e.g. `BlobPropertyBag`, `FilePropertyBag`) | Plain JS object; optional fields take IDL-declared defaults | Plain JS object | C++ `struct` with default member initializers | C++ `struct` with default member initializers |
| **Callbacks / Listeners** | `Function`, `EventListener`, `EventHandler` | Callable JS value (`JS_IsFunction`, `ev::isFunction`) rooted per lifetime rules | Not returned | Invocation trampoline | Invocation trampoline |
| **Promises** | `Promise<T>` | N/A | `JS_NewPromiseCapability` / `ev::createPromise` | Native async task / resolved promise capability | `ev::resolvePromise` / `postHostTask` |

### 1.2 The `[custom]` Escape Hatch
If an operation has non-standard marshalling semantics that cannot be expressed in the frozen vocabulary (e.g. variadic polymorphic arguments like `console.log` or direct byte-stream pipelines with unusual ownership handoff), the IDL marks the member with `[custom]`.
- For `[custom]` members, the generator emits the prototype registration and C++ signature trampoline but delegates the body to a hand-written C++ function:
  `JSValue custom_<Interface>_<method>(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv);`
- In `.d.ts` and documentation emitters, `[custom]` members are fully generated from their IDL type declarations so typechecking and documentation remain 100% unified.

---

## 2. Callback & Resource Lifetime Invariants

Cross-boundary callbacks and native handles bridge two distinct garbage collectors (QuickJS refcounting/cycle-collector in `src/js`, Bronze mark-sweep GC in `src/bronze_host`).

### 2.1 Invariant Rules by Target

1. **Context Outlives DOM:**
   - In QuickJS (`src/js`), the `JSContext` and engine-level `globalThis` are guaranteed to outlive all DOM elements and callbacks.
   - Detached callbacks (e.g., event listeners attached to unrooted nodes) must not retain raw dangling native pointers.
   - Receivers in methods must unwrap the handle from `this_val` dynamically (via `JS_GetOpaque2` or `mutableHostBlob`) rather than closing over raw pointers in lambda captures.

2. **QuickJS GC Rooting:**
   - Callbacks stored long-term (e.g., `requestAnimationFrame`, `setTimeout`, event listeners) must be rooted using `JS_DupValue(ctx, callback)`.
   - On release or listener removal, they must be freed using `JS_FreeValue(ctx, callback)`.
   - Any C++ object that holds a `JSValue` across microtask turns must participate in GC marking via `JS_MarkValue` during `JS_RunGC` to prevent cycles from leaking.

3. **Bronze Host GC Rooting & Persistent Handles:**
   - In Bronze (`src/bronze_host`), a raw `Value` is a GC pointer that is invalidated across any allocating call.
   - Long-lived JS objects, callbacks, and array-likes must be held in `ev::Persistent`.
   - HostClass instances use `makeHandle` with 4-arg form (payload + destructor function pointer).
   - In accordance with `host_class.cpp`, the constructor's `prototype` object is held in a deliberately-leaked `ev::Persistent` to ensure inline caches (ICs) are preserved and prototypes are never prematurely collected.

4. **Engine Pointer Stashing:**
   - Stateful singleton namespaces (like `bro.time`) stash the `engine::Engine*` pointer in a numeric property on `globalThis` (`__bro_time_engine_ptr`) or retrieve it from realm state.
   - No pinned `JSValue`s are allocated for singleton engine pointers, avoiding finalizer-order hazards.

---

## 3. Error Conventions

### 3.1 JavaScript Exceptions
- **Type Errors:** Missing required arguments, invalid types (e.g. passing a string where `Float32Array` is required), or failed receiver unwrap throw `TypeError` (`JS_ThrowTypeError` / `ev::throwTypeError`).
- **Range Errors:** Array size mismatch, invalid buffer lengths, or out-of-range numerical values throw `RangeError` (`JS_ThrowRangeError` / `ev::throwRangeError`).
- **Reference / Syntax Errors:** Unknown node names in factories or malformed string representations throw `ReferenceError` / `SyntaxError`.
- **Async Errors:** Promise-returning methods (`blob.text()`, `blob.arrayBuffer()`) reject the promise capability on failure rather than throwing synchronously.

### 3.2 Return Codes & Nullability
- Search, query, and raycast methods use nullable return types: `RayHit?`, `URL?`, `DOMString?`.
- On miss or parse failure where the web specification mandates non-throwing behavior (e.g., `URL.parse(...)`), the method returns `null` (`JS_NULL` / `ev::null()`).

### 3.3 Uniform Availability Stubs
When a feature is compiled out via CMake (`!BRO_WITH_<FEATURE>`):
1. The real binding TU is omitted.
2. The stub emitter outputs an install function guarded by `#if !BRO_WITH_<FEATURE>` into `src/js/feature_stubs.cpp`.
3. The stub registers a namespace with `available: false`:
   ```javascript
   bro.<feature> = {
       available: false,
       /* informative stub properties and throwing stubs */
   };
   ```
4. Accessing or calling gated operations throws a descriptive error explaining that the feature was compiled out without `BRO_WITH_<FEATURE>`, rather than failing with a raw `ReferenceError`.

---

## 4. Realms & Realm-Parameterized Installation

### 4.1 Multi-Realm Architecture
Bro supports multiple execution realms:
- **Host / Primary Realm:** Main window context (`Engine::jsContext()`).
- **Sub-Documents (`<iframe>`):** `sub_document.cpp` creates a separate `JSContext` with its own isolated `globalThis`, DOM tree, and timer queue.
- **Worker Realms (`Worker`):** Dedicated worker threads, each with its own `JSRuntime` and `JSContext`.

### 4.2 Installation Function Contract
All binding install functions must be parameterized by the realm context:
```cpp
void install<Name>Bindings(JSContext* ctx, engine::Engine* engine = nullptr);
```
- **Thread-Local Class IDs:** Class registration (`JSClassID`) in QuickJS is runtime-specific. Classes instantiated in workers or secondary runtimes must allocate class IDs dynamically per thread (`thread_local JSClassID`).
- **Realm-Specific Feature Exposure:** Certain surfaces (e.g., `bro.time`, native window controls) are restricted to the primary app context. The IDL supports realm annotations (e.g. `[primary_realm_only]`) so the generator emits installation guards when registering into sub-document realms.

---

## 5. Coexistence Model

### 5.1 TU-by-TU Migration
- The generator does not require a "big bang" migration of the entire codebase.
- The unit of migration is **one Translation Unit (TU)** (e.g. `noise.cpp`, `time_bindings.cpp`, `host_file.cpp`).
- Generated binding files drop into the build tree as 1:1 replacements for the hand-written files, maintaining identical `install<Name>Bindings` entry points and header signatures.
- Hand-written and generated TUs link and run seamlessly together throughout the multi-year migration tail.

### 5.2 Build System Integration
- `CMakeLists.txt` does not need special per-generator rules; it simply compiles the emitted `.cpp` files in place of the legacy `.cpp` files.
- Manifest registrations in `bronze_host/dom_globals.cpp` and `web_host.globals` are emitted synchronously from the same IDL definitions to prevent manifest drift.
