import { describe, it, expect } from "vitest";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData } from "../src/types";
import {
  applyTeacherReassignments,
  describeReassignments,
  TeacherReassignment,
} from "../src/features/generator/utils/applyReassignments";

/**
 * When the optimiser hands a class's subject to a different qualified teacher,
 * the generated grid says so immediately but the curriculum does not — and the
 * Workload screen reads the curriculum. Without this write-back the two screens
 * disagree about who teaches what, and the disagreement outlives the generation
 * that caused it.
 */

function build(): AppData {
  return {
    ...DEFAULT_DATA,
    subjects: [
      { id: "s1", name: "Math", color: "#f00" },
      { id: "s2", name: "Arts", color: "#0f0" },
    ],
    teachers: [
      { id: "t1", name: "Aunty Evelyn", specialtyIds: ["s1", "s2"], constraints: [] },
      { id: "t2", name: "Uncle Eric", specialtyIds: ["s1", "s2"], constraints: [] },
      { id: "t3", name: "Aunty Vida", specialtyIds: ["s1"], constraints: [] },
    ],
    classes: [
      {
        id: "c1",
        name: "Year 7B",
        curriculum: [
          { subjectId: "s1", periodsPerWeek: 4, assignedTeacherId: "t1" },
          { subjectId: "s2", periodsPerWeek: 2, assignedTeacherId: "t1" },
        ],
      },
      {
        id: "c2",
        name: "Year 8",
        curriculum: [{ subjectId: "s1", periodsPerWeek: 3, assignedTeacherId: "t3" }],
      },
    ],
  } as unknown as AppData;
}

const teacherFor = (data: AppData, classId: string, subjectId: string) =>
  data.classes.find((c) => c.id === classId)?.curriculum.find((i) => i.subjectId === subjectId)
    ?.assignedTeacherId;

describe("applyTeacherReassignments", () => {
  it("writes the new teacher into the curriculum", () => {
    const move: TeacherReassignment = {
      classId: "c1",
      subjectId: "s2",
      fromTeacherId: "t1",
      toTeacherId: "t2",
    };

    const { data, applied } = applyTeacherReassignments(build(), [move]);

    expect(applied).toHaveLength(1);
    expect(teacherFor(data, "c1", "s2")).toBe("t2");
    // Only the named subject moves; the class's other subject is untouched.
    expect(teacherFor(data, "c1", "s1")).toBe("t1");
    expect(teacherFor(data, "c2", "s1")).toBe("t3");
  });

  it("applies several moves across different classes", () => {
    const moves: TeacherReassignment[] = [
      { classId: "c1", subjectId: "s1", fromTeacherId: "t1", toTeacherId: "t2" },
      { classId: "c2", subjectId: "s1", fromTeacherId: "t3", toTeacherId: "t1" },
    ];

    const { data, applied } = applyTeacherReassignments(build(), moves);

    expect(applied).toHaveLength(2);
    expect(teacherFor(data, "c1", "s1")).toBe("t2");
    expect(teacherFor(data, "c2", "s1")).toBe("t1");
  });

  it("ignores a move whose starting teacher no longer matches", () => {
    // The user re-assigned this subject by hand after the solve. Their edit wins.
    const stale: TeacherReassignment = {
      classId: "c1",
      subjectId: "s1",
      fromTeacherId: "t2",
      toTeacherId: "t3",
    };

    const { data, applied } = applyTeacherReassignments(build(), [stale]);

    expect(applied).toHaveLength(0);
    expect(teacherFor(data, "c1", "s1")).toBe("t1");
  });

  it("leaves the object identity alone when nothing applies", () => {
    const original = build();
    expect(applyTeacherReassignments(original, []).data).toBe(original);
    expect(applyTeacherReassignments(original, undefined).data).toBe(original);
    expect(
      applyTeacherReassignments(original, [
        { classId: "nope", subjectId: "s1", fromTeacherId: "t1", toTeacherId: "t2" },
      ]).data,
    ).toBe(original);
  });

  it("does not mutate the data it was given", () => {
    const original = build();
    applyTeacherReassignments(original, [
      { classId: "c1", subjectId: "s2", fromTeacherId: "t1", toTeacherId: "t2" },
    ]);
    expect(teacherFor(original, "c1", "s2")).toBe("t1");
  });

  it("describes each change in names a timetabler would recognise", () => {
    const move: TeacherReassignment = {
      classId: "c1",
      subjectId: "s2",
      fromTeacherId: "t1",
      toTeacherId: "t2",
    };
    const { data, applied } = applyTeacherReassignments(build(), [move]);

    expect(describeReassignments(data, applied)).toEqual([
      "Year 7B Arts: Aunty Evelyn → Uncle Eric",
    ]);
  });
});
