/**
 * SCHEDULER BENCHMARK
 *
 * Runs the solver in its **production configuration** (solveSmartWithRestarts with
 * the real time budget, restarts, shuffling and calibration) and reports both
 * feasibility and quality metrics.
 *
 * This exists because the previous diagnostic (test-real-world.ts) called
 * solveSmart with no options — a single run, no restarts, no calibration — so the
 * 60-second multi-run path the app actually ships had never been measured.
 *
 * Usage:
 *   npx tsx scripts/diagnostics/benchmark.ts --fixture <path> [options]
 *
 *   --fixture <path>   Fixture JSON (raw AppData or a {data:AppData} profile).
 *                      Defaults to fixtures/school-data.json.
 *   --budget <ms>      Solver time budget per repeat. Default 60000.
 *   --repeat <n>       Independent benchmark repeats (different seeds). Default 1.
 *   --seed <n>         Base seed. Default 12345.
 *   --json <path>      Also write machine-readable results for diffing.
 *   --quiet            Suppress the solver progress line.
 *
 * Real school data must live in fixtures/local/ (gitignored) — never commit it.
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { AppData } from "../../src/types";
import { prepareAllocationUnits } from "../../src/features/generator/scheduler/logic/preparation";
import { resolveSubjectIsCore } from "../../src/features/generator/scheduler/logic/subject-core";
import { solveSmart } from "../../src/features/generator/scheduler/solver/solver";
import { auditFinalSchedule } from "../../src/features/generator/scheduler/validation";
import { detectCurriculumGaps } from "../../src/features/generator/scheduler/validation/final-conflicts";
import { getDaysPerWeek } from "../../src/features/generator/scheduler/utils/utils";
import { isOccasionBlocked } from "../../src/utils/utils";
import {
  scoreSchedule,
  teachingIndicesOf,
  classSchedulablePeriods,
} from "../../src/features/generator/scheduler/logic/objective";

// ---------------------------------------------------------------- CLI parsing

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

// ESM: __dirname is not defined, mirror the pattern used by test-real-world.ts
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = arg("fixture") ?? path.join(HERE, "fixtures", "school-data.json");
const BUDGET_MS = Number(arg("budget") ?? 60000);
/** `--runs N` swaps the time budget for a fixed restart count (reproducible A/B). */
const FIXED_RUNS = arg("runs") ? Number(arg("runs")) : 0;
const REPEATS = Number(arg("repeat") ?? 1);
const BASE_SEED = Number(arg("seed") ?? 12345);
const JSON_OUT = arg("json");
const QUIET = hasFlag("quiet");
/** `--reassign` lets the optimiser move a class's subject to another qualified teacher. */
const REASSIGN = hasFlag("reassign");

// ------------------------------------------------------------------- Metrics

export interface BenchmarkMetrics {
  /** Lesson gangs the solver could not place at all. */
  unplacedGangs: number;
  /** Curriculum periods requested but missing from the grid. */
  curriculumGapPeriods: number;
  /**
   * Split by `severity`, not `kind`: Conflict.kind is declared as
   * "blocking" | "quality" but the validation layer sets it in exactly one
   * place, so nearly every conflict has kind === undefined. severity is the
   * field that is actually populated.
   */
  severityHigh: number;
  severityMedium: number;
  severityLow: number;
  /** Weighted soft cost from logic/objective.ts — what run selection now ranks on. */
  softCost: number;
  /** Idle teaching periods between a teacher's first and last lesson of a day. */
  teacherGapPeriods: number;
  /** Of those, the isolated singles — the only shape the objective penalises. */
  fragmentedTeacherGaps: number;
  /** Free runs of 2+ periods. Usable prep time; reported but deliberately unpenalised. */
  consolidatedTeacherBlocks: number;
  /** Teaching periods scheduled beyond settings.maxTeachingPeriodsPerWeek. */
  weeklyCapExcess: number;
  /** Idle periods inside a class's day. */
  classGapPeriods: number;
  /** Spread of weekly teaching load across teachers who teach at all. */
  loadMin: number;
  loadMax: number;
  loadStdev: number;
  /** Solver effort. */
  runsCompleted: number;
  perfectRuns: number;
  iterations: number;
  durationMs: number;
}

