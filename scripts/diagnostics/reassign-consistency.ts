/**
 * DOES THE WORKLOAD SCREEN AGREE WITH THE TIMETABLE?
 *
 * With teacher reassignment enabled, the optimiser can hand a class's subject to
 * a different qualified teacher. The grid reflects that immediately; the
 * curriculum does not, and the Workload screen reads the curriculum. This runs a
 * real solve, applies the write-back the app performs, and compares who the two
 * sources think teaches each period.
 *
 *   npm run diagnostics:reassign -- --fixture path/to/data.json
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { AppData } from "../../src/types";
import { prepareAllocationUnits } from "../../src/features/generator/scheduler/logic/preparation";
import { resolveSubjectIsCore } from "../../src/features/generator/scheduler/logic/subject-core";
import { solveSmart } from "../../src/features/generator/scheduler/solver/solver";
import { applyTeacherReassignments } from "../../src/features/generator/utils/applyReassignments";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = arg("fixture") ?? path.join(HERE, "fixtures", "school-data.json");
const BUDGET_MS = Number(arg("budget") ?? 45000);
const SEED = Number(arg("seed") ?? 12345);

const raw = JSON.parse(fs.readFileSync(FIXTURE, "utf-8"));
const loaded: AppData = raw.data ?? raw;
const data: AppData = {
  ...loaded,
  settings: { ...loaded.settings, allowTeacherReassignment: true },
  schedule: {},
  conflicts: [],
};

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

const moves = result.reassignedTeachers ?? [];
console.log(`fixture ${path.basename(FIXTURE)} | reassignments reported: ${moves.length}`);

function countDisagreements(source: AppData, label: string) {
  const joint = source.jointClasses ?? [];
  // Who the curriculum says teaches each (class, subject) — the Workload view.
  const curriculumTeacher = new Map<string, string | undefined>();
  for (const cls of source.classes) {
    for (const item of cls.curriculum ?? []) {
      const jc = joint.find((j) => j.subjectId === item.subjectId && j.classIds.includes(cls.id));
      curriculumTeacher.set(`${cls.id}|${item.subjectId}`, jc?.teacherId ?? item.assignedTeacherId);
    }
  }

  let mismatched = 0;
  const examples: string[] = [];
  for (const classId of Object.keys(result.schedule)) {
    for (const dayKey of Object.keys(result.schedule[classId] ?? {})) {
      const day = Number(dayKey);
      for (const periodKey of Object.keys(result.schedule[classId][day] ?? {})) {
        const slot = result.schedule[classId][day][Number(periodKey)];
        if (!slot?.subjectId || !slot.teacherId) continue;
        const expected = curriculumTeacher.get(`${classId}|${slot.subjectId}`);
        if (expected && expected !== slot.teacherId) {
          mismatched++;
          if (examples.length < 5) {
            const names = new Map(source.teachers.map((t) => [t.id, t.name]));
            const cls = source.classes.find((c) => c.id === classId)?.name ?? classId;
            const sub = source.subjects.find((s) => s.id === slot.subjectId)?.name;
            examples.push(
              `  ${cls} ${sub}: grid says ${names.get(slot.teacherId)}, ` +
                `curriculum says ${names.get(expected)}`,
            );
          }
        }
      }
    }
  }

  console.log(`\n${label}: ${mismatched} period(s) where the two disagree`);
  examples.forEach((e) => console.log(e));
}

countDisagreements(data, "BEFORE write-back");

const { data: rebased, applied } = applyTeacherReassignments(data, moves);
console.log(`\nwrite-back applied ${applied.length} of ${moves.length} reported moves`);
countDisagreements(rebased, "AFTER write-back");
