# brosurface — Specification

Status: v1, authored 2026-08-22. Code anchors were verified against the live bro tree at
authoring time; **re-read them before relying on details** — the tree moves.

---

## 1. Scope and non-goals

In scope: the declarative surface (namespaces like `bro.noise`/`bro.time`, classes like
`Blob`/`ImageBitmap`/`AudioContext`, global functions, events, constants, feature gates)
and the three emitters (`.d.ts`, docs, natives). Out of scope: the DOM core (Element/Node/document — deeply
entangled with layout and event dispatch; revisit only after the model is proven on
peripheral namespaces), and any reimplementation of runtime machinery (qjsbind, HostClass,
marshalling helpers, GC contracts — the generator *calls* these).

## 2. The IDL

Start from WebIDL's vocabulary (interfaces, namespaces, attributes, operations, typedefs,
enums, dictionaries) but do not chase WebIDL conformance — the language must express
bro-isms first-class:

- **Feature gates**: `[gate=BRO_WITH_AI]` on a namespace wraps its generated
  registration TU in `#if`; a compiled-out subsystem registers nothing and its wrapper is
  not installed (there are no `{ available: false }` stubs).
- **bro marshalling shapes**: vectors cross as `{x,y,z}` objects *or* arrays on the way in
  and always objects on the way out (see the marshalling-helpers comment at the top of
  `bro/src/js/math_bindings.cpp` — this convention is shared by scene/audio APIs). The IDL
  needs types like `vec3` that carry this dual-accept contract, not raw dictionaries.
- **Typed-array parameters** with byte-length/stride contracts (image/tensor/mesh APIs).
- **Handles**: opaque engine-object wrappers (physics bodies, GL objects, scene nodes).
- **Callbacks/events** with their threading and lifetime notes.
- **Doc text is part of the declaration**: every operation carries its JSDoc (summary,
  params, examples) so the doc emitter and `.d.ts` comments come from the same words.
  The existing `docs/*-api.js` files are the source material to import from.

The schema must have a validator with real error messages; every emitter consumes the
validated AST, never raw text.

## 3. Emitters and their code anchors (read these files first)

### 3.1 `.d.ts` (build first — lowest risk, immediately valuable)
Emit one `bro.d.ts` (plus per-class globals) consumable by broworkshop apps. Acceptance
includes compiling the code examples embedded in the IDL docs under `tsc --strict` against
the emitted definitions — the docs' own examples become typechecked tests.

### 3.2 Doc pages
Regenerate the `docs/<name>-api.js` format from the IDL (same JSDoc-with-examples shape
the existing files use, so downstream consumers of those files see no format change).
Fidelity gate: for a migrated namespace, the generated page must carry all content of the
hand-written one (mechanical diff, reviewed once per namespace).

### 3.3 Natives (`gen/emit_natives.mjs`, planned by `gen/natives_plan.mjs`)
The one binding emitter. bro's runtime is bronze; the engine reaches JavaScript as
*natives* registered with `embed::registerNative` (anchors: `bronze/src/embed/embed.h`
`NativeSignature`/`registerNative`/`nativeClassPrototype`, `bronze/src/abi/bronze_native_type.h`
for the closed type vocabulary and `bronze_native_buffer`, `bronze/src/lower/lower_native.cpp`
for what the compiler lowers to a direct call, and bro's convention in
`bro/src/bronze_host/host_natives.h` + `js/bro_core.js`: every native under one
`__bro_native.<ns>` root, public `bro.*` shapes assembled by a JS wrapper).

Per subsystem named in `idl/natives.list`, four files under `out/natives/<sub>/`:

- `native_<sub>_decl.h` — one `extern "C"` prototype per native, typed in bronze's
  vocabulary: `double`/`int32_t`/`bool`/`const char*`; `uint64_t` for a callback
  (`dynamic`, to be kept in a `Persistent`); `(const T*, uint32_t)` per typed-array
  parameter; `void*` for a class handle; a trailing `bronze_native_buffer* out` for a
  typed-array result (`release == NULL` → the runtime copies; set → zero-copy, `[transfer]`).
  Names: `bro_<sub>_<member>`, `_get`/`_set` for properties, `bro_<sub>_<Class>_ctor`/`_dtor`/
  `_<member>`. The bodies are hand-written in bro; the compiler checks them against this header.
- `native_<sub>_register.cpp` — `registerNatives_<sub>(std::string*)`, every registration
  with its `NativeSignature` (Function / Getter / Setter / Constructor kinds). Class instance
  members are Function-kind natives taking the handle first: the wrapper's receiver is
  dynamic, so a Method-kind registration would be unreachable from it (lower_native.cpp).
  The class prototype is published as `__bro_native.<sub>.<Class>Proto` for the wrapper to
  chain. `[gate=…]` wraps the whole TU in `#if`; off, the function registers nothing.
- `<sub>.js` — the wrapper: mounts, dictionary parameters unpacked in declaration order
  (absent optional → IDL default; absent typed array → empty array; an optional scalar with
  no default crosses as `bool <x>_given, T <x>`), `sequence<double>` → `Float64Array`,
  vec2/vec3/vec4/quat/color dual-accept, result dictionaries reassembled from `<op>_<member>`
  reads over a per-thread stash (or one `JSON.parse` for `[json]`), lists as count + indexed
  reads, classes as JS functions whose prototype the native prototype chains onto so
  `instanceof` matches. Natives are spelled by full dotted path (the direct-call spelling).
  `[manual]` members get a placeholder comment and no native.