/**
 * Idle periods between the first and last lesson of a day.
 *
 * A slot only counts as a gap if it is genuinely schedulable. Break, lunch and
 * assembly are NOT free time, and neither are reserved occasions such as
 * Worship or Clubs. Critically, break/lunch positions are per class: in the
 * DANSOMAN data the global structure breaks at index 3 and lunches at 7, while
 * Year 4B breaks at 4 and lunches at 8, and Year 7A lunches at 9. Using the
 * global structure for every class counts real breaks as idle time and misses
 * real teaching periods.
 *
 * `schedulableFor(day)` supplies the per-entity, per-day set of indices that
 * could legitimately hold a lesson.
 */
function countGapPeriods(
  occupiedByDay: Map<number, Set<number>>,
  schedulableFor: (day: number) => Set<number>,
): number {
  let gaps = 0;
  for (const [day, periods] of occupiedByDay) {
    if (periods.size < 2) continue;
    const sorted = [...periods].sort((a, b) => a - b);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    for (const idx of schedulableFor(day)) {
      if (idx > first && idx < last && !periods.has(idx)) gaps++;
    }
  }
  return gaps;
}

function computeMetrics(
  data: AppData,
  schedule: AppData["schedule"],
  solve: { unplacedGangs: number; runs: number; perfectRuns: number; iterations: number },
  durationMs: number,
  state: Parameters<typeof detectCurriculumGaps>[1],
): BenchmarkMetrics {
  const scheduleData: AppData = { ...data, schedule };
  // "full" (not "generated"): generated mode deliberately skips
  // validateFullSchedule, which is where every pedagogical/quality conflict comes
  // from — using it here would report 0 quality issues by construction.
  const conflicts = auditFinalSchedule(scheduleData, { mode: "full" });
  const gaps = detectCurriculumGaps(scheduleData, state);
  const objective = scoreSchedule(data, schedule, solve.unplacedGangs);

  const teacherById = new Map(data.teachers.map((t) => [t.id, t]));

  // The gap/schedulability rules live in logic/objective.ts. Importing them
  // keeps the benchmark measuring exactly what the solver now optimises for —
  // a second implementation here would drift and quietly invalidate the numbers.
  const structureCache = new Map<string, Set<number>>();

  // Each class keeps its own break/lunch positions; never assume the global one.
  const classTeaching = new Map<string, Set<number>>();
  for (const c of data.classes) {
    classTeaching.set(c.id, teachingIndicesOf(c.structure ?? data.settings.dayStructure));
  }

  /** Reserved school-wide (Worship, Clubs …) — real commitments, not free time. */
  const occasionBlocked = (day: number, period: number): boolean =>
    isOccasionBlocked(data.settings.fixedOccasions?.[day]?.[period]);

  const classSchedulable = (classId: string) => (day: number) =>
    classSchedulablePeriods(data, classId, day, structureCache);

  const teacherDays = new Map<string, Map<number, Set<number>>>();
  const classDays = new Map<string, Map<number, Set<number>>>();
  const teacherTotals = new Map<string, number>();
  /** Classes each teacher actually teaches — defines when they could be busy. */
  const teacherClasses = new Map<string, Set<string>>();

  for (const classId of Object.keys(schedule)) {
    for (const dayKey of Object.keys(schedule[classId] ?? {})) {
      const day = Number(dayKey);
      for (const periodKey of Object.keys(schedule[classId][day] ?? {})) {
        const period = Number(periodKey);
        const slot = schedule[classId][day][period];
        if (!slot) continue;

        if (!classDays.has(classId)) classDays.set(classId, new Map());
        const cd = classDays.get(classId)!;
        if (!cd.has(day)) cd.set(day, new Set());
        cd.get(day)!.add(period);

        const tid = slot.teacherId;
        if (!tid) continue;
        if (!teacherClasses.has(tid)) teacherClasses.set(tid, new Set());
        teacherClasses.get(tid)!.add(classId);

        if (!teacherDays.has(tid)) teacherDays.set(tid, new Map());
        const td = teacherDays.get(tid)!;
        if (!td.has(day)) td.set(day, new Set());
        // A teacher co-teaching two classes in one slot still occupies one period.
        if (!td.get(day)!.has(period)) {
          td.get(day)!.add(period);
          teacherTotals.set(tid, (teacherTotals.get(tid) ?? 0) + 1);
        }
      }
    }
  }

  /**
   * A teacher moves between classes whose breaks differ, so a period counts as
   * schedulable only if at least one class they teach is in session then, the
   * slot is not school-wide reserved, and the teacher is not marked unavailable.
   */
  const teacherSchedulable = (teacherId: string) => (day: number) => {
    const out = new Set<number>();
    const teacher = teacherById.get(teacherId);
    for (const classId of teacherClasses.get(teacherId) ?? []) {
      for (const p of classTeaching.get(classId) ?? []) {
        if (occasionBlocked(day, p)) continue;
        if (teacher?.constraints?.[day]?.[p]) continue;
        out.add(p);
      }
    }
    return out;
  };

  let teacherGapPeriods = 0;
  for (const [tid, byDay] of teacherDays) {
    teacherGapPeriods += countGapPeriods(byDay, teacherSchedulable(tid));
  }
  let classGapPeriods = 0;
  for (const [cid, byDay] of classDays) {
    classGapPeriods += countGapPeriods(byDay, classSchedulable(cid));
  }

  const loads = [...teacherTotals.values()];
  const mean = loads.length ? loads.reduce((a, b) => a + b, 0) / loads.length : 0;
  const variance = loads.length ? loads.reduce((a, b) => a + (b - mean) ** 2, 0) / loads.length : 0;

  return {
    unplacedGangs: solve.unplacedGangs,
    // CurriculumGap exposes `missing` (not `missingPeriods`, which is a Conflict field).
    curriculumGapPeriods: gaps.reduce((sum, g) => sum + (g.missing ?? 0), 0),
    severityHigh: conflicts.filter((c) => c.severity === "HIGH").length,
    severityMedium: conflicts.filter((c) => c.severity === "MEDIUM").length,
    severityLow: conflicts.filter((c) => !c.severity || c.severity === "LOW").length,
    softCost: objective.softCost,
    teacherGapPeriods,
    fragmentedTeacherGaps: objective.breakdown.fragmentedTeacherGaps,
    consolidatedTeacherBlocks: objective.breakdown.consolidatedTeacherBlocks,
    weeklyCapExcess: objective.breakdown.weeklyCapExcess,
    classGapPeriods,
    loadMin: loads.length ? Math.min(...loads) : 0,
    loadMax: loads.length ? Math.max(...loads) : 0,
    loadStdev: Number(Math.sqrt(variance).toFixed(2)),
    runsCompleted: solve.runs,
    perfectRuns: solve.perfectRuns,
    iterations: solve.iterations,
    durationMs,
  };
}

