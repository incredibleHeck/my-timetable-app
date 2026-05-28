import { useMemo, useCallback } from "react";
import { AppData, ScheduleSlot } from "../../../types";
import { checkSlotValidity } from "../scheduler/validation";
import { initializeState } from "../scheduler/core/state";
import { useHistory } from "../../../contexts/HistoryContext";
import { DAYS } from "../../../utils/constants";
import { generateId } from "../../../utils/utils";
import { getNextClassPeriod } from "../scheduler/utils/utils";
import { getPendingPlacementsForClass, PendingPlacement } from "../utils/pendingPlacements";

export function canPlacePendingAt(
  data: AppData,
  classId: string,
  day: number,
  period: number,
  pending: PendingPlacement,
): { valid: boolean; message?: string } {
  const cls = data.classes.find((c) => c.id === classId);
  const structure = cls?.structure || data.settings.dayStructure;
  const periodLimit = cls?.periodCount ?? data.settings.periodsPerDay;
  const schedulerState = initializeState(data);

  if (data.schedule[classId]?.[day]?.[period]) {
    return { valid: false, message: "Slot is already occupied" };
  }

  if (pending.duration === 2) {
    const p2 = getNextClassPeriod(period, structure, periodLimit);
    if (p2 === null) {
      return { valid: false, message: "Not enough time for a double period" };
    }
    if (data.schedule[classId]?.[day]?.[p2]) {
      return { valid: false, message: "Next period is occupied" };
    }
  }

  const result = checkSlotValidity(
    data,
    day,
    period,
    pending.teacherId,
    classId,
    pending.subjectId,
    schedulerState,
    undefined,
    pending.roomId,
    pending.duration,
  );

  return result.valid
    ? { valid: true }
    : { valid: false, message: result.message || "Invalid placement" };
}

export const useManualPlacement = (data: AppData, onUpdate: (d: AppData) => void) => {
  const { pushToHistory } = useHistory();

  const listPendingForClass = useCallback(
    (classId: string) => getPendingPlacementsForClass(data, classId),
    [data],
  );

  const listValidPendingForSlot = useCallback(
    (classId: string, day: number, period: number) => {
      return getPendingPlacementsForClass(data, classId).filter(
        (pending) => canPlacePendingAt(data, classId, day, period, pending).valid,
      );
    },
    [data],
  );

  const placePendingLesson = useCallback(
    (
      classId: string,
      day: number,
      period: number,
      pending: PendingPlacement,
    ): { ok: true } | { ok: false; message: string } => {
      const check = canPlacePendingAt(data, classId, day, period, pending);
      if (!check.valid) {
        return { ok: false, message: check.message || "Cannot place here" };
      }

      const cls = data.classes.find((c) => c.id === classId);
      const structure = cls?.structure || data.settings.dayStructure;
      const periodLimit = cls?.periodCount ?? data.settings.periodsPerDay;
      const subject = data.subjects.find((s) => s.id === pending.subjectId);

      const newSchedule = JSON.parse(JSON.stringify(data.schedule)) as AppData["schedule"];
      if (!newSchedule[classId]) newSchedule[classId] = {};
      if (!newSchedule[classId][day]) newSchedule[classId][day] = {};

      const unitId = `MANUAL-${classId}-${day}-${period}-${pending.id}`;
      const slot: ScheduleSlot = {
        subjectId: pending.subjectId,
        teacherId: pending.teacherId,
        classId,
        unitId,
        isFixed: false,
      };

      if (subject?.requiredRoomId) {
        slot.roomId = subject.requiredRoomId;
      }

      newSchedule[classId][day][period] = slot;

      if (pending.duration === 2) {
        const p2 = getNextClassPeriod(period, structure, periodLimit);
        if (p2 !== null) {
          newSchedule[classId][day][p2] = { ...slot, isFixed: true };
        }
      }

      const nextData: AppData = { ...data, schedule: newSchedule };
      const durationLabel = pending.duration === 2 ? "double" : "single";
      const message = `Manually placed ${pending.subjectName} (${durationLabel}) in ${cls?.name || "class"} on ${DAYS[day]} P${period + 1}`;

      pushToHistory(data);
      onUpdate({
        ...nextData,
        conflicts: [],
        recentActivity: [
          {
            id: generateId(),
            type: "SCHEDULING" as const,
            message,
            timestamp: new Date().toISOString(),
          },
          ...(data.recentActivity || []),
        ].slice(0, 50),
      });

      return { ok: true };
    },
    [data, onUpdate, pushToHistory],
  );

  const hasPendingForClass = useMemo(
    () => (classId: string) => getPendingPlacementsForClass(data, classId).length > 0,
    [data],
  );

  return {
    listPendingForClass,
    listValidPendingForSlot,
    placePendingLesson,
    hasPendingForClass,
  };
};

export type { PendingPlacement };
