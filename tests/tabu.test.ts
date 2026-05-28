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
    const tabu = new TabuManager({
      tenure: 20,
      minTenure: TABU_TENURE_MIN,
      maxTenure: TABU_TENURE_MAX,
    });
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

  it("adaptToSize scales tenure with problem size", () => {
    const tabu = new TabuManager({ tenure: 25, minTenure: 5, maxTenure: 60 });

    tabu.adaptToSize(1);
    const smallTenure = tabu.getTenure();

    tabu.adaptToSize(100);
    const largeTenure = tabu.getTenure();

    expect(smallTenure).toBeGreaterThanOrEqual(5);
    expect(smallTenure).toBeLessThanOrEqual(8);
    expect(largeTenure).toBeGreaterThanOrEqual(15);
    expect(largeTenure).toBeLessThanOrEqual(25);
  });

  it("adaptToSize respects min/max bounds", () => {
    const tabu = new TabuManager({ tenure: 25, minTenure: 10, maxTenure: 40 });

    tabu.adaptToSize(0);
    expect(tabu.getTenure()).toBeGreaterThanOrEqual(10);

    tabu.adaptToSize(10000);
    expect(tabu.getTenure()).toBeLessThanOrEqual(40);
  });

  it("recordGangAttempt bumps tenure when cycling is detected", () => {
    const tabu = new TabuManager({ tenure: 15, minTenure: 10, maxTenure: 40 });
    const before = tabu.getTenure();

    for (let i = 0; i < 20; i++) {
      tabu.recordGangAttempt("gang-stuck");
    }

    expect(tabu.getTenure()).toBeGreaterThan(before);
  });

  it("recordGangAttempt does not bump tenure when gangs are diverse", () => {
    const tabu = new TabuManager({ tenure: 15, minTenure: 10, maxTenure: 40 });
    const before = tabu.getTenure();

    for (let i = 0; i < 20; i++) {
      tabu.recordGangAttempt(`gang-${i}`);
    }

    expect(tabu.getTenure()).toBe(before);
  });
});