// --------------------------------------------------------------------- Runner

function loadFixture(file: string): AppData {
  const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
  const data: AppData = raw.data ?? raw;
  // Always solve from scratch; a saved grid would mask the solver's real work.
  return {
    ...data,
    settings: REASSIGN ? { ...data.settings, allowTeacherReassignment: true } : data.settings,
    schedule: {},
    conflicts: [],
  };
}

function runOnce(data: AppData, seed: number): BenchmarkMetrics {
  const units = prepareAllocationUnits(data);
  const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));
  units.forEach((u) => {
    if (u.isCore === undefined) {
      u.isCore = resolveSubjectIsCore(subjectMap.get(u.subjectId));
    }
  });

  const started = Date.now();
  const result = solveSmart(
    units,
    data,
    (phase, progress, total) => {
      if (!QUIET && progress % 100 === 0) {
        process.stdout.write(`\r   [${phase}] ${progress}/${total}      `);
      }
      return true;
    },
    FIXED_RUNS
      ? {
          // Fixed-work mode: every arm of a comparison does exactly the same
          // number of restarts. Under a time budget the restart count swings
          // with machine load (observed 10 vs 18 restarts for the same 30s),
          // which is far larger than most effects worth measuring.
          runs: FIXED_RUNS,
          calibrate: true,
          shuffleConstruction: true,
          seed,
        }
      : {
          // Production configuration — the path the worker actually ships.
          runs: 3,
          timeBudgetMs: BUDGET_MS,
          clockStartMs: started,
          calibrate: true,
          shuffleConstruction: true,
          seed,
        },
  );
  const durationMs = Date.now() - started;
  if (!QUIET) process.stdout.write("\r".padEnd(48) + "\r");

  return computeMetrics(
    data,
    result.schedule,
    {
      unplacedGangs: result.unplacedGangs,
      runs: result.totalRuns,
      perfectRuns: result.perfectRuns,
      iterations: result.iterations,
    },
    durationMs,
    result.state,
  );
}

