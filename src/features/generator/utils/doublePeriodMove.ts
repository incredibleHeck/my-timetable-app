import { ScheduleSlot } from "../../../types";
import { getNextClassPeriod } from "../scheduler/utils/utils";

/** Instructional periods occupied by a lesson head (1 or 2 class slots). */
export function getLessonSpanPeriods(
  headPeriod: number,
  duration: 1 | 2,
  structure: Parameters<typeof getNextClassPeriod>[1],
  maxPeriods: number,
): number[] {
  if (duration !== 2) return [headPeriod];
  const p2 = getNextClassPeriod(headPeriod, structure, maxPeriods);
  return p2 !== null ? [headPeriod, p2] : [headPeriod];
}

/** True when `period` holds part of the double being dragged (same subject/teacher). */
export function isSlotPartOfMovingLesson(
  slot: ScheduleSlot | undefined,
  sourceSlot: ScheduleSlot,
  period: number,
  sourceHeadPeriod: number,
  sourceDuration: 1 | 2,
  structure: Parameters<typeof getNextClassPeriod>[1],
  maxPeriods: number,
): boolean {
  if (!slot || sourceDuration !== 2) return false;

  const span = getLessonSpanPeriods(
    sourceHeadPeriod,
    2,
    structure,
    maxPeriods,
  );
  if (!span.includes(period)) return false;

  return (
    slot.subjectId === sourceSlot.subjectId &&
    slot.teacherId === sourceSlot.teacherId
  );
}

/** Whether a grid cell blocks placing a moving double — ignores the lesson being moved. */
export function isPeriodBlockingDoubleMove(
  slot: ScheduleSlot | undefined,
  sourceSlot: ScheduleSlot,
  period: number,
  sourceDay: number,
  targetDay: number,
  sourceHeadPeriod: number,
  sourceDuration: 1 | 2,
  structure: Parameters<typeof getNextClassPeriod>[1],
  maxPeriods: number,
): boolean {
  if (!slot) return false;
  if (
    sourceDay === targetDay &&
    isSlotPartOfMovingLesson(
      slot,
      sourceSlot,
      period,
      sourceHeadPeriod,
      sourceDuration,
      structure,
      maxPeriods,
    )
  ) {
    return false;
  }
  return true;
}
