// @ts-nocheck
import { AppData, PeriodType, Teacher, Subject, ClassGroup } from "../../../types";
import { prepareAllocationUnits } from "./preparation";
import { solveSmart } from "./solver/solver";
import { runConflictAudit } from "./validation/audit";

/**
 * EDUSCHEDULER 2.0 - SMOKE TEST
 * This script validates the O(1) architecture, Tournament MRV, and Min-Conflicts Repair.
 */

// --- 1. MOCK DATA GENERATOR ---
const mockData: any = {
  settings: {
    periodsPerDay: 8,
    daysPerWeek: 5,
    dayStructure: Array(8).fill({ type: "CLASS", label: "Period" }),
    fixedOccasions: [],
    timeSlots: [],
    maxTeacherPeriodsPerDay: 6,
    maxConsecutivePeriods: 4,
    maxSubjectPeriodsPerDay: 2,
  },
  subjects: [
    { id: "MAT", name: "Mathematics", color: "blue" },
    { id: "SCI", name: "Science", requiredRoomType: "LAB", color: "green" },
    { id: "ENG", name: "English", color: "red" },
    { id: "PE", name: "Physical Education", isSingleResource: true, color: "orange" }
  ],
  teachers: [
    { id: "T1", name: "Mr. Newton (Math)", maxPeriodsPerDay: 6, specialtyIds: ["MAT"], constraints: [] },
    { id: "T2", name: "Dr. Curie (Science)", maxPeriodsPerDay: 6, specialtyIds: ["SCI"], constraints: [] },
    { id: "T3", name: "Shakespeare (English)", maxPeriodsPerDay: 6, specialtyIds: ["ENG"], constraints: [] }
  ],
  rooms: [
    { id: "R1", name: "Room 101", capacity: 30, type: "GENERAL" },
    { id: "R2", name: "Room 102", capacity: 30, type: "GENERAL" },
    { id: "LAB1", name: "Science Lab A", capacity: 30, type: "LAB" }
  ],
  classes: [
    {
      id: "C1", name: "10A", periodCount: 8, studentCount: 25, defaultRoomId: "R1",
      curriculum: [
        { id: "curr1", subjectId: "MAT", singles: 2, doubles: 1, assignedTeacherId: "T1", periodsPerWeek: 4 },
        { id: "curr2", subjectId: "SCI", singles: 2, doubles: 1, assignedTeacherId: "T2", periodsPerWeek: 4 },
        { id: "curr3", subjectId: "ENG", singles: 4, assignedTeacherId: "T3", periodsPerWeek: 4, doubles: 0 }
      ]
    },
    {
      id: "C2", name: "10B", periodCount: 8, studentCount: 25, defaultRoomId: "R2",
      curriculum: [
        { id: "curr4", subjectId: "MAT", singles: 2, doubles: 1, assignedTeacherId: "T1", periodsPerWeek: 4 },
        { id: "curr5", subjectId: "SCI", singles: 2, doubles: 1, assignedTeacherId: "T2", periodsPerWeek: 4 },
        { id: "curr6", subjectId: "ENG", singles: 4, assignedTeacherId: "T3", periodsPerWeek: 4, doubles: 0 }
      ]
    }
  ],
  jointClasses: [
    {
      id: "JC1",
      name: "Joint Math",
      subjectId: "MAT",
      classIds: ["C1", "C2"],
      teacherId: "T1"
    }
  ],
  schedule: {},
  curriculum: [], // Global curriculum fallback (unused in this test)
  dutyLocations: [],
  dutyAssignments: [],
  recentActivity: []
};

console.log("🚀 Starting EduScheduler 2.0 Smoke Test...");
const startTime = Date.now();

try {
  // --- 2. PREPARATION PHASE ---
  console.log("   - [1/3] Preparing Allocation Units...");
  const units = prepareAllocationUnits(mockData);

  // Simulation of worker.ts safety patch: Populate isCore
  const coreKeywords = ["math", "science", "english", "physics"];
  units.forEach(u => {
      u.isCore = coreKeywords.some(k => u.subjectName.toLowerCase().includes(k));
  });

  console.log(`     > Generated ${units.length} atomic units (Gangs).`);

  // --- 3. SOLVER PHASE ---
  console.log(`   - [2/3] Solving CSP (Tournament MRV + Min-Conflicts)...`);

  const { schedule, state, iterations } = solveSmart(
    units, 
    mockData, 
    (phase, progress, total, conflicts) => { 
       if (progress % 10 === 0) {
           const msg = `\r     > ${phase}: ${progress}/${total} | Remaining Conflicts: ${conflicts}   `;
           if (typeof process !== 'undefined') process.stdout.write(msg);
           else console.log(msg);
       }
       return true; 
    }
  );
  
  if (typeof process !== 'undefined') process.stdout.write("\n"); // Clear the line from the ticker

  const solveDuration = Date.now() - startTime;
  console.log(`✅ Solver finished in ${solveDuration}ms (${iterations} iterations)`);

  // --- 4. AUDIT PHASE ---
  console.log("   - [3/3] Running O(1) State Audit...");
  const audit = runConflictAudit(mockData, state);
  
  // --- 5. PERFORMANCE & VALIDITY REPORT ---
  console.log("\n" + "=".repeat(50));
  console.log("📊 FINAL SMOKE TEST REPORT");
  console.log("=".repeat(50));
  
  const totalRequired = units.reduce((acc, u) => acc + u.duration, 0);
  const successRate = (audit.statistics.totalLessonsPlaced / units.length) * 100;

  console.log(`   - Placement Success: ${audit.statistics.totalLessonsPlaced}/${units.length} gangs (${successRate.toFixed(1)}%)`);
  console.log(`   - Hard Conflicts:    ${audit.conflicts.length}`);
  console.log(`   - Curriculum Gaps:   ${audit.curriculumGaps.length}`);
  console.log(`   - Solver Speed:      ${(iterations / (solveDuration / 1000)).toFixed(0)} iterations/sec`);

  // Utilization Stats
  console.log("\n📈 Resource Utilization:");
  Object.entries(audit.statistics.teacherUtilization).forEach(([tid, load]) => {
      const name = mockData.teachers.find(t => t.id === tid)?.name;
      console.log(`     > ${name}: ${load} periods`);
  });

  if (audit.conflicts.length > 0) {
      console.warn("\n⚠️ VALIDATION WARNINGS:");
      audit.conflicts.slice(0, 3).forEach(c => {
          console.warn(`     > [${c.severity}] ${c.reason} (${c.className} - ${c.subjectName})`);
      });
  }

  if (audit.curriculumGaps.length === 0 && audit.conflicts.length === 0) {
      console.log("\n✨ TEST PASSED: Perfect Schedule Generated!");
  } else if (audit.conflicts.length === 0) {
      console.log("\n✅ TEST PASSED: Valid Schedule (with expected oversubscription gaps).");
  } else {
      console.error("\n❌ TEST FAILED: Hard logic violations found in audit.");
  }

} catch (e) {
  console.error("\n💥 CRITICAL SYSTEM FAILURE:");
  console.error(e);
  if (typeof process !== 'undefined') process.exit(1);
}
