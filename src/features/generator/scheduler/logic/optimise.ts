import { AppData, Teacher, Subject, ClassGroup, Room } from "../../../../types";
import { AllocationUnit, SchedulerState } from "../core/types";
import { applyGangToState, removeGangFromState } from "../core/state";
import { checkHardConstraints } from "./constraints";
import { determineRoom } from "./rooms";
import { getNextClassPeriod, getPeriodType, getDaysPerWeek } from "../utils/utils";
import { ObjectiveScore, ObjectiveWeights, OBJECTIVE_WEIGHTS, scoreSchedule } from "./objective";

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
  passes: number;
}

/** Partners considered per lesson in the swap pass. */
const SWAP_SAMPLE_SIZE = 12;

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

        // Only swap lessons that share no teacher and no class. Those are the
        // two entities carrying per-day caps (teacher load, subject-per-day,
        // core-per-day), and a cap is a property of the day as a whole: checking
        // each lesson against a grid the other has been lifted out of would miss
        // a breach they only cause together. Disjoint lessons interact solely
        // through slot occupancy, which the sequential check below does cover.
        if (sharesTeacherOrClass(gangA, gangB)) continue;
        sampled++;

        const savedA = savePlacement(state, gangA);
        const savedB = savePlacement(state, gangB);
        if (!savedA || !savedB) continue;
        if (savedA.d === savedB.d && savedA.p === savedB.p) continue;

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

  report.after = scoreSchedule(data, state.schedule, 0, weights);
  return report;
}
