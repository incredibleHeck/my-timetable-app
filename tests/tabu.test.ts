import { describe, it, expect } from "vitest";
import { TabuManager } from "../src/features/generator/scheduler/solver/tabu";
import { TABU_TENURE_MIN, TABU_TENURE_MAX } from "../src/features/generator/scheduler/constants";

describe("TabuManager", () => {
  it("should mark a move as tabu and respect tenure", () => {
    const tabu = new TabuManager({ tenure: 5 });

    tabu.markTabu("unit1", 0, 0, 10);

    expect(tabu.isTabu("unit1", 0, 0, 11)).toBe(true);
    expect(tabu.isTabu("unit1", 0, 0, 15)).toBe(true);
    expect(tabu.isTabu("unit1", 0, 0, 16)).toBe(false);
  });

  it("should handle different coordinates separately", () => {
    const tabu = new TabuManager({ tenure: 10 });
    tabu.markTabu("unit1", 0, 0, 10);

    expect(tabu.isTabu("unit1", 0, 1, 11)).toBe(false);
    expect(tabu.isTabu("unit2", 0, 0, 11)).toBe(false);
  });

  it("should cleanup expired entries", () => {
    const tabu = new TabuManager({ tenure: 5 });
    tabu.markTabu("unit1", 0, 0, 10);
    tabu.markTabu("unit2", 1, 1, 20);

    tabu.cleanup(16);

    expect(tabu.isTabu("unit1", 0, 0, 17)).toBe(false);
    expect(tabu.isTabu("unit2", 1, 1, 21)).toBe(true);
  });

  it("shortens tenure after success and lengthens after stagnation", () => {
    const tabu = new TabuManager({ tenure: 20, minTenure: TABU_TENURE_MIN, maxTenure: TABU_TENURE_MAX });
    const initial = tabu.getTenure();

    tabu.recordSuccess();
    expect(tabu.getTenure()).toBeLessThan(initial);

    for (let i = 0; i < 3; i++) tabu.recordStagnation();
    expect(tabu.getTenure()).toBeGreaterThan(TABU_TENURE_MIN);
    expect(tabu.getTenure()).toBeLessThanOrEqual(TABU_TENURE_MAX);
  });

  it("shouldPenalizeTabu bypasses zero-cost and improving moves", () => {
    const tabu = new TabuManager({ tenure: 10 });
    tabu.markTabu("unit1", 0, 0, 5);

    expect(tabu.shouldPenalizeTabu("unit1", 0, 0, 6, 0, Infinity)).toBe(false);
    expect(tabu.shouldPenalizeTabu("unit1", 0, 0, 6, 500, 1000)).toBe(false);
    expect(tabu.shouldPenalizeTabu("unit1", 0, 0, 6, 1500, 1000)).toBe(true);
  });
});
