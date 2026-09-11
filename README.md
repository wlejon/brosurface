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
| Pure C-ABI Headers | Zero dynamic boxing, direct native CPU register calling conventions | `include/bro/c_abi/bro_<subsystem>_c_abi.h` |
| C++ Forwarders | Bridges C-ABI calls to internal engine subsystems and managers | `src/c_abi/bro_<subsystem>_c_abi.cpp` |
| Bronze Native Manifests | JSON symbol maps declaring kinds, return types, parameters, and signatures for Bronze AOT | `out/c_abi/manifest/` |
| Bronze Host bindings | Direct host integration for Bronze-compiled applications | `src/bronze_host/` |
| Availability stubs | Feature detection for optional engine modules (`BRO_WITH_*`) | `out/stubs/feature_stubs.cpp` |

## Structure

```
idl/          Surface declarations (*.idl), one per subsystem/class family
schema/       IDL grammar, lexer, parser, and semantic validator
gen/          AST-driven emitters (c_abi, bronze_host, dts, docs, stubs)
out/          Generated artifacts
tools/        Verification and sync tooling (audit_gen, acceptance, check_out_fresh, sync_to_bro)
```

## Tooling & Verification

- **Acceptance Gate**: `npm test` runs the complete verification suite (generality audit, corruption handling, byte-for-byte freshness).
- **Generality Audit**: `node tools/audit_gen.mjs` enforces that all generator logic in `gen/` is 100% generic AST-driven with 0 hardcoded subsystem names.
- **Freshness Check**: `node tools/check_out_fresh.mjs` verifies that committed `out/` mirrors match IDL source declarations byte-for-byte.
- **Sync**: `npm run sync-to-bro` synchronizes generated C-ABI headers, forwarders, Bronze Host TUs, docs, and TypeScript declarations into `bro`.
