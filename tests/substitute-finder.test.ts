import { describe, it, expect } from "vitest";
import {
  findAffectedLessons,
  rankCandidates,
  buildCoverPlan,
} from "../src/features/substitutes/logic/substituteFinder";
import { AppData } from "../src/types";

// Teachers:
//  t1 (absent) teaches Math on Monday P0 and P2 (7A), joint P0 also covers 7B
//  t2 Math specialist, free Monday
//  t3 Art specialist, teaching Monday P0 (busy then), free P2
//  t4 Math specialist but constraint-blocked Monday P2
const makeData = (): AppData =>
  ({
    settings: {
      periodsPerDay: 3,
      daysPerWeek: 5,
      dayStructure: [
        { type: "CLASS", label: "P1" },
        { type: "CLASS", label: "P2" },
        { type: "CLASS", label: "P3" },
      ],
      fixedOccasions: [],
      timeSlots: [],
      maxConsecutivePeriods: 4,
      maxTeacherPeriodsPerDay: 5,
    },
    subjects: [
      { id: "math", name: "Math", color: "#111" },
      { id: "art", name: "Art", color: "#222" },
    ],
    teachers: [
      { id: "t1", name: "Absent Ada", specialtyIds: ["math"], constraints: [] },
      { id: "t2", name: "Free Bo", specialtyIds: ["math"], constraints: [] },
      { id: "t3", name: "Busy Cy", specialtyIds: ["art"], constraints: [] },
      {
        id: "t4",
        name: "Blocked Di",
        specialtyIds: ["math"],
        // Monday (day 0) P2 blocked
        constraints: [[false, false, true], [], [], [], []],
      },
    ],
    rooms: [{ id: "r1", name: "Room 1", capacity: 30, type: "std" }],
    classes: [
      { id: "7A", name: "7A", defaultRoomId: "r1", curriculum: [] },
      { id: "7B", name: "7B", defaultRoomId: "r1", curriculum: [] },
      { id: "8A", name: "8A", defaultRoomId: "r1", curriculum: [] },
    ],
    jointClasses: [],
    electives: [],
    exams: [],
    dutyLocations: [],
    schedule: {
      "7A": {
        0: {
          0: { subjectId: "math", teacherId: "t1", classId: "7A", roomId: "r1" },
          2: { subjectId: "math", teacherId: "t1", classId: "7A", roomId: "r1" },
        },
      },
      "7B": {
        0: {
          // joint: same period as 7A P0 with t1
          0: { subjectId: "math", teacherId: "t1", classId: "7B", roomId: "r1" },
        },
      },
      // t3 (Busy Cy) teaches Art in 8A at Monday P0 => busy that period, free at P2
      "8A": {
        0: {
          0: { subjectId: "art", teacherId: "t3", classId: "8A", roomId: "r1" },
        },
      },
    },
    conflicts: [],
    lastGenerated: "2026-08-01",
    recentActivity: [],
  }) as unknown as AppData;

describe("substitute finder", () => {
  it("finds the absent teacher's lessons for the day and merges joint classes", () => {
    const lessons = findAffectedLessons(makeData(), "t1", 0);
    // P0 (7A + 7B merged) and P2 (7A) => 2 lessons
    expect(lessons).toHaveLength(2);
    const p0 = lessons.find((l) => l.period === 0)!;
    expect(p0.classIds.sort()).toEqual(["7A", "7B"]);
    expect(p0.className).toContain("7A");
    expect(p0.className).toContain("7B");
    expect(lessons.find((l) => l.period === 2)?.className).toBe("7A");
  });

  it("returns no lessons on a day the teacher does not work", () => {
    expect(findAffectedLessons(makeData(), "t1", 1)).toHaveLength(0);
  });

  it("ranks a free qualified teacher above others and excludes the absent teacher", () => {
    const data = makeData();
    const [p0] = findAffectedLessons(data, "t1", 0);
    const candidates = rankCandidates(data, p0, "t1");
    // The absent teacher is never offered as their own cover
    expect(candidates.some((c) => c.teacherId === "t1")).toBe(false);
    // Top candidate is qualified, free, and under cap (t2 and t4 both qualify at P0)
    expect(candidates[0].qualified).toBe(true);
    expect(candidates[0].atDailyCap).toBe(false);
    expect(candidates.find((c) => c.teacherId === "t2")?.qualified).toBe(true);
  });

  it("excludes teachers who are busy that period", () => {
    const data = makeData();
    const [p0] = findAffectedLessons(data, "t1", 0);
    const candidates = rankCandidates(data, p0, "t1");
    // t3 is teaching at P0 (7B) => not a candidate
    expect(candidates.some((c) => c.teacherId === "t3")).toBe(false);
  });

  it("excludes teachers blocked by their own constraints", () => {
    const data = makeData();
    const p2 = findAffectedLessons(data, "t1", 0).find((l) => l.period === 2)!;
    const candidates = rankCandidates(data, p2, "t1");
    // t4 is Math-qualified but blocked Monday P2
    expect(candidates.some((c) => c.teacherId === "t4")).toBe(false);
    // t3 is free at P2 (only taught P0) but unqualified for Math
    const cy = candidates.find((c) => c.teacherId === "t3");
    expect(cy?.qualified).toBe(false);
  });

  it("counts prior cover assignments toward a candidate's daily load and cap", () => {
    const data = makeData();
    data.settings.maxTeacherPeriodsPerDay = 1; // t2 already teaches 0 on Monday
    const p2 = findAffectedLessons(data, "t1", 0).find((l) => l.period === 2)!;
    // Assign t2 to cover P0 already -> dayLoad becomes 1 -> at cap for P2
    const candidates = rankCandidates(data, p2, "t1", { 0: "t2" });
    const bo = candidates.find((c) => c.teacherId === "t2")!;
    expect(bo.dayLoad).toBe(1);
    expect(bo.atDailyCap).toBe(true);
  });

  it("buildCoverPlan pairs every affected lesson with candidates", () => {
    const plan = buildCoverPlan(makeData(), "t1", 0);
    expect(plan).toHaveLength(2);
    expect(plan.every((entry) => entry.candidates.length > 0)).toBe(true);
  });
});
