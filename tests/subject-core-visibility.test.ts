import { describe, it, expect } from "vitest";
import { resolveSubjectIsCore } from "../src/features/generator/scheduler/logic/subject-core";
import { Subject } from "../src/features/subjects/types";

/**
 * Core status is what gives a subject morning priority: the construction scorer
 * adds HCD_PRIME_BIAS when a core lesson lands in the first half of the day, and
 * weekly-balance, variety and the per-day core cap all key off it too.
 *
 * It used to be inferred from the subject's name whenever `isCore` was unset —
 * a keyword list of math, english, science, physics, chem, bio, history,
 * geography. That handed morning priority to subjects nobody had chosen, while
 * the Subject editor's checkbox sat unticked and nothing on screen explained the
 * placement. It was arbitrary as well: it recognised Biology and Geography but
 * not Literature, BK, or any subject named in another language.
 *
 * The checkbox is now the only answer.
 */

const subject = (over: Partial<Subject>): Subject =>
  ({ id: "s", name: "Subject", color: "#000", ...over }) as Subject;

describe("resolveSubjectIsCore", () => {
  it("treats a ticked subject as core", () => {
    expect(resolveSubjectIsCore(subject({ name: "Pottery", isCore: true }))).toBe(true);
  });

  it("treats an unticked subject as not core", () => {
    expect(resolveSubjectIsCore(subject({ name: "Mathematics", isCore: false }))).toBe(false);
  });

  it("no longer infers core status from the subject's name", () => {
    // Every one of these was silently core before, purely because of its name.
    for (const name of [
      "English",
      "Mathematics",
      "Science",
      "Physics",
      "Chemistry",
      "Biology",
      "History",
      "Geography",
      "English Language",
      "Further Mathematics",
      "Integrated Science",
    ]) {
      expect(resolveSubjectIsCore(subject({ name }))).toBe(false);
    }
  });

  it("treats a missing subject as not core", () => {
    expect(resolveSubjectIsCore(undefined)).toBe(false);
    expect(resolveSubjectIsCore(subject({ name: "" }))).toBe(false);
  });

  it("does not treat any other truthy value as a tick", () => {
    // Only an explicit true counts, so partial or legacy data cannot smuggle
    // core status back in.
    expect(resolveSubjectIsCore({ isCore: undefined } as Partial<Subject>)).toBe(false);
    expect(resolveSubjectIsCore({} as Partial<Subject>)).toBe(false);
  });
});
