import { AppData } from "../../../types";

/** One subject of one class, handed to a different teacher by the optimiser. */
export interface TeacherReassignment {
  classId: string;
  subjectId: string;
  fromTeacherId: string;
  toTeacherId: string;
}

/**
 * Write the optimiser's teacher changes back into the curriculum.
 *
 * When `settings.allowTeacherReassignment` is on, the optimiser may move a
 * class's subject to another qualified teacher to even out workloads. The
 * generated timetable already reflects that — every slot carries its teacher —
 * but `curriculum.assignedTeacherId` still names the original, and the Workload
 * screen reads the curriculum rather than the grid. Left alone, the two screens
 * would disagree about who teaches Year 7B Arts, and the disagreement would
 * survive into next term's planning.
 *
 * Only entries whose current teacher still matches `fromTeacherId` are touched,
 * so a stale reassignment — one describing an assignment the user has since
 * edited — is ignored rather than silently overwriting their decision.
 *
 * Returns the same object when nothing applies, so callers can skip a re-render.
 */
export function applyTeacherReassignments(
  data: AppData,
  reassignments: TeacherReassignment[] | undefined,
): { data: AppData; applied: TeacherReassignment[] } {
  if (!reassignments || reassignments.length === 0) {
    return { data, applied: [] };
  }

  const byClass = new Map<string, TeacherReassignment[]>();
  for (const move of reassignments) {
    if (!byClass.has(move.classId)) byClass.set(move.classId, []);
    byClass.get(move.classId)!.push(move);
  }

  const applied: TeacherReassignment[] = [];

  const classes = data.classes.map((cls) => {
    const moves = byClass.get(cls.id);
    if (!moves || !cls.curriculum) return cls;

    let changed = false;
    const curriculum = cls.curriculum.map((item) => {
      const move = moves.find(
        (m) => m.subjectId === item.subjectId && item.assignedTeacherId === m.fromTeacherId,
      );
      if (!move) return item;
      changed = true;
      applied.push(move);
      return { ...item, assignedTeacherId: move.toTeacherId };
    });

    return changed ? { ...cls, curriculum } : cls;
  });

  if (applied.length === 0) return { data, applied: [] };
  return { data: { ...data, classes }, applied };
}

/** One line per change, for a toast or a summary panel. */
export function describeReassignments(data: AppData, applied: TeacherReassignment[]): string[] {
  const teacher = new Map(data.teachers.map((t) => [t.id, t.name]));
  const cls = new Map(data.classes.map((c) => [c.id, c.name]));
  const subject = new Map(data.subjects.map((s) => [s.id, s.name]));

  return applied.map(
    (m) =>
      `${cls.get(m.classId) ?? m.classId} ${subject.get(m.subjectId) ?? m.subjectId}: ` +
      `${teacher.get(m.fromTeacherId) ?? m.fromTeacherId} → ${teacher.get(m.toTeacherId) ?? m.toTeacherId}`,
  );
}
