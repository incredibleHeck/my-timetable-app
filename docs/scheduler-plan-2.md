# Scheduler Engine — Plan 2

Follow-up to the first scheduler plan, written after that one was completed.
Every finding below was verified against the reference school (361 lessons,
40 staff, four different class day-structures) rather than assumed.

## Where things stand

The engine now produces complete, conflict-free timetables on both fixtures:

| metric              | start of the first plan | now             |
| ------------------- | ----------------------- | --------------- |
| unplaced lessons    | 3 / 4.7 / 6             | 0 / 0 / 0       |
| curriculum gaps     | 6 / 8.7 / 12            | 0 / 0 / 0       |
| severity HIGH       | 4 / 5.3 / 7             | 0 / 0 / 0       |
| class gap periods   | 19 / 24.7 / 33          | 1 / 1.3 / 2     |
| teacher gap periods | 323 / 347 / 367         | 282 / 299 / 309 |
| perfect runs        | 0                       | 3 / 3.7 / 4     |

What remains is a different class of problem: correctness gaps hidden by the
index-based occupancy model, and quality the current move set structurally
cannot reach.

## Findings

| #   | Finding                                                                                                                                                                        | Evidence                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| G1  | **Shared resources are double-booked in real time.** ICT is `isSingleResource` — one lab, one class at a time — and is booked twice over on 5 occasions, all staggered         | `npm run diagnostics:clock`; `constraints.ts` checks `singleResourceUsage[subjectId][d][p]` by index only             |
| G2  | **Room checks have the same blind spot.** Clean today by luck, not design                                                                                                      | `constraints.ts` room occupancy is index-only; all 14 classes override the global structure, across 4 distinct shapes |
| G3  | **Construction drops its queue on abort.** Both early-exit paths return with units still queued; they are neither placed nor recorded unplaced, so repair never learns of them | probed: `unplacedList=3` while the grid actually held 295 unplaced                                                    |
| G4  | **Repair measures progress by queue length, not the grid,** and never snapshots its best state, so it can end worse than a state it passed through                             | `repair-controller.ts` `recordProgress(queue.length + abandoned)`; `bestUnplaced` is a bare number                    |
| G5  | **`maxTeachingPeriodsPerWeek: 24` is unenforced.** Preflight computes capacity as maxDaily × days = 30                                                                         | `preflight.ts` `countTeacherWeeklyCapacity`; the setting reaches the solver only as a priority hint                   |
| G6  | **Load balance is unreachable.** `loadStdev` 5.3 throughout — relocate and swap never change _who_ teaches a lesson                                                            | `optimise.ts` move set; measured unchanged across every run                                                           |
| G7  | Optimiser rescores the whole grid per probe                                                                                                                                    | `optimise.ts` `currentCost()`                                                                                         |
| G8  | Remaining MEDIUM conflicts are 7/8 subject-continuity, 1 class gap                                                                                                             | severity breakdown via `diagnostics:why`                                                                              |
| G9  | `MAX_REPAIR_STEPS = 5000` is unreachable — a step costs ~330ms, so ~100 fit in a slice                                                                                         | probed step counts against the cap                                                                                    |
| G10 | Construction scores only the gang leader at `(d,p)`; `p2` of a double is never scored                                                                                          | `search.ts:101`                                                                                                       |
| G11 | `Conflict.kind` is declared `"blocking" \| "quality"` but assigned in exactly one place                                                                                        | grep across `scheduler/`                                                                                              |

## Decisions taken

- **Weekly cap (G5): warn, do not block.** Preflight flags a teacher whose
  curriculum exceeds the cap, and the objective penalises breaches so the solver
  avoids them — but the lesson is still placed rather than left untaught.
  Nothing becomes unschedulable.
- **Teacher reassignment (G6): build it, off by default.** Behind a per-generation
  setting, restricted to teachers already qualified for the subject, so the
  balance gain is visible before it is adopted.
- **Shared-resource enforcement (G1): correctness first.** Never double-book a
  lab, even at the cost of an unplaced lesson. An unplaced lesson is visible and
  fixable; two classes sent to one lab is not discovered until the day it fails.

## Steps

Correctness first, then reach, then cost.

### Step 1 — Make "same time" mean the same thing everywhere

G1, G2. Generalise the clock-time comparison already added for teachers into one
helper covering rooms and single-resource subjects, gated on the existing
`hasStaggeredDays` so single-structure schools pay nothing. Refine that flag to
compare structures by value rather than by reference.

Expect a temporary feasibility cost, recoverable through restarts as the
staggered-teacher fix was.

### Step 2 — Stop losing work on abort

G3. Construction's early-exit paths drain the remaining queue into
`unplacedDuringConstruction`. Aborted runs then report honestly and repair sees
the full picture. No behaviour change on the happy path.

### Step 3 — Keep repair's best state

G4, G9. Track the incumbent against the grid, not the queue: snapshot on genuine
improvement, restore if the loop ends worse. Retire `MAX_REPAIR_STEPS` in favour
of the deadline that actually governs.

### Step 4 — Honour the configured weekly cap

G5, per the decision above.

### Step 5 — Teacher reassignment moves

G6, per the decision above. Unlocks the load and weekly-cap terms of the
objective, which no current move can affect.

### Step 6 — Incremental objective, then more probes

G7. Compute soft-cost deltas for the classes and teachers a move touches instead
of rescoring the whole grid. The extra throughput is what buys progress on G8.

### Step 7 — Hygiene

G10 (score full gangs including `p2`), G11 (populate `Conflict.kind` or remove it).

## Verification

- `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`
- `diagnostics:bench` before and after each step; `diagnostics:clock` must report
  zero clashes of every kind
- Baseline to hold: 0 unplaced, 0 curriculum gaps, 0 HIGH, class gaps <= 2,
  softCost ~8690
- A step that worsens its target metric is reverted, not rationalised
- Any apparent gain gets a contemporaneous control run before it is reported as
  real. This caught two false results in the previous plan: a "38% improvement"
  that was machine-load variance in restart count, and a regression that was
  sampling noise.

**Out of scope:** UI, exports, storage. Scheduler and its diagnostics only.
