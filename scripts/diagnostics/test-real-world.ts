// @ts-nocheck
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { AppData } from "../../src/types";
import { prepareAllocationUnits } from "../../src/features/generator/scheduler/logic/preparation";
import { solveSmart } from "../../src/features/generator/scheduler/solver/solver";
import { runConflictAudit } from "../../src/features/generator/scheduler/validation/audit";
import { getDaysPerWeek } from "../../src/features/generator/scheduler/utils/utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE_NAME = "school-data.json";

const CORE_KEYWORDS = ["math", "english", "science", "physics", "chem", "bio", "ict", "computing"];
const isCoreSubject = (name: string) => {
  const n = name.toLowerCase();
  return CORE_KEYWORDS.some((k) => n.includes(k));
};

async function runRealWorldTest() {
  console.log(`
🏫 EDU-SCHEDULER 2.0: REAL WORLD DATA TEST`);
  console.log(`=================================================
`);

  const filePath = path.join(__dirname, "fixtures", FILE_NAME);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: File not found at ${filePath}`);
    console.error("-> Please ensure 'school-data.json' is in scripts/diagnostics/fixtures/");
    return;
  }

  console.log(`📂 Loading ${FILE_NAME}...`);
  const rawData = fs.readFileSync(filePath, "utf-8");
  const data: AppData = JSON.parse(rawData);

  console.log(`   - Clearing legacy schedule for fresh generation...`);
  data.schedule = {};

  console.log(`   - Classes: ${data.classes.length}`);
  console.log(`   - Teachers: ${data.teachers.length}`);
  console.log(`   - Periods/Day: ${data.settings.periodsPerDay}`);

  console.log(`
⚙️  PREPARING ALLOCATION UNITS...`);
  const units = prepareAllocationUnits(data);

  let coreCount = 0;
  units.forEach((u) => {
    if (u.isCore === undefined) {
      u.isCore = isCoreSubject(u.subjectName || "");
      if (u.isCore) coreCount++;
    }
  });

  console.log(`   - Total Units to Schedule: ${units.length}`);
  console.log(`   - Core Subjects Identified: ${coreCount}`);

  const teacherUnitCounts = new Map<string, number>();
  units.forEach((u) => {
    u.teacherIds.forEach((tid) => {
      teacherUnitCounts.set(tid, (teacherUnitCounts.get(tid) || 0) + u.duration);
    });
  });
  console.log(`\n   🛠️  CURRICULUM UNIT COUNT (Requested):`);
  const topRequested = Array.from(teacherUnitCounts.entries())
    .map(([id, count]) => ({
      name: data.teachers.find((t) => t.id === id)?.name || id,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  topRequested.forEach((tr) => console.log(`      - ${tr.name.padEnd(20)}: ${tr.count} units`));

  console.log(`
🚀 STARTING SOLVER ENGINE...`);
  const startTime = Date.now();

  const { state, iterations } = solveSmart(units, data, (phase, progress, total) => {
    if (progress % 50 === 0 || progress === total) {
      const pct = Math.round((progress / total) * 100);
      process.stdout.write(`\r   [${phase}] ${pct}% Complete (${progress}/${total})`);
    }
    return true;
  });

  const duration = Date.now() - startTime;
  console.log(`

✅ SOLVER COMPLETE`);
  console.log(`   - Time Taken: ${(duration / 1000).toFixed(2)}s`);
  console.log(`   - Iterations: ${iterations}`);

  console.log(`
🔍 FORENSIC AUDIT REPORT`);
  const audit = runConflictAudit(data, state);

  const placedCount = audit.statistics.totalLessonsPlaced;
  const unplacedCount = units.length - placedCount;
  const successRate = ((placedCount / units.length) * 100).toFixed(1);

  console.log(`   - Success Rate: ${successRate}% (${placedCount}/${units.length})`);

  const realConflicts = audit.conflicts.filter((c) => c.className !== "Unresolved");
  if (realConflicts.length > 0) {
    console.log(`\n   ⚠️  SYSTEM DETECTED CONFLICTS (${realConflicts.length}):`);
    realConflicts.forEach((c) => {
      console.log(`      - [${c.severity}] ${c.reason} (${c.className}, Day ${c.day} P${c.period})`);
    });
  }

  if (unplacedCount > 0) {
    console.warn(`   ⚠️  UNPLACED LESSONS: ${unplacedCount}`);
    const unplacedReasons = new Map<string, number>();
    audit.conflicts.forEach((c) => {
      if (c.className === "Unresolved" || c.reason.includes("Could not find")) {
        const key = c.reason || "Unknown";
        unplacedReasons.set(key, (unplacedReasons.get(key) || 0) + 1);
      }
    });
    unplacedReasons.forEach((count, reason) => {
      console.log(`      - ${reason}: ${count}`);
    });
  } else {
    console.log(`   ✨ PERFECT PLACEMENT: All lessons scheduled.`);
  }

  console.log(`
   - Constraint Verification:
`);

  const checkDay = 1;
  const checkPeriod = 0;
  const fixedOccasion = data.settings.fixedOccasions?.[checkDay]?.[checkPeriod];
  const fixedLabel =
    typeof fixedOccasion === "string" ? fixedOccasion : (fixedOccasion as { label?: string })?.label;

  if (fixedLabel) {
    let violators = 0;
    data.classes.forEach((c) => {
      if (state.schedule[c.id]?.[checkDay]?.[checkPeriod]) violators++;
    });

    if (violators === 0) {
      console.log(`     ✅ Fixed Occasion "${fixedLabel}" respected (0 violators).`);
    } else {
      console.log(`     ❌ Fixed Occasion "${fixedLabel}" VIOLATED by ${violators} classes.`);
    }
  }

  if (audit.curriculumGaps.length > 0) {
    console.log(`
   ⚠️  CURRICULUM GAPS (${audit.curriculumGaps.length}):`);
    audit.curriculumGaps.slice(0, 5).forEach((g) => {
      console.log(`     - ${g.message}`);
    });
    if (audit.curriculumGaps.length > 5)
      console.log(`     ... and ${audit.curriculumGaps.length - 5} more.`);
  } else {
    console.log(`
   ✅ CURRICULUM INTEGRITY: 100% Match`);
  }

  console.log(`
   👨‍🏫 TOP BUSY TEACHERS:`);
  const sortedTeachers = data.teachers
    .map((t) => ({ name: t.name, load: audit.statistics.teacherUtilization[t.id] || 0 }))
    .sort((a, b) => b.load - a.load)
    .slice(0, 5);

  sortedTeachers.forEach((t) => {
    console.log(`     - ${t.name.padEnd(20)}: ${t.load} periods`);
  });

  console.log(`\n   🥪 SANDWICH SCAN:`);
  let sandwichesFound = 0;
  data.classes.forEach((cls) => {
    const structure = cls.structure || data.settings.dayStructure;
    const days = getDaysPerWeek(data.settings);
    for (let d = 0; d < days; d++) {
      const daySched = state.schedule[cls.id]?.[d];
      if (!daySched) continue;

      const subjectsToday = new Set<string>();
      Object.values(daySched).forEach((s) => {
        if (s) subjectsToday.add(s.subjectId);
      });

      subjectsToday.forEach((sId) => {
        const indices: number[] = [];
        Object.keys(daySched).forEach((pStr) => {
          const pIdx = parseInt(pStr);
          if (daySched[pIdx]?.subjectId === sId) indices.push(pIdx);
        });

        if (indices.length > 1) {
          indices.sort((a, b) => a - b);
          const min = indices[0];
          const max = indices[indices.length - 1];

          for (let i = min + 1; i < max; i++) {
            const period = structure[i];
            const type = typeof period === "string" ? period : period?.type || "CLASS";

            if (type !== "CLASS") continue;

            if (daySched[i]?.subjectId !== sId) {
              console.log(
                `     ❌ SANDWICH: ${cls.name} has split ${data.subjects.find((s) => s.id === sId)?.name} on Day ${d} at P${i + 1}`,
              );
              sandwichesFound++;
            }
          }
        }
      });
    }
  });

  if (sandwichesFound === 0) {
    console.log(`     ✅ No "XYX" sandwiches detected. All subjects are in continuous blocks.`);
  }
}

runRealWorldTest().catch(console.error);
