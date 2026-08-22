# Work Order 3 — honest accounting, then the first real migration batches

Status: authored 2026-08-22 after independent verification of the WO-2 report. WO-2 is
confirmed genuine: an independently-authored mutation (a novel attribute inserted into
the cold pilot's IDL) propagated to `.d.ts`, docs, and the qjsbind TU with zero
generator edits. The model is proven; this order fixes two honesty warts found in
verification, then migrates real namespaces in batches and packages them so the bro
owner can integrate each one as a reviewed unit. This repo still never commits to bro —
the deliverable is per-namespace integration bundles.

## Milestones

### M1 — honesty fixes
1. **Alias out of the generator**: `gen/emit_dts.mjs` hardcodes the
   FastNoise → `bro.noise` alias (around line 394). Replace with an IDL attribute
   (e.g. `[js_alias="bro.noise"]`) consumed generically; grep `gen/` afterward — zero
   namespace-specific identifiers anywhere in `gen/` is the bar, enforced by a small
   `tools/audit_gen.mjs` that greps for every interface/namespace name found in `idl/`
   and fails on any hit in `gen/`.
2. **Honest custom accounting**: the custom-LOC metric must count EVERY hand-written
   C++/JS line carried in the IDL — `[custom]` blocks, `getter_body`, `setter_body`,
   `cpp_prologue`, `stub_body`, and any similar attribute — not just one class of
   them. Re-emit all current namespaces and republish the per-TU custom fractions.
   Namespaces exceeding the 15% ceiling get flagged, not hidden: for each, one
   sentence on whether the vocabulary needs a new shape or the surface is genuinely
   engine-logic-heavy (a `bro.gpu`-style probe namespace may legitimately run high —
   say so explicitly rather than gaming the denominator).

**Acceptance:** `node tools/audit_gen.mjs` green; mutation gates re-run green on all
four existing pilots at the new HEAD; the republished custom-fraction table in the
report with the old vs new numbers side by side.

### M2 — batch 1: six namespaces, census-ranked
From `docs/SURFACE-INVENTORY.md`, pick the six lowest-complexity unmigrated
namespaces that have existing tests in the bro tree (test coverage is the equivalence
oracle — a namespace with no tests cannot be accepted in this order; note such
namespaces in the report as blocked-on-tests). For each: full IDL (doc text imported
from the hand-written `docs/*-api.js`), all applicable artifacts emitted, equivalence
protocol per SPEC §4 in a scratch worktree (qjsbind always; bronze_host only where the
namespace exists in `web_host.globals` — absence is a recorded fact, not a gap to
invent), behavioral diffs triaged explicitly per SPEC §4.4.

**Acceptance:** per namespace: validator green, mutation gate 1 spot-run (add/remove a
marker operation, zero `gen/` edits), equivalence run output tail at a stated bro SHA,
custom fraction under the honest metric. Report the batch table.

### M3 — integration bundles
For every namespace that has passed equivalence (the three WO-2 pilots, the cold
pilot, and batch 1): produce `integration/<namespace>/` containing the generated
artifact files, a `diff.patch` against the stated bro SHA (file swaps only), and an
`INTEGRATION.md` stating: the bro SHA the bundle was verified at, the exact test
commands that passed, behavioral diffs found (if any) and their triage, and the
one-command re-verification a reviewer runs before merging. Bundles are how this
repo's output crosses into bro: the bro owner applies and commits them there; this
repo never does.

**Acceptance:** for one bundle chosen at random by the verifier, applying `diff.patch`
in a fresh scratch worktree at the stated SHA and running the stated commands
reproduces the stated results. `integration/` committed.

### M4 — batch 2: six more, at least two bronze_host-manifest namespaces
Same protocol as M2, next six by census rank, deliberately including at least two
namespaces present in `web_host.globals` so the manifest-as-one-unit path gets real
mileage beyond the file family. Update the integration bundles.

**Acceptance:** as M2 + M3 for the new namespaces; the manifest lockstep demonstrated
on a real namespace via IDL mutation (not emitter edits).

### M5 — coverage ledger + playbook actuals
`docs/COVERAGE.md`: one row per surface from the census — declared / migrated /
equivalence-passed / bundled / blocked-on-tests / not-started — with LOC before and
after, regenerable by `node tools/coverage.mjs` (no hand-edited numbers). Update
MIGRATION-PLAYBOOK.md costs from the two batches' actuals under the honest custom
metric; the WO-2 numbers get struck with a note, same discipline as before.

**Acceptance:** one command regenerates the ledger; playbook actuals derive from this
order's batches.

## Hard rules

Unchanged from Work Orders 1–2: never commit or push in `D:/projects/bro`,
`D:/projects/bronze`, or any sibling — scratch worktrees only, pruned when done, never
delete existing build dirs; bash with `cmd //c` vcvars wrapper for MSVC; foreground
blocking commands only (background completion notifications are lost); never
`--no-gpu`, never trigger native dialogs; per-milestone commits, full technical
messages, no trailers, `git add` specific paths, never push; per-milestone reports
with acceptance command, verbatim output tail, and SHA — reports are independently
re-verified, and mutation gates will be re-run by the verifier with novel mutations,
so the emitters must be generic in fact, not in demonstration.

## Definition of done

Sixteen namespaces declared once, equivalence-proven at stated SHAs, and packaged as
apply-and-verify integration bundles; a regenerable coverage ledger showing exactly
where the migration stands; and cost numbers honest enough to schedule the tail from.
