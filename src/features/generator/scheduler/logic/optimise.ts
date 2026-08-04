import { AppData, Teacher, Subject, ClassGroup, Room } from "../../../../types";
import { AllocationUnit, SchedulerState } from "../core/types";
import { applyGangToState, removeGangFromState } from "../core/state";
import { checkHardConstraints } from "./constraints";
import { determineRoom } from "./rooms";
import { getNextClassPeriod, getPeriodType, getDaysPerWeek } from "../utils/utils";
import { ObjectiveScore, ObjectiveWeights, OBJECTIVE_WEIGHTS, scoreSchedule } from "./objective";
import { snapshotPlacedGangs, restorePlacedGangs } from "../solver/repair-controller";

/**
 * POST-FEASIBILITY OPTIMISATION
 *
 * Construction and repair answer "can every lesson be placed?". Once the answer
 * is yes they stop, and the timetable the school actually receives is whichever
 * feasible arrangement the search happened to land on. Nothing ever asks whether
 * a better one exists.
 *
 * This phase runs only on a feasible schedule and only improves it: every move
 * is accepted solely because it lowers the objective in `objective.ts`, and any
 * move that would unplace a lesson is rejected outright. Feasibility is an
 * invariant here, never a trade.
 *
 * Two move types, both chosen because they cannot cascade:
 *  - RELOCATE a lesson into genuinely free space
 *  - SWAP two lessons that are each legal in the other's slot
 *
 * Neither evicts anything, so there is no chain to unwind — the failure mode
 * that made the repair search destructive cannot arise here. The state is
 * restored after every rejected probe, and `optimiseSchedule` leaves a schedule
 * that is feasible if it was handed one.
 */

export interface OptimiseMaps {
  teacherMap: Map<string, Teacher>;
  subjectMap: Map<string, Subject>;
  classMap: Map<string, ClassGroup>;
  roomMap: Map<string, Room>;
}

export interface OptimiseOptions {
  /** Wall-clock deadline (Date.now() based). Checked between probes. */
  deadlineMs: number;
  /** Seeded RNG so a solve stays reproducible. */
  rng: () => number;
  weights?: ObjectiveWeights;
  /** Safety valve for tests; the deadline is the real limit. */
  maxPasses?: number;
}

export interface OptimiseReport {
  before: ObjectiveScore;
  after: ObjectiveScore;
  /** Moves committed. */
  accepted: number;
  /** Candidate slots evaluated. */
  probes: number;
  relocations: number;
  swaps: number;
  /** Kicks out of a local optimum, and how many landed somewhere better. */
  restarts: number;
  restartsAccepted: number;
  /** Whole (class, subject) blocks moved to a different qualified teacher. */
  reassignments: number;
  /**
   * What those moves changed, so the caller can update the curriculum to match.
   *
   * The generated timetable is self-consistent on its own — each slot carries
   * its teacher — but `curriculum.assignedTeacherId` still names the original,
   * and the Workload screen reads that. Adopting a reassignment means writing
   * these back; reporting them keeps the divergence visible instead of silent.
   */
  reassigned: Array<{
    classId: string;
    subjectId: string;
    fromTeacherId: string;
    toTeacherId: string;
  }>;
  passes: number;
}

/** Partners considered per lesson in the swap pass. */
const SWAP_SAMPLE_SIZE = 12;

/** Lessons displaced per kick when escaping a local optimum. */
const PERTURB_LESSONS = 8;

type Placement = { d: number; p: number; p2: number; rooms: Record<string, string> };

function sharesTeacherOrClass(a: AllocationUnit[], b: AllocationUnit[]): boolean {
  const teachers = new Set<string>();
  const classes = new Set<string>();
  for (const u of a) {
    u.teacherIds.forEach((t) => teachers.add(t));
    u.classIds.forEach((c) => classes.add(c));
  }
  for (const u of b) {
    if (u.teacherIds.some((t) => teachers.has(t))) return true;
    if (u.classIds.some((c) => classes.has(c))) return true;
  }
  return false;
}

