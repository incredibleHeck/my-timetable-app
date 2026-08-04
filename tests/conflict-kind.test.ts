import { describe, it, expect } from "vitest";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData, ScheduleResult } from "../src/types";
import { auditFinalSchedule } from "../src/features/generator/scheduler/validation";

/**
 * The conflict panel splits its list three ways — hard collisions, unplaced
 * lessons, quality warnings — and decides which is which from `Conflict.kind`.
 *
 * That field was declared and then assigned in exactly two places, so nothing
 * was ever tagged "quality": the bucket was permanently empty, and a pedagogical
 * preference such as "these sessions should be continuous" was shown beside a
 * genuine double-booking as though both were equally broken.
 */

const PERIODS = 6;
const DAYS = 2;

function build(schedule: ScheduleResult, over: Partial<AppData> = {}): AppData {
  return {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: PERIODS,
      daysPerWeek: DAYS,
      dayStructure: Array.from({ length: PERIODS }, (_, i) => ({
        type: "CLASS" as const,
        label: `P${i + 1}`,
      })),
      fixedOccasions: Array.from({ length: DAYS }, () => Array.from({ length: PERIODS }, () => "")),
    },
    subjects: [
      { id: "s1", name: "Math", color: "#f00" },
      { id: "s2", name: "English", color: "#0f0" },
    ],
    teachers: [
      {
        id: "t1",
        name: "T1",
        specialtyIds: ["s1", "s2"],
        constraints: Array.from({ length: DAYS }, () =>
          Array.from({ length: PERIODS }, () => false),
        ),
      },
    ],
    classes: [
      { id: "c1", name: "10A", curriculum: [], defaultRoomId: "r1", periodCount: PERIODS },
      { id: "c2", name: "10B", curriculum: [], defaultRoomId: "r2", periodCount: PERIODS },
    ],
    rooms: [
      { id: "r1", name: "R1", capacity: 100 },
      { id: "r2", name: "R2", capacity: 100 },
    ],
    schedule,
    ...over,
  } as unknown as AppData;
}

function slot(classId: string, subjectId: string, teacherId: string, roomId: string) {
  return { classId, subjectId, teacherId, roomId, duration: 1, isFixed: false };
}

describe("Conflict.kind", () => {
  it("labels a teacher in two classes at once as blocking", () => {
    // One teacher, two different classes, same day and period.
    const schedule: ScheduleResult = {
      c1: { 0: { 0: slot("c1", "s1", "t1", "r1") } },
      c2: { 0: { 0: slot("c2", "s2", "t1", "r2") } },
    } as unknown as ScheduleResult;

    const conflicts = auditFinalSchedule(build(schedule), { mode: "full" });
    const blocking = conflicts.filter((c) => c.kind === "blocking");

    expect(blocking.length).toBeGreaterThan(0);
    expect(blocking.every((c) => c.severity === "HIGH")).toBe(true);
  });

  it("labels a class gap as quality, not as a collision", () => {
    // 10A teaches P1 and P4 with nothing between — dead time, but the timetable
    // is perfectly runnable.
    const schedule: ScheduleResult = {
      c1: {
        0: {
          0: slot("c1", "s1", "t1", "r1"),
          3: slot("c1", "s2", "t1", "r1"),
        },
      },
    } as unknown as ScheduleResult;

    const conflicts = auditFinalSchedule(build(schedule), { mode: "full" });
    const gaps = conflicts.filter((c) => c.reason.toLowerCase().includes("gap"));

    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.every((c) => c.kind === "quality")).toBe(true);
  });

  it("gives every conflict a kind", () => {
    const schedule: ScheduleResult = {
      c1: {
        0: {
          0: slot("c1", "s1", "t1", "r1"),
          3: slot("c1", "s2", "t1", "r1"),
        },
      },
      c2: { 0: { 0: slot("c2", "s2", "t1", "r2") } },
    } as unknown as ScheduleResult;

    const conflicts = auditFinalSchedule(build(schedule), { mode: "full" });
    expect(conflicts.length).toBeGreaterThan(0);
    for (const c of conflicts) {
      expect(c.kind === "blocking" || c.kind === "quality").toBe(true);
    }
  });

  it("never labels a HIGH-severity conflict as merely a preference", () => {
    const schedule: ScheduleResult = {
      c1: { 0: { 0: slot("c1", "s1", "t1", "r1") } },
      c2: { 0: { 0: slot("c2", "s2", "t1", "r2") } },
    } as unknown as ScheduleResult;

    const conflicts = auditFinalSchedule(build(schedule), { mode: "full" });
    for (const c of conflicts) {
      if (c.severity === "HIGH") expect(c.kind).toBe("blocking");
    }
  });
});
