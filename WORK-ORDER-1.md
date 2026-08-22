# Work Order 1 — build brosurface to the proven-pilot stage

Read [README.md](README.md) and [SPEC.md](SPEC.md) completely first. Milestone-gated;
each milestone independently committable and verifiable by re-running its acceptance
command. The goal of this order is NOT to migrate the whole surface — it is to prove the
model end-to-end on three pilots and produce the inventory that sizes the tail.

## Milestones

### M1 — surface census
Machine-extract `docs/SURFACE-INVENTORY.md` per SPEC §6 (one row per namespace/class:
five-copy locations, LOC per copy, marshalling shapes, feature gate, test pointers).

**Acceptance:** the extraction is a re-runnable script (`node tools/census.mjs`), not a
hand-built table; spot-checks against 5 randomly chosen rows match the code. Report total
LOC per copy-kind (the "tax" number).

### M2 — IDL schema + validator + pilot declarations
The grammar, a parser, a validator with real error messages, and complete IDL files for
the three pilots (SPEC §7), including imported doc text. Settle the SPEC §5 serial-core
questions in `docs/DESIGN.md` as you meet them — decisions recorded with rationale.

**Acceptance:** `node gen/validate.mjs idl/` green; deliberately corrupted declarations
produce actionable errors (show three examples); the pilot IDLs round-trip
(parse → serialize → parse) losslessly.

### M3 — `.d.ts` + doc emitters
**Acceptance:** emitted `bro.d.ts` compiles under `tsc --strict`; every code example
embedded in the pilot IDLs typechecks against it; emitted doc pages for the pilots carry
all content of the hand-written `docs/*-api.js` equivalents (attach the reviewed diff).

### M4 — qjsbind emitter + equivalence run
Emit the pilots' `src/js/*_bindings.cpp` replacements. Run SPEC §4 in a scratch bro
worktree (file-swap only).

**Acceptance:** the pilots' existing tests pass unchanged, no other test newly failing;
the worktree diff shows only the swapped TUs; behavioral diffs (if any) triaged per SPEC
§4.4 in the report. State the bro SHA the worktree was cut from.

### M5 — bronze_host emitter + equivalence run
Emit the pilots' `host_*.cpp`, `install*` wiring line(s), and `web_host.globals` lines as
one unit. Same worktree protocol; `tests/bronze_host` checks included; ABI-stamp
discipline per SPEC §4.3.

**Acceptance:** as M4, plus a demonstration that the manifest/registration invariant is
generator-enforced: remove a global from the IDL, regenerate, show both the manifest line
and the registration disappear together.

### M6 — availability-stub emitter + migration playbook
Stub blocks for any gated pilot (if no pilot is gated, demonstrate on `bro.lm`'s
declaration without migrating it). Write `docs/MIGRATION-PLAYBOOK.md`: the per-namespace
checklist a future work order follows, with per-namespace cost estimated from the pilots'
actuals (LOC written vs generated, hours, diffs found).

**Acceptance:** stub compiles standalone with the gate off; playbook's estimate table is
derived from M4/M5 actuals, not guesses.

## Hard rules

- **Never commit or push in `D:/projects/bro`, `D:/projects/bronze`, or any sibling.**
  Scratch worktrees for equivalence runs only; delete them when done; never delete build
  directories that already exist.
- bash shell; MSVC via `cmd //c` + vcvars64.bat wrapper; no PowerShell. Foreground
  blocking commands only for anything you need the result of.
- Read the anchor files SPEC §3 names before writing each emitter; the existing bindings
  and docs are the behavioral authority — where they disagree, that is a §4.4 triage item,
  not a silent choice.
- Never run bro tests with `--no-gpu`; never trigger native dialogs in tests.
- Commit per milestone with full technical messages. No commit trailers. `git add`
  specific paths only. Do not push.
- Final report per milestone: acceptance command, verbatim output tail, commit SHA.
  Reports are independently re-verified; a claim that doesn't reproduce at the stated SHA
  invalidates the report.

## Definition of done

Three namespaces of different character each declared once and generating all five
artifacts, with both binding layers proven behaviorally equivalent by the existing bro
test suite at a stated SHA — plus the census and playbook that let the remaining surface
be migrated as routine per-namespace work orders.