function savePlacement(state: SchedulerState, gang: AllocationUnit[]): Placement | null {
  const pl = state.unitPlacements.get(gang[0].id);
  if (!pl) return null;
  return { d: pl.d, p: pl.p, p2: pl.p2, rooms: { ...pl.rooms } };
}

/**
 * Whether `gang` can occupy (d, p) as things currently stand.
 *
 * The gang must already be removed from the state. No `ignoredOccupants` is
 * passed, so an occupied slot fails — which is exactly the intent: this phase
 * never evicts.
 *
 * Staggered-day clashes are caught inside checkHardConstraints, which compares
 * real clock times when classes do not share a structure. Before that existed,
 * this phase happily relocated a lesson into a window where its teacher was
 * already busy in another class, and introduced two genuine double-bookings on
 * seeds that had none.
 */
function placementAt(
  state: SchedulerState,
  data: AppData,
  gang: AllocationUnit[],
  d: number,
  p: number,
  maps: OptimiseMaps,
): Placement | null {
  const rooms: Record<string, string> = {};
  let sharedP2 = -1;

  for (const u of gang) {
    const cls = maps.classMap.get(u.classIds[0]);
    const struct = cls?.structure || data.settings.dayStructure;
    const classLimit = cls?.periodCount ?? data.settings.periodsPerDay;

    if (p >= classLimit || getPeriodType(struct, p) !== "CLASS") return null;

    let p2 = -1;
    if (u.duration === 2) {
      const next = getNextClassPeriod(p, struct, classLimit);
      if (next === null) return null;
      p2 = next;
    }
    sharedP2 = p2;

    const legal = checkHardConstraints(
      state,
      data,
      d,
      p,
      p2,
      u,
      maps.teacherMap,
      maps.classMap,
      maps.subjectMap,
      maps.roomMap,
    );
    if (!legal) return null;

    const roomId = determineRoom(
      d,
      p,
      p2,
      u,
      state,
      data,
      maps.subjectMap,
      maps.classMap,
      maps.roomMap,
    );
    if (!roomId) return null;
    rooms[u.id] = roomId;
  }

  return { d, p, p2: sharedP2, rooms };
}

/** Fisher-Yates over a copy, so pass order varies but stays seeded. */
function shuffled<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Improve a feasible schedule in place under a time budget.
 *
 * First-improvement hill climbing: the first move that lowers the objective is
 * taken rather than the best one. Scoring is whole-schedule, so an exhaustive
 * best-of search would spend most of the budget rescoring slots it will not use.
 */
