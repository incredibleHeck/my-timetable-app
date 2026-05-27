import { Subject } from "../../../../types";

const CORE_KEYWORDS = [
  "math",
  "english",
  "science",
  "physics",
  "chem",
  "bio",
  "history",
  "geography",
];

/** Prefer explicit Subject.isCore; fall back to English name heuristic. */
export function resolveSubjectIsCore(
  subject?: Pick<Subject, "isCore" | "name">,
  subjectName?: string,
): boolean {
  if (subject?.isCore !== undefined) return subject.isCore;
  const name = (subject?.name ?? subjectName ?? "").toLowerCase();
  if (!name) return false;
  return CORE_KEYWORDS.some((keyword) => name.includes(keyword));
}
