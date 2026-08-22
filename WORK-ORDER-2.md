# Work Order 2 — make the emitters real

Status: authored 2026-08-22 after independent verification of the WO-1 report.

## Why this order exists

WO-1's acceptance criteria were met, but three of the five emitters met them by
**transcription, not generation**. Verified findings at WO-1 HEAD (`666a496`):

- `gen/docs_noise.mjs` accepts `fileAst` and **ignores it** — the doc page is one
  hardcoded template literal. The claimed "0 byte diff" fidelity is trivially true
  because the emitter *is* the file.
- `gen/qjs_noise.mjs` / `gen/qjs_blob.mjs` reference the AST exactly twice each: find
  the interface, throw if missing. Everything after is a verbatim literal of the
  hand-written binding — including the hand-written file's own inline comments.
- `gen/bh_file_blob.mjs` / `gen/bh_file_url.mjs` reference the AST **zero** times.

Consequences, stated plainly:

1. The equivalence runs (M4/M5) proved nothing about generation — a copy of a working
   file passes the working file's tests by definition.
2. The playbook's 5.8x leverage ratio and 361-hour schedule are invalid: the
   "generated" LOC was copied, not derived. Scaling this pattern to the remaining 63
   surfaces would hand-transcribe ~150K LOC into template literals — creating a
   **sixth** copy of the surface, which is strictly worse than the problem this repo
   exists to solve.
3. What *is* real and keeps its value: the census, the IDL schema/parser/validator/
   serializer with lossless round-trip, `emit_dts.mjs` (genuinely AST-driven — verified
   by its type-mapping code paths), `emit_stubs.mjs` (mostly driven), the pilot IDLs,
   and the worktree equivalence harness scripts. WO-2 builds on these; nothing from
   WO-1 is discarded except the transcription modules.

## The anti-transcription rules (binding for this and all future orders)

- **No per-namespace emitter code.** Files like `qjs_noise.mjs`, `docs_noise.mjs`,
  `bh_file_*.mjs` are the failure mode; delete them as they are replaced. One generic
  emitter per target consumes any validated AST. The only namespace-specific text
  permitted anywhere in `gen/` is zero.
- **Hand-written escape hatches live in the IDL, not the emitter.** Where an operation
  genuinely cannot be expressed (SPEC §5.1), a `[custom]` block carries the C++ inline
  in the *declaration file*, clearly delimited, and the emitter splices it. Budget:
  report the custom-block LOC as a fraction of emitted LOC per namespace — above ~15%
  the declaration design has failed and the vocabulary needs extending instead.
- **Doc text and examples come from the IDL** (SPEC §2 already requires this). If the
  pilot IDLs are missing content the hand-written docs have, move it into the IDL —
  that is the migration.

## The mutation gate (new acceptance, applies to every emitter)

Byte-diffing generated output against hand-written files is no longer an acceptance
criterion — it selected for transcription. Replaced by:

1. **Additive mutation**: add a new operation to a pilot IDL (e.g. a
   `FastNoise.version()` returning a constant string; pick per pilot). Regenerate. The
   operation must appear, functional and consistently typed, in **all five artifacts**
   — `.d.ts` (typechecks), doc page, qjsbind TU (compiles, callable from a headless
   script), bronze_host TU + manifest line, and stub — **with zero edits under `gen/`
   or `schema/`**. Then remove it from the IDL and show all five disappear.
2. **Destructive mutation**: rename one parameter and change one return type in the
   IDL; show the diffs land in every artifact that mentions them.
3. **Behavioral equivalence** (unchanged from SPEC §4): with the *unmutated* IDL, the
   generated TUs swapped into a scratch bro worktree pass the pilots' existing tests.
   This gate is only meaningful **after** gates 1–2 pass — run it last.
4. **Doc fidelity, corrected**: semantic coverage diff (every symbol, param doc, and
   example present), not byte identity. Formatting may differ; content may not.

## Milestones

### M1 — doc emitter, generic
Replace `docs_noise.mjs`/`docs_file_time.mjs` with one AST-driven emitter; enrich the
pilot IDLs until the coverage diff is clean.
**Acceptance:** mutation gates 1–2 for the doc target + gate 4 on all three pilots.

### M2 — qjsbind emitter, generic
The real thing: marshalling from the frozen vocabulary (SPEC §5.1), `[custom]` splice
support, class/namespace/global shapes. Replace `qjs_noise.mjs`/`qjs_blob.mjs`/
`qjs_time.mjs`.
**Acceptance:** mutation gates 1–3 for the qjsbind target on all three pilots; custom
LOC fraction reported per pilot.

### M3 — bronze_host emitter, generic
Same, for `host_*.cpp` + manifest-as-one-unit. Replace `bh_file_*.mjs`.
**Acceptance:** mutation gates 1–3 including the manifest co-appearance/co-removal
demonstrated via IDL mutation (not via editing emitter code); `tests/bronze_host`
checks pass in the worktree.

### M4 — fourth pilot, cold
Migrate one namespace **not** used while building the emitters (suggest `bro.gpu` or
`bro.gizmo` — small, different shape). No emitter changes permitted except genuine
generality fixes, each documented in the report.
**Acceptance:** all four gates pass on the cold pilot; list of emitter fixes with
rationale.

### M5 — playbook, re-priced from real actuals
Rewrite the leverage/cost tables from M1–M4 measurements: IDL LOC authored (including
`[custom]` blocks) vs artifact LOC generated, per namespace, plus the cold-pilot cost
as the honest per-namespace estimate.
**Acceptance:** numbers derive from this order's actuals; the WO-1 numbers are struck
with a note, not silently replaced.

## Hard rules

Unchanged from WORK-ORDER-1.md (no sibling commits/pushes, scratch worktrees only,
bash + `cmd //c` for MSVC, foreground blocking commands only, no trailers, `git add`
specific paths, do not push, per-milestone reports with verbatim acceptance output and
SHA — reports are independently re-verified against the stated SHA).

## Definition of done

`gen/` contains only generic, AST-driven emitters; a stranger can add an operation to
any pilot IDL and watch it propagate to all five artifacts without touching generator
code; the equivalence protocol passes on all four pilots including one the emitters
never saw during development; and the playbook prices the tail from measurements that
survive this order's mutation gates.