export function optimiseSchedule(
  state: SchedulerState,
  data: AppData,
  gangLeaders: AllocationUnit[],
  gangMap: Map<string, AllocationUnit[]>,
  maps: OptimiseMaps,
  options: OptimiseOptions,
): OptimiseReport {
  const weights = options.weights ?? OBJECTIVE_WEIGHTS;
  const before = scoreSchedule(data, state.schedule, 0, weights);

  const report: OptimiseReport = {
    before,
    after: before,
    accepted: 0,
    probes: 0,
    relocations: 0,
    swaps: 0,
    restarts: 0,
    restartsAccepted: 0,
    reassignments: 0,
    reassigned: [],
    passes: 0,
  };

  const days = getDaysPerWeek(data.settings);
  const maxPeriods = Math.max(
    data.settings.periodsPerDay ?? 0,
    ...data.classes.map((c) => c.periodCount ?? 0),
    ...data.classes.map((c) => (c.structure ?? data.settings.dayStructure)?.length ?? 0),
  );

  // Only gangs that are actually on the grid can be moved.
  const placed = gangLeaders.filter((leader) => {
    const gang = gangMap.get(leader.id) ?? gangMap.get(leader.electiveBlockId ?? "");
    return gang?.every((u) => state.unitPlacements.has(u.id)) ?? false;
  });

  const currentCost = () => scoreSchedule(data, state.schedule, 0, weights).softCost;
  let cost = before.softCost;
  const maxPasses = options.maxPasses ?? Number.POSITIVE_INFINITY;

  const improvementPasses = () => {
    while (report.passes < maxPasses && Date.now() < options.deadlineMs) {
      report.passes++;
      let improvedThisPass = false;

      for (const leader of shuffled(placed, options.rng)) {
        if (Date.now() >= options.deadlineMs) break;

        const gangId = leader.electiveBlockId || leader.id;
        const gang = gangMap.get(gangId);
        if (!gang) continue;

        const saved = savePlacement(state, gang);
        if (!saved) continue;

        removeGangFromState(state, gang, data);

        let committed = false;

        // --- RELOCATE into free space ---
        for (const d of shuffled([...Array(days).keys()], options.rng)) {
          if (committed || Date.now() >= options.deadlineMs) break;

          for (let p = 0; p < maxPeriods; p++) {
            if (d === saved.d && p === saved.p) continue;

            const candidate = placementAt(state, data, gang, d, p, maps);
            if (!candidate) continue;

            report.probes++;
            applyGangToState(state, gang, candidate);
            const next = currentCost();

            if (next < cost) {
              cost = next;
              report.accepted++;
              report.relocations++;
              improvedThisPass = true;
              committed = true;
              break;
            }
            removeGangFromState(state, gang, data);
          }
        }

        if (!committed) {
          // Nothing better found: put it back exactly where it was.
          applyGangToState(state, gang, saved);
        }
      }

      if (!improvedThisPass) break;
    }

    // --- SWAP pass: exchange two lessons that each fit the other's slot ---
    while (Date.now() < options.deadlineMs) {
      let improvedThisPass = false;
      report.passes++;

      const order = shuffled(placed, options.rng);
      for (let i = 0; i < order.length && Date.now() < options.deadlineMs; i++) {
        const aId = order[i].electiveBlockId || order[i].id;
        const gangA = gangMap.get(aId);
        if (!gangA) continue;

        // Sampling, not exhaustive pairing: every probe rescores the whole grid,
        // so an O(n^2) sweep over 361 lessons would spend the budget on bookkeeping.
        let sampled = 0;
        for (let j = i + 1; j < order.length && Date.now() < options.deadlineMs; j++) {
          if (sampled >= SWAP_SAMPLE_SIZE) break;

          const bId = order[j].electiveBlockId || order[j].id;
          const gangB = gangMap.get(bId);
          if (!gangB || bId === aId) continue;

          const savedA = savePlacement(state, gangA);
          const savedB = savePlacement(state, gangB);
          if (!savedA || !savedB) continue;
          if (savedA.d === savedB.d && savedA.p === savedB.p) continue;

          // Two lessons of the same class on the same day may always be exchanged.
          // Permuting a day reorders it without changing what is in it: the class
          // teaches the same subjects that day, and each teacher keeps the same
          // number of periods on it, so no per-day cap can move. This is also the
          // swap worth having — sliding a lesson along its own day is how a class
          // gap closes, and how a split subject becomes continuous.
          const sameClassSameDay =
            savedA.d === savedB.d &&
            gangA[0].classIds.length === 1 &&
            gangB[0].classIds.length === 1 &&
            gangA[0].classIds[0] === gangB[0].classIds[0];

          // Otherwise require the pair to be disjoint. Teachers and classes carry
          // the per-day caps, and a cap belongs to the day as a whole: judging each
          // lesson against a grid the other has been lifted out of would miss a
          // breach they only cause together. Disjoint lessons interact solely
          // through slot occupancy, which the sequential check below does cover.
          if (!sameClassSameDay && sharesTeacherOrClass(gangA, gangB)) continue;
          sampled++;

          removeGangFromState(state, gangA, data);
          removeGangFromState(state, gangB, data);

          const newA = placementAt(state, data, gangA, savedB.d, savedB.p, maps);
          if (!newA) {
            applyGangToState(state, gangA, savedA);
            applyGangToState(state, gangB, savedB);
            continue;
          }

          // Place A first so B is judged against the grid it will actually live in.
          applyGangToState(state, gangA, newA);
          const newB = placementAt(state, data, gangB, savedA.d, savedA.p, maps);
          if (!newB) {
            removeGangFromState(state, gangA, data);
            applyGangToState(state, gangA, savedA);
            applyGangToState(state, gangB, savedB);
            continue;
          }

          report.probes++;
          applyGangToState(state, gangB, newB);
          const next = currentCost();

          if (next < cost) {
            cost = next;
            report.accepted++;
            report.swaps++;
            improvedThisPass = true;
            break;
          }

          removeGangFromState(state, gangA, data);
          removeGangFromState(state, gangB, data);
          applyGangToState(state, gangA, savedA);
          applyGangToState(state, gangB, savedB);
        }
      }

      if (!improvedThisPass) break;
    }
  };

  improvementPasses();

  if (data.settings.allowTeacherReassignment) {
    reassignTeachers(state, data, placed, gangMap, maps, options, report, weights, (next) => {
      if (next >= cost) return false;
      cost = next;
      return true;
    });
  }

  // --- Escape the local optimum while budget remains -------------------------
  //
  // Hill climbing stops when no single move improves anything, which on the
  // reference school happened after roughly 3 of the 21 seconds available: the
  // phase was not short of time, it was out of ideas. The rest of the window is
  // spent kicking the schedule out of that optimum and climbing again, keeping
  // the best arrangement seen. Every kick is undone unless it leads somewhere
  // better, so this can only improve on what hill climbing alone produced.
  let bestCost = cost;
  let bestSnapshot = snapshotPlacedGangs(state, gangMap);

  while (Date.now() < options.deadlineMs) {
    report.restarts++;

    perturb(state, data, placed, gangMap, maps, options.rng, days, maxPeriods, PERTURB_LESSONS);
    cost = currentCost();
    improvementPasses();
    cost = currentCost();

    if (cost < bestCost) {
      bestCost = cost;
      bestSnapshot = snapshotPlacedGangs(state, gangMap);
      report.restartsAccepted++;
    } else {
      restorePlacedGangs(state, data, gangMap, bestSnapshot);
      cost = bestCost;
    }
  }

  report.after = scoreSchedule(data, state.schedule, 0, weights);
  return report;
}

