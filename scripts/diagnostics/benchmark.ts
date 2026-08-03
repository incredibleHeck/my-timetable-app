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
import { AppData } from "../../src/types";
import { prepareAllocationUnits } from "../../src/features/generator/scheduler/logic/preparation";
import { resolveSubjectIsCore } from "../../src/features/generator/scheduler/logic/subject-core";
import { solveSmart } from "../../src/features/generator/scheduler/solver/solver";
import { auditFinalSchedule } from "../../src/features/generator/scheduler/validation";
import { detectCurriculumGaps } from "../../src/features/generator/scheduler/validation/final-conflicts";
import { getDaysPerWeek } from "../../src/features/generator/scheduler/utils/utils";

// ---------------------------------------------------------------- CLI parsing

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

const FIXTURE = arg("fixture") ?? path.join(__dirname, "fixtures", "school-data.json");
const BUDGET_MS = Number(arg("budget") ?? 60000);
const REPEATS = Number(arg("repeat") ?? 1);
const BASE_SEED = Number(arg("seed") ?? 12345);
const JSON_OUT = arg("json");
const QUIET = hasFlag("quiet");

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
  /** Idle teaching periods between a teacher's first and last lesson of a day. */
  teacherGapPeriods: number;
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

/** Idle periods between first and last lesson, per day, summed. */
function countGapPeriods(
  occupiedByDay: Map<number, Set<number>>,
  teachingIndices: number[],
): number {
  let gaps = 0;
  for (const periods of occupiedByDay.values()) {
    if (periods.size < 2) continue;
    const sorted = [...periods].sort((a, b) => a - b);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    for (const idx of teachingIndices) {
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

  const teachingIndices = data.settings.dayStructure
    .map((p, i) => (p.type === "CLASS" ? i : -1))
    .filter((i) => i >= 0);

  const teacherDays = new Map<string, Map<number, Set<number>>>();
  const classDays = new Map<string, Map<number, Set<number>>>();
  const teacherTotals = new Map<string, number>();

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

  let teacherGapPeriods = 0;
  for (const byDay of teacherDays.values()) {
    teacherGapPeriods += countGapPeriods(byDay, teachingIndices);
  }
  let classGapPeriods = 0;
  for (const byDay of classDays.values()) {
    classGapPeriods += countGapPeriods(byDay, teachingIndices);
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
    teacherGapPeriods,
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
  return { ...data, schedule: {}, conflicts: [] };
}

function runOnce(data: AppData, seed: number): BenchmarkMetrics {
  const units = prepareAllocationUnits(data);
  const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));
  units.forEach((u) => {
    if (u.isCore === undefined) {
      u.isCore = resolveSubjectIsCore(subjectMap.get(u.subjectId), u.subjectName);
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
    {
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
    "teacherGapPeriods",
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
