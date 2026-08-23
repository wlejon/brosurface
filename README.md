# brosurface

**Declare each bro engine API once; generate every copy.**

An interface-definition language (IDL) and generator for the bro engine's JS API surface.
One `.idl` file per namespace/class becomes the single source of truth, and the generator
emits every artifact that is today written and maintained by hand, in sync, forever.

## The problem this kills

The bro engine's API surface currently exists in **five hand-maintained copies** that must
agree and don't, structurally:

1. **QuickJS bindings** — `bro/src/js/*_bindings.cpp`, ~69K LOC of qjsbind/QuickJS glue.
2. **bronze_host bindings** — `bro/src/bronze_host/host_*.cpp`, a second, parallel
   implementation of the same surface for bronze-compiled (AOT) apps, built on `HostClass`
   and `ObjectBuilder`. Every API bronze apps need is written a second time.
3. **Availability stubs** — `bro/src/js/feature_stubs.cpp`: when a `BRO_WITH_*` feature is
   compiled out, a stub installs `bro.<name>.available === false` with a clear error. Each
   stub is hand-matched to its real binding's install entry point.
4. **Docs** — `bro/docs/*-api.js`, 60+ hand-written JSDoc files that are the de-facto spec
   and drift independently of the code.
5. **Nothing for app developers** — no TypeScript definitions, no autocomplete; broworkshop
   apps are written blind against the docs.

Plus hand-enforced invariants that are `fatal()` when violated — e.g.
`bro/src/bronze_host/web_host.globals` carries the comment: *"the two lists must stay
identical, or a compiled read reaches a registry with no value in it"* (the manifest vs the
`installWebHostGlobals` registration order). That is exactly the class of invariant a
generator makes impossible to violate.

Every new engine API pays this five-copy tax. The bro/bronze pivot (QuickJS shrinking to
UI-only, bronze_host becoming the primary layer, ~70K binding LOC churning) makes now the
moment: namespaces get **regenerated from a declaration** instead of hand-ported.

## What the generator emits, per declared surface

| target | replaces | notes |
|--------|----------|-------|
| `.d.ts` TypeScript definitions | nothing (new capability) | app-developer autocomplete + typechecking; also typechecks the docs' own examples |
| doc page | `docs/<name>-api.js` | JSDoc text lives in the IDL; docs stop drifting |
| qjsbind binding TU | `src/js/<name>_bindings.cpp` | same install-fn signature, drop-in |
| bronze_host binding TU + manifest lines | `src/bronze_host/host_<name>.cpp` + `web_host.globals` entries | emits registration code and manifest lines from one list — the fatal()-on-mismatch trap closes by construction |
| availability stub | the namespace's block in `feature_stubs.cpp` | derived from the IDL's feature-gate attribute |

Hand-written runtime support (HostClass itself, qjsbind, marshalling helpers, the
engine-side implementations) stays hand-written — the generator emits *calls into* it,
never reimplementations of it.

## Two ways a regeneration silently loses meaning

A generator that emits the wrong thing shows up as a red build. A generator
that emits *nothing* where something was meant does not, and both failures
below reached `main` as exactly that: a regeneration commit that read like
routine housekeeping, and three red platforms an hour later.

**1. An attribute no emitter reads.** Ten IDLs carried
`feature_gate="BRO_WITH_SOUNDML"`. Every emitter looks up `gate`. The
attribute grammar accepts any name, so the intent parsed, validated, and was
dropped on the floor — seven namespaces regenerated without their
`#if BRO_WITH_SOUNDML`, and the app profile (the one CI builds, where the
sibling is not compiled at all) stopped finding `brosoundml/audio.h`.

`schema/validator.mjs` now holds `KNOWN_EXTENDED_ATTRIBUTES`: every name an
emitter actually reads. Anything else is a validation error that names the
attribute, the definition, and its likely correction. Adding a new attribute
means teaching an emitter to read it and listing it there, in that order.

**2. A default that means something.** `HostClass::install` turns a null
constructor body into the TypeError the web specifies for `new`. The
bronze_host emitter used to substitute a lambda returning `undefined` whenever
an interface had no `constructor()`, which made `new AbortSignal()` succeed and
hand back a bare object. Nothing failed to build; one probe caught it. An
interface with no declared constructor now emits `nullptr`, which is what
WebIDL means by not-constructible.

The general shape: **when the IDL is silent, emit what the silence means, and
make an unrecognised instruction an error rather than a shrug.**

## Drift: what a sync would change in bro

`tools/sync_to_bro.mjs` copies emitted TUs directly over `bro/src/js` and
`bro/src/bronze_host`. A repair made in bro and not folded back into the IDL is
reverted by the next sync.

```bash
node tools/drift.mjs                 # every file a sync would rewrite
node tools/drift.mjs --diff audio    # ...and what it would change
node tools/drift.mjs --quiet         # exit 1 if bro has drifted
```

`check_out_fresh.mjs` asks whether `out/` matches a fresh generation.
`drift.mjs` asks the question that actually bites: whether **bro** does. The
sync refuses to run while any file has drifted, listing each one; fold the
difference into `idl/` first, or pass `--accept-drift` to overwrite
deliberately. Drift is often legitimate — bro is simply behind — but it must be
a decision, never a surprise.

## Layout

```
idl/          the surface declarations (*.idl), one per namespace/class family
schema/       the IDL grammar + validator
gen/          the generator and its per-target emitters
out/          generated artifacts (checked in for review/diffing; bro integrates via reviewed diffs)
tools/        validate, sync, and drift.mjs (what a sync would change in bro)
harness/      equivalence harness: builds generated bindings in a bro worktree, runs that namespace's existing tests
docs/         DESIGN.md (serial-core decisions), SURFACE-INVENTORY.md (the census), migration playbook
```

## Documents

- **[SPEC.md](SPEC.md)** — IDL requirements, the five emitters with code anchors into the
  real trees, the equivalence protocol, and the serial-core design questions.
- **[WORK-ORDER-1.md](WORK-ORDER-1.md)** — milestone-gated work order.

## Ground rules for agents working here

- **Never commit to `D:/projects/bro`** (or any sibling). The equivalence harness may build
  bro in a scratch **git worktree** to compile and test generated bindings; the worktree is
  never committed or pushed, and integration into bro happens later via reviewed diffs.
- Read the real binding code for idioms before designing; SPEC.md names the anchor files.
  Do not invent API shapes — the existing bindings + docs are the authority on behavior.
- The migration oracle is the existing bro test suite: a generated namespace must pass the
  same tests the hand-written one passes, unchanged. Equivalence claims must name the test
  runs that prove them.
- bash shell; MSVC via `cmd //c` + vcvars64.bat wrapper; foreground blocking commands only.
