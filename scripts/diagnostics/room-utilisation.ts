/**
 * ROOM UTILISATION AFTER A REAL SOLVE
 *
 * The Workload screen reports a room's usage from `slot.roomId` on the generated
 * grid. If the solver never assigns a specialist room, that room reads 0% and no
 * conflict explains it. This runs a solve and prints where lessons actually
 * landed, optionally after tying each single-resource subject to a matching room
 * so the two configurations can be compared.
 *
 *   npm run diagnostics:rooms -- --fixture path/to/data.json [--link]
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { AppData } from "../../src/types";
import { prepareAllocationUnits } from "../../src/features/generator/scheduler/logic/preparation";
import { resolveSubjectIsCore } from "../../src/features/generator/scheduler/logic/subject-core";
import { solveSmart } from "../../src/features/generator/scheduler/solver/solver";
import { getDaysPerWeek } from "../../src/features/generator/scheduler/utils/utils";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = arg("fixture") ?? path.join(HERE, "fixtures", "school-data.json");
const BUDGET_MS = Number(arg("budget") ?? 45000);
const SEED = Number(arg("seed") ?? 12345);
/** Tie each single-resource subject to a room whose name matches it. */
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

const data: AppData = { ...loaded, subjects, schedule: {}, conflicts: [] };

if (LINK) {
  console.log("linked single-resource subjects to rooms:");
  subjects.forEach((s, i) => {
    if (s.requiredRoomId && !loaded.subjects[i].requiredRoomId) {
      const room = data.rooms.find((r) => r.id === s.requiredRoomId);
      console.log(`  ${s.name} -> ${room?.name}`);
    }
  });
  console.log("");
}

const units = prepareAllocationUnits(data);
const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));
units.forEach((u) => {
  if (u.isCore === undefined) {
    u.isCore = resolveSubjectIsCore(subjectMap.get(u.subjectId), u.subjectName);
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

// Weekly teaching slots available per room, matching how the Workload screen
// turns raw occupancy into a percentage.
const days = getDaysPerWeek(data.settings);
const capacity = days * (data.settings.periodsPerDay ?? 0);

const used = new Map<string, number>();
let unroomed = 0;
for (const classId of Object.keys(result.schedule)) {
  for (const dayKey of Object.keys(result.schedule[classId] ?? {})) {
    const day = Number(dayKey);
    for (const periodKey of Object.keys(result.schedule[classId][day] ?? {})) {
      const slot = result.schedule[classId][day][Number(periodKey)];
      if (!slot) continue;
      if (!slot.roomId) {
        unroomed++;
        continue;
      }
      used.set(slot.roomId, (used.get(slot.roomId) ?? 0) + 1);
    }
  }
}

console.log(`fixture ${path.basename(FIXTURE)} | unplaced ${result.unplacedGangs}`);
console.log(`\nroom                       periods   of ${capacity}   utilisation`);
for (const room of data.rooms) {
  const n = used.get(room.id) ?? 0;
  const pct = capacity > 0 ? Math.round((n / capacity) * 100) : 0;
  const flag = n === 0 ? "  <- never used" : "";
  console.log(
    `${room.name.padEnd(26)} ${String(n).padStart(5)}   ${String(capacity).padStart(5)}   ${String(pct).padStart(4)}%${flag}`,
  );
}
console.log(`\nlessons with no room assigned: ${unroomed}`);
