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

`tools/sync_to_bro.mjs` copies emitted TUs directly over `bro/src/js`. A repair
made in bro and not folded back into the IDL is reverted by the next sync.

```bash
node tools/drift.mjs                 # what a sync would rewrite, grouped
node tools/drift.mjs --diff audio    # ...and what it would change
node tools/drift.mjs --lost math     # ...just the lines it would delete
node tools/drift.mjs --quiet         # exit 1 if a sync would lose something
```

`check_out_fresh.mjs` asks whether `out/` matches a fresh generation.
`drift.mjs` asks the question that actually bites: whether **bro** does.

"Different" is too blunt a verdict to act on, so drift is sorted by what taking
it would cost. Both sides are reduced to a multiset of significant lines, with
whitespace and brace style normalised away, and the report asks what bro has
that a regeneration would not write back:

* **reordered / reformatted** — nothing missing. The emitter puts `cleanup()`
  after `install()` where the hand-written file had it first, or indents a
  pasted block differently. Same program; take it.
* **lossy** — something missing: a namespace alias, a static helper, the
  twenty-line header explaining what the binding is for. `--lost <name>` prints
  the exact lines. This is the case that blocks a sync.

The sync also stops short of *creating* files. Twenty-seven emitted TUs have
never existed in bro, which splits per-class files differently; dropping them
into `src/js/` leaves untracked source no `CMakeLists` compiles. Adding a
translation unit to bro has a build-system half, and a copy loop does not get
to make that decision.

## Refolding: repairing a blob that has rotted

Large hand-written C++ rides in these IDLs as escaped strings — `cpp_prologue`,
`install_body`, `cpp_includes`, `cpp_file_comment`. A verbatim copy rots the
moment someone edits the original, and five files had rotted far enough that
regenerating them deleted whole helper functions: `math_bindings.cpp` came back
388 lines short, `window_bindings.cpp` without its per-realm state or clipboard
bindings, `asset_path.cpp` as a different implementation entirely.

The fix is not to stop generating them. It is to make repair a command:

```bash
node tools/refold.mjs --check math_bindings.cpp   # show the split
node tools/refold.mjs math_bindings.cpp           # write it back into idl/
node tools/drift.mjs                              # confirm
```

`refold.mjs` reads bro's TU, splits it at the seams the emitter composes it
from, and writes each piece back into the attribute it came from. It leaves the
declarative half of the IDL — the operations and attributes that drive the docs
and the `.d.ts` — untouched.

It is a structural split, not a semantic one. If a file still differs after a
refold, the emitter shapes it differently, and *that* is what to fix. Every
QuickJS TU currently regenerates to what bro has.

`tools/ownership.mjs` names the only files a sync will not write: five vendored
from brokit. There is deliberately no "bro owns this one" escape hatch — an
exemption is how a generator quietly stops generating.

## Layout

```
idl/          the surface declarations (*.idl), one per namespace/class family
schema/       the IDL grammar + validator
gen/          the generator and its per-target emitters
out/          generated artifacts (checked in for review/diffing; bro integrates via reviewed diffs)
tools/        validate, sync, ownership.mjs (who owns bro's copy of each TU),
              and drift.mjs (what a sync would change in bro)
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