function pad(v: string | number, n: number) {
  return String(v).padStart(n);
}

function main() {
  if (!fs.existsSync(FIXTURE)) {
    console.error(`Fixture not found: ${FIXTURE}`);
    process.exit(1);
  }

  const data = loadFixture(FIXTURE);
  const totalPeriods = data.classes.reduce(
    (sum, c) => sum + (c.curriculum ?? []).reduce((s, ci) => s + (ci.periodsPerWeek || 0), 0),
    0,
  );

  console.log(`\nSCHEDULER BENCHMARK  —  ${path.basename(FIXTURE)}`);
  console.log("=".repeat(72));
  console.log(
    `classes ${data.classes.length} | teachers ${data.teachers.length} | subjects ${data.subjects.length} | rooms ${data.rooms.length}`,
  );
  console.log(
    `periods/day ${data.settings.periodsPerDay} | days ${getDaysPerWeek(data.settings)} | curriculum ${totalPeriods} periods/wk`,
  );
  console.log(`budget ${BUDGET_MS}ms | repeats ${REPEATS} | base seed ${BASE_SEED}\n`);

  const rows: BenchmarkMetrics[] = [];
  for (let i = 0; i < REPEATS; i++) {
    const seed = BASE_SEED + i * 1013;
    process.stdout.write(`run ${i + 1}/${REPEATS} (seed ${seed}) … `);
    const m = runOnce(data, seed);
    rows.push(m);
    console.log(
      `unplaced ${m.unplacedGangs} | curric gap ${m.curriculumGapPeriods} | HIGH ${m.severityHigh} | MED ${m.severityMedium} | ${(m.durationMs / 1000).toFixed(1)}s`,
    );
  }

  const avg = (k: keyof BenchmarkMetrics) =>
    rows.reduce((s, r) => s + (r[k] as number), 0) / rows.length;
  const best = (k: keyof BenchmarkMetrics) => Math.min(...rows.map((r) => r[k] as number));
  const worst = (k: keyof BenchmarkMetrics) => Math.max(...rows.map((r) => r[k] as number));

  const metricKeys: (keyof BenchmarkMetrics)[] = [
    "unplacedGangs",
    "curriculumGapPeriods",
    "severityHigh",
    "severityMedium",
    "severityLow",
    "softCost",
    "teacherGapPeriods",
    "fragmentedTeacherGaps",
    "consolidatedTeacherBlocks",
    "weeklyCapExcess",
    "classGapPeriods",
    "loadMax",
    "loadStdev",
    "runsCompleted",
    "perfectRuns",
  ];

  console.log("\n" + "-".repeat(72));
  console.log(`${"metric".padEnd(24)}${pad("best", 10)}${pad("avg", 10)}${pad("worst", 10)}`);
  console.log("-".repeat(72));
  for (const k of metricKeys) {
    console.log(
      `${k.padEnd(24)}${pad(best(k), 10)}${pad(avg(k).toFixed(1), 10)}${pad(worst(k), 10)}`,
    );
  }
  console.log("-".repeat(72));
  console.log(`${"duration (s)".padEnd(24)}${pad((avg("durationMs") / 1000).toFixed(1), 10)}`);

  if (JSON_OUT) {
    fs.writeFileSync(
      JSON_OUT,
      JSON.stringify({ fixture: path.basename(FIXTURE), budgetMs: BUDGET_MS, rows }, null, 2),
    );
    console.log(`\nwrote ${JSON_OUT}`);
  }
  console.log();
}

main();
