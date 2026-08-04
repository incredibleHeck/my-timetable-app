/**
 * WHY ARE LESSONS UNPLACED?
 *
 * Runs the production solver on a fixture and prints the blocking-reason
 * breakdown for every lesson it failed to place, plus a school-wide tally.
 *
 *   npm run diagnostics:why -- --fixture path/to/data.json --budget 30000
 *
 * The tally is the useful part: it says which constraint is actually costing
 * the school its lessons, rather than which one is easiest to blame.
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { AppData } from "../../src/types";
import { prepareAllocationUnits } from "../../src/features/generator/scheduler/logic/preparation";
import { resolveSubjectIsCore } from "../../src/features/generator/scheduler/logic/subject-core";
import { solveSmart } from "../../src/features/generator/scheduler/solver/solver";
import { auditFinalSchedule } from "../../src/features/generator/scheduler/validation";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = arg("fixture") ?? path.join(HERE, "fixtures", "school-data.json");
const BUDGET_MS = Number(arg("budget") ?? 30000);
const SEED = Number(arg("seed") ?? 12345);

const raw = JSON.parse(fs.readFileSync(FIXTURE, "utf-8"));
const loaded: AppData = raw.data ?? raw;
const REASSIGN = process.argv.includes("--reassign");
const data: AppData = {
  ...loaded,
  settings: REASSIGN ? { ...loaded.settings, allowTeacherReassignment: true } : loaded.settings,
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

console.log(`fixture ${path.basename(FIXTURE)} | ${units.length} units | budget ${BUDGET_MS}ms\n`);

const started = Date.now();
const result = solveSmart(units, data, () => true, {
  runs: 3,
  timeBudgetMs: BUDGET_MS,
  clockStartMs: started,
  calibrate: true,
  shuffleConstruction: true,
  seed: SEED,
});

const unplaced = result.conflicts.filter((c) => c.reason.startsWith("Unplaced"));

console.log(
  `solver reports unplacedGangs=${result.unplacedGangs}, ` +
    `conflict rows tagged Unplaced=${unplaced.length}, ` +
    `runs=${result.totalRuns}\n`,
);

// A joint lesson emits one conflict row per partner class. Collapse those, but
// keep distinct lessons that merely happen to share a subject and a reason —
// two unplaced Maths doubles for the same class are two lost lessons, not one.
const seen = new Map<string, number>();
const rows = unplaced.filter((c) => {
  const key = `${c.className}|${c.subjectId}|${c.reason}`;
  const n = (seen.get(key) ?? 0) + 1;
  seen.set(key, n);
  return n === 1 || !c.className;
});

console.log(`${rows.length} unplaced lesson(s):\n`);
for (const c of rows) {
  console.log(`  ${c.className} — ${c.subjectName} (${c.teacherName})`);
  console.log(`    ${c.reason.replace(/^Unplaced [^.]*\. /, "")}\n`);
}

// Split the two situations before tallying: they call for opposite responses.
const gaveUp = rows.filter((c) => c.reason.includes("still free"));
const tally = new Map<string, number>();
for (const c of rows) {
  const m = c.reason.match(/(?:— |Elsewhere: )(.+?) \(\d+\)/);
  if (m) tally.set(m[1], (tally.get(m[1]) ?? 0) + 1);
}

console.log(
  `\n${gaveUp.length} of ${rows.length} had legal slots remaining ` +
    `(search effort, not over-constraint); ${rows.length - gaveUp.length} were genuinely boxed in.`,
);

if (tally.size > 0) {
  console.log("\nleading blocker, counted per unplaced lesson:");
  [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([reason, n]) => console.log(`  ${String(n).padStart(3)}  ${reason}`));
}

// --- HIGH severity conflicts, grouped by kind -------------------------------

const audited = auditFinalSchedule({ ...data, schedule: result.schedule }, { mode: "full" });
const high = audited.filter((c) => c.severity === "HIGH");
console.log(`
HIGH severity breakdown (${high.length} total):`);
const kinds = new Map<string, number>();
for (const c of high) {
  const label = c.reason.replace(/\d+/g, "N").slice(0, 90);
  kinds.set(label, (kinds.get(label) ?? 0) + 1);
}
[...kinds.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, n]) => console.log(`  ${String(n).padStart(3)}  ${k}`));

const med = audited.filter((c) => c.severity === "MEDIUM");
console.log(`
MEDIUM severity breakdown (${med.length} total):`);
const mk = new Map<string, number>();
for (const c of med) {
  const label = c.reason.replace(/\d+/g, "N").slice(0, 95);
  mk.set(label, (mk.get(label) ?? 0) + 1);
}
[...mk.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, n]) => console.log(`  ${String(n).padStart(3)}  ${k}`));
