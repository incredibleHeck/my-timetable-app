import { describe, it, expect } from "vitest";
import { resolveSubjectIsCore } from "../src/features/generator/scheduler/logic/subject-core";
import { Subject } from "../src/features/subjects/types";

/**
 * Core status is what gives a subject morning priority: the construction scorer
 * adds HCD_PRIME_BIAS when a core lesson lands in the first half of the day.
 *
 * `isCore` is frequently unset, and the solver then infers it from the subject's
 * name — so English, Mathematics and Science were pushed towards the morning
 * while the Subject editor's Core checkbox sat unticked, with nothing on screen
 * explaining why. These tests pin the resolution rules the UI now displays.
 */

const subject = (over: Partial<Subject>): Subject =>
  ({ id: "s", name: "Subject", color: "#000", ...over }) as Subject;

describe("resolveSubjectIsCore", () => {
  it("infers core from well-known subject names when nothing is stored", () => {
    for (const name of [
      "English",
      "Mathematics",
      "Science",
      "Physics",
      "Chemistry",
      "Biology",
      "History",
      "Geography",
    ]) {
      expect(resolveSubjectIsCore(subject({ name }))).toBe(true);
    }
  });

  it("leaves subjects the keyword list does not recognise alone", () => {
    // Nothing about this school's own subjects is in the list, which is part of
    // why the inference is worth surfacing rather than trusting silently.
    for (const name of ["BK", "Humanities", "French", "PE", "Literature", "Music", "SEN"]) {
      expect(resolveSubjectIsCore(subject({ name }))).toBe(false);
    }
  });

  it("lets an explicit choice override the guess in both directions", () => {
    // Unticking English has to stick, or the user cannot take it out of the
    // morning slot the inference put it in.
    expect(resolveSubjectIsCore(subject({ name: "English", isCore: false }))).toBe(false);
    expect(resolveSubjectIsCore(subject({ name: "Pottery", isCore: true }))).toBe(true);
  });

  it("treats an unnamed subject as not core", () => {
    expect(resolveSubjectIsCore(undefined)).toBe(false);
    expect(resolveSubjectIsCore(subject({ name: "" }))).toBe(false);
  });

  it("matches on substrings, so longer titles still resolve", () => {
    expect(resolveSubjectIsCore(subject({ name: "English Language" }))).toBe(true);
    expect(resolveSubjectIsCore(subject({ name: "Further Mathematics" }))).toBe(true);
    expect(resolveSubjectIsCore(subject({ name: "Integrated Science" }))).toBe(true);
  });
});
