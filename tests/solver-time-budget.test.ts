import { describe, it, expect } from "vitest";
import {
  SOLVER_TARGET_MS,
  SOLVER_POST_BUDGET_MS,
  resolveSolverBudgetMs,
  resolveSolverHardLimitMs,
} from "../src/features/generator/scheduler/constants";

/**
 * The worker used to police every run against a flat 60s constant while the
 * solver sized its budget from the setting, so any limit above one minute was
 * silently ignored — and had the worker's cut-off been lifted on its own, the
 * separate 65s hard limit would have thrown away the result instead.
 *
 * Both deadlines now come from here, which is what these cover.
 */
describe("solver time budget", () => {
  it("uses the configured limit in minutes", () => {
    expect(resolveSolverBudgetMs({ solverTimeoutMinutes: 1 })).toBe(60_000);
    expect(resolveSolverBudgetMs({ solverTimeoutMinutes: 5 })).toBe(300_000);
    expect(resolveSolverBudgetMs({ solverTimeoutMinutes: 10 })).toBe(600_000);
  });

  it("falls back to the default when no limit is configured", () => {
    expect(resolveSolverBudgetMs({})).toBe(SOLVER_TARGET_MS);
    expect(resolveSolverBudgetMs({ solverTimeoutMinutes: undefined })).toBe(SOLVER_TARGET_MS);
  });

  it("ignores a zero or negative limit rather than ending the run instantly", () => {
    expect(resolveSolverBudgetMs({ solverTimeoutMinutes: 0 })).toBe(SOLVER_TARGET_MS);
    expect(resolveSolverBudgetMs({ solverTimeoutMinutes: -3 })).toBe(SOLVER_TARGET_MS);
  });

  // The hard limit aborts the run outright, so it has to sit above the budget
  // at every setting or a long solve would throw away the timetable it found.
  it("keeps the hard limit above the budget at every configured value", () => {
    for (const minutes of [1, 2, 5, 10]) {
      const budget = resolveSolverBudgetMs({ solverTimeoutMinutes: minutes });
      const hardLimit = resolveSolverHardLimitMs({ solverTimeoutMinutes: minutes });

      expect(hardLimit).toBe(budget + SOLVER_POST_BUDGET_MS);
      expect(hardLimit).toBeGreaterThan(budget);
    }
  });
});
