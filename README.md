# brosurface

**Declare each bro engine API once; generate every copy.**

An interface-definition language (IDL) and generator for the bro engine's API surface.
One `.idl` file per namespace/class becomes the single source of truth, and the generator
emits every artifact in sync.

## What the generator emits, per declared surface

| Target | Description | Destination in bro |
|--------|-------------|--------------------|
| `.d.ts` TypeScript definitions | Full typings, autocomplete, and documentation examples | `types/index.d.ts`, `docs/bro.d.ts` |
| Doc pages | JSDoc specifications generated directly from IDL | `docs/*-api.js` |
| Natives (per subsystem in `idl/natives.list`) | see below | `src/bronze_host/natives/<subsystem>/` |

### Natives

bro exposes the engine to bronze-compiled JavaScript as *natives*: C entry points
registered with `embed::registerNative` under `__bro_native.<subsystem>`, with a JS
wrapper on top giving the public `bro.*` shape. For every subsystem named in
`idl/natives.list`, `gen/emit_natives.mjs` emits into `out/natives/<subsystem>/`:

| File | What it carries |
|------|-----------------|
| `native_<sub>_decl.h` | One C-linkage prototype per native, typed in bronze's vocabulary. The compiler checks bro's hand-written bodies against it. |
| `native_<sub>_register.cpp` | `bool registerNatives_<sub>(std::string* error)`: every `embed::registerNative` call with its `NativeSignature`. A `[gate=BRO_WITH_*]` subsystem is wrapped in `#if`; compiled out, it registers nothing (no `available:false` stubs). |
| `<sub>.js` | The wrapper: mounts (`bro.<sub>`, `[flatten]` onto `bro`, `[prefix=""]` onto the global), dictionary unpacking in declaration order with IDL defaults, `sequence<double>` → `Float64Array`, `vec3`-style dual-accept, result dictionaries reassembled from per-member reads (or `JSON.parse` for `[json]`), classes whose prototype chains onto the native class prototype so `instanceof` matches bronze. `[manual]` members are a placeholder comment. |
| `module.globals` | The bare identifiers the wrapper reads (`__bro_native`, `bro`, …), for bronze `--host-globals`. |

**Generated:** prototypes, registrations, wrapper mechanics, types, docs.
**Hand-written in bro:** the entry-point bodies (`native_<sub>.cpp`) and every `[manual]`
member's JavaScript. `bronze_native_buffer` (a typed-array result's out-descriptor) is
bronze's, in `abi/bronze_native_type.h`.

The type vocabulary that can cross a native call is closed (`schema/native_types.mjs`):
`double`/`int32_t`/`bool`/`const char*`, typed arrays as `(const T*, uint32_t)` in and
`bronze_native_buffer* out` back, class handles as `void*`, callbacks as `uint64_t`
(`dynamic`), and dictionaries member-wise or as JSON. An IDL type outside it is refused
with the IDL line and the nearest expressible spelling; nothing degrades to `dynamic`.

Naming: `bro_<sub>_<member>` for namespace operations, `bro_<sub>_<member>_get/_set` for
properties, `bro_<sub>_<Class>_ctor` / `_dtor` / `_<member>` / `_<attr>_get` for classes;
JS paths mirror these under `__bro_native.<sub>.` (a class's constructor path is its
class path, `__bro_native.<sub>.<Class>`). A dictionary result is `<op>` (runs, stashes)
plus `<op>_<member>` reads; a list result is `<op>` (count) plus `<op>_<member>(index)`
or `<op>_at(index)`.

Extended attributes the natives emitter reads: `[gate=…]`/`[cpp_guard=…]`, `[flatten]`,
`[prefix=…]`, `[json]` (dictionary crosses as one JSON string), `[manual]` (no native;
hand-written JS — on a dictionary member, one that never crosses and the hand-written
wrapper assembles), `[transfer]` (typed-array result handed over zero-copy), `[view]`
(class handles the host owns; no destructor), `[finalize=insweep|deferred]`.

## Structure

```
idl/          Surface declarations (*.idl), one per subsystem/class family; natives.list
schema/       IDL grammar, lexer, parser, semantic validator, native type vocabulary
gen/          AST-driven emitters (natives, dts, docs) and the natives planner
out/          Generated artifacts (docs/, types/, bro.d.ts, natives/)
tools/        Verification and sync tooling
```

## Tooling & Verification

- **Acceptance Gate**: `npm test` runs the complete verification suite (generality audit,
  corruption handling, emitter mutation gate, byte-for-byte freshness of `out/` including
  `out/natives/`).
- **Generality Audit**: `node tools/audit_gen.mjs` enforces that all generator logic in
  `gen/` is 100% generic AST-driven with 0 hardcoded subsystem names.
- **Freshness Check**: `node tools/check_out_fresh.mjs` verifies that committed `out/`
  mirrors match IDL source declarations byte-for-byte.
- **Regenerate**: `node tools/build.mjs`; natives alone:
  `node gen/emit_natives.mjs [idlDir] [outDir] [subsystem...]`.
- **Compile check**: `node tools/compile_check.mjs [--cxx g++|clang++|cl]` compiles every
  generated `register.cpp` plus a stub-body TU against bronze's headers, gate on and off.
- **Registration diff**: `node tools/compare_registrations.mjs` diffs generated
  registrations against bro's hand-written `native_<sub>.cpp` by path and signature.
- **Sync**: `npm run sync-to-bro` copies docs, TypeScript declarations and the natives
  outputs into `bro` — the natives only for the subsystems bro already carries (a
  `natives/<sub>/native_<sub>_register.cpp` there); the rest live in a sibling
  library's api tree, or nowhere yet.