- `module.globals` — the bare identifiers the wrapper reads, for `--host-globals`.

The vocabulary is closed. `schema/native_types.mjs` resolves each IDL type to a shape or
refuses it with the IDL line and the nearest expressible spelling (`any` → a declared
dictionary, `[json]`, `Function`, or `[manual]`; `sequence<Class>` → one handle per call;
an optional handle → required or `[manual]`; …). Nothing degrades to `dynamic`.

Verification: `tools/compile_check.mjs` compiles every generated `register.cpp` and a
stub-body TU against bronze's headers with the gate on and off (g++, clang++ or cl);
`tools/compare_registrations.mjs` diffs the generated registrations against bro's
hand-written `native_<sub>.cpp` by path + kind + signature.

IDL files still carrying `cpp_prologue` / `install_body` / `bh_*` strings from the retired
QuickJS and bronze_host emitters are carrying dead payload; no emitter reads it.

## 4. Equivalence protocol (the oracle)

A migrated namespace is accepted only when, in a scratch **git worktree** of bro (never
committed, never pushed):

1. The generated registration TU and wrapper replace the hand-written registration and
   wrapper section in the build; the hand-written bodies are re-pointed at the generated
   prototypes (no other edits).
2. The full bro test suite runs with **that namespace's tests passing unchanged**, and no
   other test newly failing. Windows: VS multi-config, `cmake --build build --config
   Release`; tests via the project harness (`tests/`), headless GPU by default —
   never `--no-gpu`.
3. The `tests/bronze_host` checks pass, and the app.dll ABI-stamp discipline holds
   (rebuild CLI + shared runtime + delete-and-rebuild bro-headless.exe when the
   fingerprint moves — see the bro CLAUDE.md build notes).
4. Behavioral diffs discovered against the hand-written binding are triaged explicitly:
   either the IDL is wrong (fix it) or the hand-written binding had a bug (file it in the
   report — do NOT silently replicate or silently fix; both trees' owners decide).

## 5. Serial-core design questions (settle in docs/DESIGN.md before scaling past pilots)

1. **Marshalling vocabulary**: enumerate the finite set of cross-boundary shapes the
   census (§6) actually finds — vec2/3/4, color, quaternion, typed-array-with-layout,
   handle, callback, dictionary-with-defaults, dual object/array accept — and freeze it.
   An IDL that needs per-API custom marshalling has failed; escape hatch = a declared
   `[custom]` block that keeps that one operation hand-written inline in the IDL file.
2. **Callback lifetime**: bindings capture `Engine*` and JS function refs; the QuickJS
   context must outlive all DOM elements. State the generated-code lifetime rules per
   target (who roots what, when it releases) once, in the runtime-support layer.
3. **Error convention**: exceptions vs error-return per API family; a compiled-out
   subsystem is simply absent (its wrapper is not installed).
4. **Realms**: iframes and Workers have their own realms; installs are per-realm. The
   generator must emit installs that are realm-parameterized the same way the hand-written
   ones are (check how `sub_document.cpp` / worker bindings re-install).
5. **Coexistence**: generated and hand-written bindings must coexist file-by-file for the
   whole migration (years, possibly). The unit of migration is one TU; no big-bang.

## 6. Surface census (first deliverable)

Machine-extract an inventory: every namespace/class, its five-copy locations (which of
src/js, bronze_host, feature_stubs, docs, and headless-injection surfaces carry it), LOC
per copy, marshalling shapes used, feature gate, and test coverage pointers. Output:
`docs/SURFACE-INVENTORY.md`, one row per surface. This drives pilot selection and sizes
the tail. The bro CLAUDE.md's docs table is the seed list; the code is the authority.

## 7. Pilot namespaces (prove the model end-to-end before scaling)

Pick three of different character; suggested, subject to census:
- **`bro.noise`** — pure stateless functions over typed arrays (simplest marshalling).
- **`bro.time`** — small stateful namespace bound to one engine-owned clock.
- **`Blob`/`File` family** — real classes with prototypes, `instanceof`, and cross-API
  reach (fetch, `<img>`, workers) — exercises HostClass and the class-shaped `.d.ts`.

Each pilot ships: IDL file, all emitted artifacts (`.d.ts`, docs, the four natives files),
an equivalence-protocol run (§4), and a short delta report (LOC generated vs LOC replaced;
behavioral diffs found).

## 8. Environment facts (verify before relying)

- bro: `D:/projects/bro`, C++20, Windows = VS multi-config (`cmake --build build --config
  Release`), do not use MinGW for bro itself. bronze_host is `BRO_WITH_BRONZE=ON`.
- bronze: `D:/projects/bronze`; the bro tree builds its CLI at `build/bronze-build/`
  (EXCLUDE_FROM_ALL) and the shared runtime at `build/shared/Release/`.
- Shell: bash; MSVC needs `cmd //c` + vcvars64.bat wrapper; MSBuild leaves nodeReuse
  daemons (`taskkill //IM MSBuild.exe //F`); bash hides real Windows exit codes (use
  `cmd //c` for true status). GCC-compat check for any code that must build on Linux CI:
  `g++ -fsyntax-only -std=gnu++20 -Wall -Wextra -Werror` (GCC 12 rejects `= {}` default
  args). Native dialogs block headless — never trigger them in tests.
- Generator implementation language: TypeScript on node (node is already a required tool
  in the ecosystem; the generator's own tests run under `node --test`). No new heavy
  toolchain dependencies.
