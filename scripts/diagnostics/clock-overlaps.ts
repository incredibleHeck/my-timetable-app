/**
 * WALL-CLOCK OVERLAP AUDIT
 *
 * Occupancy is tracked by period index. When classes stagger their breaks, the
 * same index is a different time of day for different classes — so two lessons
 * at different indices can still collide in reality. This checks the generated
 * timetable against actual clock times rather than indices, for every kind of
 * resource a lesson consumes.
 *
 *   npm run diagnostics:clock -- --fixture path/to/data.json
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { AppData } from "../../src/types";
import { prepareAllocationUnits } from "../../src/features/generator/scheduler/logic/preparation";
import { resolveSubjectIsCore } from "../../src/features/generator/scheduler/logic/subject-core";
import { solveSmart } from "../../src/features/generator/scheduler/solver/solver";
import { initializeState } from "../../src/features/generator/scheduler/core/state";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = arg("fixture") ?? path.join(HERE, "fixtures", "school-data.json");
const BUDGET_MS = Number(arg("budget") ?? 45000);
const SEED = Number(arg("seed") ?? 12345);

const REASSIGN = process.argv.includes("--reassign");
/**
 * --link ties each single-resource subject to a room whose name matches it,
 * modelling a school that has set the Fixed Facility picker. That turns four
 * specialist rooms into genuinely shared ones, which is precisely the situation
 * this audit exists to check: several classes competing for one lab.
 */
const LINK = process.argv.includes("--link");

const raw = JSON.parse(fs.readFileSync(FIXTURE, "utf-8"));
const loaded: AppData = raw.data ?? raw;

const subjects = loaded.subjects.map((s) => {
  if (!LINK || !s.isSingleResource || s.requiredRoomId) return s;
  const match = loaded.rooms.find((r) =>
    r.name.toLowerCase().includes(s.name.toLowerCase().split(" ")[0]),
  );
  return match ? { ...s, requiredRoomId: match.id } : s;
});

const data: AppData = {
  ...loaded,
  subjects,
  settings: REASSIGN ? { ...loaded.settings, allowTeacherReassignment: true } : loaded.settings,
  schedule: {},
  conflicts: [],
};

if (LINK) {
  const linked = subjects.filter((s, i) => s.requiredRoomId && !loaded.subjects[i].requiredRoomId);
  console.log(
    `linked ${linked.length} single-resource subject(s) to rooms: ` +
      linked.map((s) => s.name).join(", "),
  );
}

const units = prepareAllocationUnits(data);
const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));
units.forEach((u) => {
  if (u.isCore === undefined) {
    u.isCore = resolveSubjectIsCore(subjectMap.get(u.subjectId));
  }
});

const started = Date.now();
const result = solveSmart(units, data, () => true, {
  runs: 3,
  timeBudgetMs: BUDGET_MS,
  clockStartMs: started,
  calibrate: true,
  shuffleConstruction: true,
  seed: SEED,
});

// Time ranges are per class and per period index.
const ranges = initializeState(data).classTimeRanges;
const classById = new Map(data.classes.map((c) => [c.id, c]));

type Booking = {
  classId: string;
  className: string;
  day: number;
  period: number;
  start: number;
  end: number;
  subjectId?: string;
  teacherId?: string;
  roomId?: string;
};

const bookings: Booking[] = [];
for (const classId of Object.keys(result.schedule)) {
  for (const dayKey of Object.keys(result.schedule[classId] ?? {})) {
    const day = Number(dayKey);
    for (const periodKey of Object.keys(result.schedule[classId][day] ?? {})) {
      const period = Number(periodKey);
      const slot = result.schedule[classId][day][period];
      if (!slot) continue;
      const range = ranges.get(classId)?.[period];
      if (!range) continue;
      bookings.push({
        classId,
        className: classById.get(classId)?.name ?? classId,
        day,
        period,
        start: range.start,
        end: range.end,
        subjectId: slot.subjectId,
        teacherId: slot.teacherId,
        roomId: slot.roomId,
      });
    }
  }
}

const overlaps = (a: Booking, b: Booking) => a.day === b.day && a.start < b.end && b.start < a.end;

/** Two classes taught together in one slot are one lesson, not a clash. */
function isJoint(a: Booking, b: Booking): boolean {
  return (
    data.jointClasses?.some(
      (jc) =>
        jc.subjectId === a.subjectId &&
        jc.subjectId === b.subjectId &&
        jc.classIds.includes(a.classId) &&
        jc.classIds.includes(b.classId),
    ) ?? false
  );
}

function report(label: string, keyOf: (b: Booking) => string | undefined) {
  const groups = new Map<string, Booking[]>();
  for (const b of bookings) {
    const key = keyOf(b);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(b);
  }

  const clashes: string[] = [];
  for (const [key, list] of groups) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.classId === b.classId) continue;
        if (!overlaps(a, b)) continue;
        if (isJoint(a, b)) continue;
        const sameIndex = a.period === b.period;
        clashes.push(
          `${key}: ${a.className} P${a.period} vs ${b.className} P${b.period} ` +
            `on day ${a.day} (${sameIndex ? "same index" : "STAGGERED"})`,
        );
      }
    }
  }

  console.log(`\n${label}: ${clashes.length} clash(es)`);
  clashes.slice(0, 8).forEach((c) => console.log(`  ${c}`));
  if (clashes.length > 8) console.log(`  ... and ${clashes.length - 8} more`);
}

console.log(
  `fixture ${path.basename(FIXTURE)} | unplaced ${result.unplacedGangs} | ` +
    `${bookings.length} bookings audited against wall-clock times`,
);

if (REASSIGN) {
  const moved = result.reassignedTeachers ?? [];
  const byName = new Map(data.teachers.map((t) => [t.id, t.name]));
  const classByName = new Map(data.classes.map((c) => [c.id, c.name]));
  const subjectByName = new Map(data.subjects.map((s) => [s.id, s.name]));
  console.log(`
reassignments: ${moved.length}`);
  moved
    .slice(0, 10)
    .forEach((m) =>
      console.log(
        `  ${classByName.get(m.classId)} ${subjectByName.get(m.subjectId)}: ` +
          `${byName.get(m.fromTeacherId)} -> ${byName.get(m.toTeacherId)}`,
      ),
    );
  if (moved.length > 10) console.log(`  ... and ${moved.length - 10} more`);
}

report("TEACHER double-booked", (b) => (b.teacherId ? `teacher ${b.teacherId}` : undefined));
report("ROOM double-booked", (b) => (b.roomId ? `room ${b.roomId}` : undefined));
report("SINGLE-RESOURCE subject double-booked", (b) => {
  const subject = subjectMap.get(b.subjectId ?? "");
  return subject?.isSingleResource ? `resource ${subject.id}` : undefined;
});