/**
 * Displace a handful of lessons into other legal slots, ignoring cost.
 *
 * Deliberately not an improvement step: its job is to move the schedule far
 * enough that the next climb starts somewhere new. Only legal, non-evicting
 * slots are used, so the schedule stays feasible throughout and a lesson that
 * has nowhere else to go simply stays put.
 */
function perturb(
  state: SchedulerState,
  data: AppData,
  placed: AllocationUnit[],
  gangMap: Map<string, AllocationUnit[]>,
  maps: OptimiseMaps,
  rng: () => number,
  days: number,
  maxPeriods: number,
  count: number,
): void {
  for (const leader of shuffled(placed, rng).slice(0, count)) {
    const gang = gangMap.get(leader.electiveBlockId || leader.id);
    if (!gang) continue;

    const saved = savePlacement(state, gang);
    if (!saved) continue;

    removeGangFromState(state, gang, data);

    let moved = false;
    for (const d of shuffled([...Array(days).keys()], rng)) {
      for (const p of shuffled([...Array(maxPeriods).keys()], rng)) {
        if (d === saved.d && p === saved.p) continue;
        const candidate = placementAt(state, data, gang, d, p, maps);
        if (candidate) {
          applyGangToState(state, gang, candidate);
          moved = true;
          break;
        }
      }
      if (moved) break;
    }

    if (!moved) applyGangToState(state, gang, saved);
  }
}

/**
 * Move a class's whole subject to a different qualified teacher.
 *
 * This is the only move that changes *who* teaches a lesson, and therefore the
 * only one that can affect teacher load balance or a weekly-cap breach: relocate
 * and swap shuffle lessons around the week but leave every teacher's total
 * exactly as it was, which is why those terms of the objective never moved.
 *
 * It reassigns a whole (class, subject) block rather than individual periods,
 * for two reasons. A school assigns a teacher to a class's subject, not to
 * Tuesday's Maths; and the curriculum record carries `assignedTeacherId`, so
 * moving one period would leave the timetable disagreeing with the Workload
 * screen about who teaches it.
 *
 * Joint and elective lessons are excluded. Their teacher lives on the joint-class
 * or elective definition rather than on the curriculum item, so reassigning one
 * here would desync the same way.
 */
