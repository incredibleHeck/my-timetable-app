import { describe, it, expect } from "vitest";
import { buildTeacherICal, buildClassICal } from "../src/services/export/ical";
import { AppData, Settings } from "../src/types";

const settings: Settings = {
  periodsPerDay: 3,
  dayStructure: [
    { type: "CLASS", label: "P1" },
    { type: "CLASS", label: "P2" },
    { type: "CLASS", label: "P3" },
  ],
  fixedOccasions: [],
  timeSlots: [
    { start: "08:00", end: "08:40" },
    { start: "08:40", end: "09:20" },
    { start: "09:20", end: "10:00" },
  ],
  maxConsecutivePeriods: 4,
  schoolStartTime: "08:00",
  defaultClassDuration: 40,
};

const makeData = (): AppData =>
  ({
    settings,
    subjects: [
      { id: "s1", name: "Math", color: "#000" },
      { id: "s2", name: "Art, Craft", color: "#111" },
    ],
    teachers: [{ id: "t1", name: "Ada", specialtyIds: [], constraints: [] }],
    rooms: [{ id: "r1", name: "Room 101", capacity: 30, type: "standard" }],
    classes: [
      { id: "c1", name: "7A", defaultRoomId: "r1", curriculum: [] },
      { id: "c2", name: "7B", defaultRoomId: "r1", curriculum: [] },
    ],
    jointClasses: [],
    electives: [],
    exams: [],
    dutyLocations: [],
    schedule: {
      // 7A: Monday double-period Math (p0+p1), Tuesday Art at p2
      c1: {
        0: {
          0: { subjectId: "s1", teacherId: "t1", classId: "c1", roomId: "r1", isFixed: true },
          1: { subjectId: "s1", teacherId: "t1", classId: "c1", roomId: "r1", isFixed: true },
        },
        1: {
          2: { subjectId: "s2", teacherId: "t1", classId: "c1" },
        },
      },
      // 7B: Monday Math at p0 (joint with 7A — same teacher/time/subject)
      c2: {
        0: {
          0: { subjectId: "s1", teacherId: "t1", classId: "c2", roomId: "r1", isFixed: true },
        },
      },
    },
    conflicts: [],
    lastGenerated: null,
    recentActivity: [],
  }) as unknown as AppData;

const countEvents = (ics: string): number => (ics.match(/BEGIN:VEVENT/g) || []).length;

describe("iCal export", () => {
  it("produces a valid VCALENDAR wrapper with CRLF line endings", () => {
    const ics = buildClassICal(makeData(), "c1");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("\r\n");
  });

  it("merges contiguous double periods into a single event", () => {
    const ics = buildClassICal(makeData(), "c1");
    // Monday double (p0+p1) => 1 event, Tuesday Art => 1 event
    expect(countEvents(ics)).toBe(2);
    // Double spans 08:00 -> 09:20 (end of p1), not 08:40
    expect(ics).toContain("DTEND:20");
    expect(ics).toMatch(/DTEND:\d{8}T092000/);
  });

  it("emits a weekly RRULE with the default count", () => {
    const ics = buildClassICal(makeData(), "c1");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;COUNT=18");
  });

  it("honours a custom week count", () => {
    const ics = buildClassICal(makeData(), "c1", 6);
    expect(ics).toContain("RRULE:FREQ=WEEKLY;COUNT=6");
    expect(ics).not.toContain("COUNT=18");
  });

  it("escapes reserved characters in text fields", () => {
    const ics = buildClassICal(makeData(), "c1");
    expect(ics).toContain("SUMMARY:Art\\, Craft");
  });

  it("includes room as LOCATION and teacher in DESCRIPTION for a class calendar", () => {
    const ics = buildClassICal(makeData(), "c1");
    expect(ics).toContain("LOCATION:Room 101");
    expect(ics).toContain("DESCRIPTION:Teacher: Ada");
  });

  it("de-duplicates joint lessons in a teacher calendar and lists all classes", () => {
    const ics = buildTeacherICal(makeData(), "t1");
    // Monday Math (joint 7A+7B, deduped) + Tuesday Art = 2 events
    expect(countEvents(ics)).toBe(2);
    // Comma between class names is RFC-5545 escaped
    expect(ics).toContain("DESCRIPTION:Class: 7A\\, 7B");
    expect(ics).toContain("SUMMARY:Math");
  });

  it("skips periods with no scheduled lesson", () => {
    const data = makeData();
    // Class c2 only has one lesson => exactly one event
    const ics = buildClassICal(data, "c2");
    expect(countEvents(ics)).toBe(1);
  });
});
