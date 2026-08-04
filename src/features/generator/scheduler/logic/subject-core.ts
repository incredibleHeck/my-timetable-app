import { Subject } from "../../../../types";

/**
 * Is this subject one the school has marked as core?
 *
 * Core status is not a label — it changes the timetable. It adds
 * HCD_PRIME_BIAS, which pulls the lesson into the first half of the day, plus
 * weekly-balance and variety handling and the optional per-day core cap.
 *
 * This used to fall back to matching the subject's name against a keyword list
 * (math, english, science, physics, chem, bio, history, geography) whenever
 * `isCore` was unset. That gave morning priority to subjects nobody had chosen,
 * with the Subject editor's checkbox sitting unticked and nothing on screen
 * explaining the placement — and it was arbitrary besides, recognising Biology
 * and Geography while ignoring Literature, BK and every subject named in a
 * language other than English.
 *
 * The checkbox is now the only answer. A subject the school has not ticked is
 * not core, and gets no morning bias.
 */
export function resolveSubjectIsCore(subject?: Pick<Subject, "isCore">): boolean {
  return subject?.isCore === true;
}
