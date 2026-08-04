import { AppData, Subject, Teacher, ClassGroup, Room } from "../../../../types";
import { AllocationUnit, SchedulerState } from "../core/types";
import { BlockingReason, BLOCKING_REASON_LABELS, checkHardConstraints } from "./constraints";
import { getDaysPerWeek, getNextClassPeriod, getPeriodType } from "../utils/utils";

/**
 * WHY WAS THIS LESSON NOT PLACED?
 *
 * When the solver gives up on a lesson the user was told only that the system
 * "could not find a valid slot" — true, useless, and identical for every cause.
 * The information needed to say more was always there and was thrown away one
 * slot at a time, because the constraint check returned a bare boolean.
 *
 * This walks the same candidate slots the solver walked, in the same order, and
 * counts which predicate rejected each one. The result names the binding
 * constraint: "blocked in 63 of 65 slots — teacher already teaching (48),
 * class already has a lesson (15)".
 *
 * Diagnosis only. It never places anything and never changes a rule; it runs
 * once per unplaced lesson at the end of a solve, not in the search loop.
 */

export interface UnplacedDiagnosis {
  /** Candidate (day, period) starts considered. */
  slotsConsidered: number;
  /** Slots rejected — equal to `slotsConsidered` for a genuinely unplaced unit. */
  slotsBlocked: number;
  /** Reason counts, most frequent first. */
  reasons: Array<{ reason: BlockingReason; count: number; label: string }>;
  /** One sentence naming the binding constraints. */
  summary: string;
}

/** Maps for the constraint engine, built once per solve. */
export interface DiagnosisMaps {
  teacherMap: Map<string, Teacher>;
  subjectMap: Map<string, Subject>;
  classMap: Map<string, ClassGroup>;
  roomMap: Map<string, Room>;
}

/**
 * Period ceiling used when scanning. `findValidMoves` hardcodes 15 here; we
 * derive it from the data instead so the scan neither misses late periods on a
 * long day nor invents slots that cannot exist. Reasons are only recorded for
 * slots the solver would actually have tried, so the counts stay comparable.
 */
function periodCeiling(data: AppData, unit: AllocationUnit, maps: DiagnosisMaps): number {
  let ceiling = data.settings.periodsPerDay ?? 0;
  for (const cid of unit.classIds) {
    const cls = maps.classMap.get(cid);
    const structLen = (cls?.structure ?? data.settings.dayStructure)?.length ?? 0;
    ceiling = Math.max(ceiling, cls?.periodCount ?? 0, structLen);
  }
  return ceiling;
}

/**
 * Replays the solver's slot scan for one gang, tallying rejection reasons.
 *
 * `gangUnits` must be the whole gang: a joint lesson is legal only where every
 * partner class is free, so diagnosing the leader alone would report slots as
 * available that the solver correctly refused.
 */
export function diagnoseUnplacedGang(
  state: SchedulerState,
  data: AppData,
  gangUnits: AllocationUnit[],
  maps: DiagnosisMaps,
): UnplacedDiagnosis {
  const counts = new Map<BlockingReason, number>();
  const bump = (reason: BlockingReason) => counts.set(reason, (counts.get(reason) ?? 0) + 1);

  const days = getDaysPerWeek(data.settings);
  const maxPeriods = periodCeiling(data, gangUnits[0], maps);

  let slotsConsidered = 0;
  let slotsBlocked = 0;

  for (let d = 0; d < days; d++) {
    for (let p = 0; p < maxPeriods; p++) {
      slotsConsidered++;

      // Record at most one reason per slot: the first predicate to reject it is
      // the one the solver stopped at, so counting every later failure too would
      // overstate constraints that were never actually reached.
      let recorded = false;
      const recordOnce = (reason: BlockingReason) => {
        if (recorded) return;
        recorded = true;
        bump(reason);
      };

      let blocked = false;

      for (const u of gangUnits) {
        const cls = maps.classMap.get(u.classIds[0]);
        const struct = cls?.structure || data.settings.dayStructure;
        const classLimit = cls?.periodCount ?? data.settings.periodsPerDay;

        if (p >= classLimit) {
          recordOnce("PERIOD_OUT_OF_RANGE");
          blocked = true;
          break;
        }
        if (getPeriodType(struct, p) !== "CLASS") {
          recordOnce("NOT_A_CLASS_PERIOD");
          blocked = true;
          break;
        }

        let p2 = -1;
        if (u.duration === 2) {
          const next = getNextClassPeriod(p, struct, classLimit);
          if (next === null) {
            recordOnce("NO_SECOND_PERIOD_FOR_DOUBLE");
            blocked = true;
            break;
          }
          p2 = next;
        }

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
          { onReject: recordOnce },
        );

        if (!legal) {
          blocked = true;
          break;
        }
      }

      if (blocked) slotsBlocked++;
    }
  }

  const reasons = [...counts.entries()]
    .map(([reason, count]) => ({ reason, count, label: BLOCKING_REASON_LABELS[reason] }))
    .sort((a, b) => b.count - a.count);

  return {
    slotsConsidered,
    slotsBlocked,
    reasons,
    summary: summarise(slotsBlocked, slotsConsidered, reasons),
  };
}

/**
 * Names the top causes. Capped at three: beyond that the tail is noise, and a
 * conflict row has to stay readable.
 *
 * The free-slot count leads when it is non-zero, because it changes what the
 * user should do. "Blocked everywhere" means the timetable is over-constrained
 * and a rule or an availability window has to give. "Legal slots remained" means
 * the search ran out of effort, and the fix is to generate again or raise the
 * budget — changing constraints would be the wrong response entirely.
 */
function summarise(
  blocked: number,
  considered: number,
  reasons: UnplacedDiagnosis["reasons"],
): string {
  const free = considered - blocked;
  const top = reasons
    .slice(0, 3)
    .map((r) => `${r.label} (${r.count})`)
    .join(", ");

  if (free > 0) {
    return (
      `${free} of ${considered} slots were still free — the search gave up rather than ran out of room. ` +
      `Elsewhere: ${top}.`
    );
  }
  if (reasons.length === 0) {
    return "No candidate slot was rejected — the lesson was dropped after the slot scan, not by a constraint.";
  }
  return `Blocked in all ${considered} slots — ${top}.`;
}