function reassignTeachers(
  state: SchedulerState,
  data: AppData,
  placed: AllocationUnit[],
  gangMap: Map<string, AllocationUnit[]>,
  maps: OptimiseMaps,
  options: OptimiseOptions,
  report: OptimiseReport,
  weights: ObjectiveWeights,
  accept: (next: number) => boolean,
): void {
  // Teachers the school already considers qualified. Reassignment never invents
  // an expertise a teacher was not given.
  const qualified = new Map<string, string[]>();
  for (const subject of data.subjects) {
    qualified.set(
      subject.id,
      data.teachers.filter((t) => t.specialtyIds?.includes(subject.id)).map((t) => t.id),
    );
  }

  // Group by class and subject; a block moves together or not at all.
  const blocks = new Map<string, AllocationUnit[]>();
  for (const leader of placed) {
    if (leader.jointClassId || leader.electiveBlockId) continue;
    if (leader.classIds.length !== 1 || leader.teacherIds.length !== 1) continue;
    const key = `${leader.classIds[0]}|${leader.subjectId}`;
    if (!blocks.has(key)) blocks.set(key, []);
    blocks.get(key)!.push(leader);
  }

  for (const leaders of shuffled([...blocks.values()], options.rng)) {
    if (Date.now() >= options.deadlineMs) return;

    const subjectId = leaders[0].subjectId;
    const currentTeacher = leaders[0].teacherIds[0];
    const candidates = (qualified.get(subjectId) ?? []).filter((t) => t !== currentTeacher);
    if (candidates.length === 0) continue;

    const gangs = leaders
      .map((l) => gangMap.get(l.electiveBlockId || l.id))
      .filter((g): g is AllocationUnit[] => Boolean(g));

    const savedPlacements = gangs.map((g) => savePlacement(state, g));
    if (savedPlacements.some((p) => p === null)) continue;

    const savedTeachers = gangs.map((g) => g.map((u) => [...u.teacherIds]));
    const savedNames = gangs.map((g) => g.map((u) => [...u.teacherNames]));

    for (const candidate of shuffled(candidates, options.rng)) {
      if (Date.now() >= options.deadlineMs) return;

      const restore = () => {
        for (let i = 0; i < gangs.length; i++) {
          removeGangFromState(state, gangs[i], data);
          gangs[i].forEach((u, j) => {
            u.teacherIds = [...savedTeachers[i][j]];
            u.teacherNames = [...savedNames[i][j]];
          });
        }
        for (let i = 0; i < gangs.length; i++) {
          applyGangToState(state, gangs[i], savedPlacements[i]!);
        }
      };

      for (const gang of gangs) removeGangFromState(state, gang, data);
      const candidateName = maps.teacherMap.get(candidate)?.name ?? candidate;
      for (const gang of gangs) {
        for (const u of gang) {
          u.teacherIds = [candidate];
          u.teacherNames = [candidateName];
        }
      }

      // Every lesson of the block must keep its existing slot under the new
      // teacher. Re-placed one at a time so each is judged against the grid the
      // earlier ones have already been put back into.
      let placedAll = true;
      for (let i = 0; i < gangs.length; i++) {
        const saved = savedPlacements[i]!;
        const candidateMove = placementAt(state, data, gangs[i], saved.d, saved.p, maps);
        if (!candidateMove) {
          placedAll = false;
          break;
        }
        applyGangToState(state, gangs[i], candidateMove);
      }

      if (!placedAll) {
        restore();
        continue;
      }

      report.probes++;
      if (accept(scoreSchedule(data, state.schedule, 0, weights).softCost)) {
        report.accepted++;
        report.reassignments++;
        report.reassigned.push({
          classId: leaders[0].classIds[0],
          subjectId,
          fromTeacherId: currentTeacher,
          toTeacherId: candidate,
        });
        break;
      }

      restore();
    }
  }
}
