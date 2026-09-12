# brosurface — Specification

Status: v1, authored 2026-08-22. Code anchors were verified against the live bro tree at
authoring time; **re-read them before relying on details** — the tree moves.

---

## 1. Scope and non-goals

In scope: the declarative surface (namespaces like `bro.noise`/`bro.time`, classes like
`Blob`/`ImageBitmap`/`AudioContext`, global functions, events, constants, feature gates)
and the five emitters. Out of scope: the DOM core (Element/Node/document — deeply
entangled with layout and event dispatch; revisit only after the model is proven on
peripheral namespaces), and any reimplementation of runtime machinery (qjsbind, HostClass,
marshalling helpers, GC contracts — the generator *calls* these).

## 2. The IDL

Start from WebIDL's vocabulary (interfaces, namespaces, attributes, operations, typedefs,
enums, dictionaries) but do not chase WebIDL conformance — the language must express
bro-isms first-class:

- **Feature gates**: `[gate=BRO_WITH_AI]` on a namespace drives the availability-stub
  emitter and the `{ available: false }` shape.
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

### 3.3 qjsbind binding TU (retired)
bro no longer has a QuickJS interpreter and this emitter was removed. IDL files still
carrying `cpp_prologue` / `install_body` strings of QuickJS binding source are carrying
dead payload; no emitter reads it and it should be deleted from the IDL.

### 3.4 bronze_host binding TU + globals manifest
Anchors: `bro/src/bronze_host/host_class.cpp` (the HostClass three-call shape: constructor
via makeFunction, read `prototype` to mint it, decorate once, birth instances with
makeHandle's 4-arg form — instances born on the prototype keep their inline caches; the
deliberately-leaked Persistent is documented in the file header), `host_image.cpp` (the
original of that shape), `dom_globals.cpp` (`installWebHostGlobals` — registration order),
`web_host.globals` (the manifest; its header comment states the identical-lists invariant),
and `bro/src/bronze_host/README.md`. The emitter must produce, from one declaration: the
`host_<name>.cpp` TU, its `install*` call for `dom_globals.cpp`'s foot, and the manifest
lines — generated as one unit so the lists cannot diverge. Note bronze embed facts (verify
against `D:/projects/bronze`): an unregistered manifest global is a `fatal()`, not a
catchable miss; a raw bronze Value is stale after any allocating call (GC contract);
HostClass gives real prototypes and `instanceof`.

### 3.5 Availability stub
Anchor: `bro/src/js/feature_stubs.cpp` (header comment explains the scheme: the stub TU is
always compiled, `#if !BRO_WITH_X` guards each block, same install entry point as the real
binding, installs `bro.<name>.available === false` + clear error). Emit each namespace's
stub block from its `[gate=...]` attribute.

## 4. Equivalence protocol (the oracle)

A migrated namespace is accepted only when, in a scratch **git worktree** of bro (never
committed, never pushed):

1. The generated TU(s) replace the hand-written one(s) in the build (file swap, no other
   edits).
2. The full bro test suite runs with **that namespace's tests passing unchanged**, and no
   other test newly failing. Windows: VS multi-config, `cmake --build build --config
   Release`; tests via the project harness (`tests/`), headless GPU by default —
   never `--no-gpu`.
3. For bronze_host surfaces: the `tests/bronze_host` checks pass, and the app.dll ABI-stamp
   discipline holds (rebuild CLI + shared runtime + delete-and-rebuild bro-headless.exe
   when the fingerprint moves — see the bro CLAUDE.md build notes).
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
3. **Error convention**: exceptions vs error-return per API family; availability errors
   uniform via the stub shape.
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

Each pilot ships: IDL file, all five emitted artifacts, equivalence-protocol run (§4) for
both binding layers, and a short delta report (LOC generated vs LOC replaced; behavioral
diffs found).

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
