/**
 * TABU MANAGER: Prevents cyclic moves in the repair phase.
 * Tenure reacts to success (shorter memory) and stagnation (longer memory).
 */
import {
  TABU_TENURE_DEFAULT,
  TABU_TENURE_MIN,
  TABU_TENURE_MAX,
} from "../constants";

export type TabuOptions = {
  tenure?: number;
  minTenure?: number;
  maxTenure?: number;
};

export class TabuManager {
  private tabuMap: Map<string, number> = new Map();
  private tenure: number;
  private readonly minTenure: number;
  private readonly maxTenure: number;
  private stagnationSignals = 0;

  constructor(options: TabuOptions = {}) {
    this.tenure = options.tenure ?? TABU_TENURE_DEFAULT;
    this.minTenure = options.minTenure ?? TABU_TENURE_MIN;
    this.maxTenure = options.maxTenure ?? TABU_TENURE_MAX;
  }

  getTenure(): number {
    return this.tenure;
  }

  /** Shrink tenure after a successful repair placement. */
  recordSuccess(): void {
    this.stagnationSignals = 0;
    this.tenure = Math.max(this.minTenure, Math.floor(this.tenure * 0.85));
  }

  /** Lengthen tenure when repair makes no net progress. */
  recordStagnation(): void {
    this.stagnationSignals++;
    if (this.stagnationSignals >= 3) {
      this.tenure = Math.min(this.maxTenure, this.tenure + 3);
      this.stagnationSignals = 0;
    }
  }

  markTabu(unitId: string, d: number, p: number, currentIteration: number): void {
    const key = `${unitId}-${d}-${p}`;
    this.tabuMap.set(key, currentIteration + this.tenure);
  }

  isTabu(unitId: string, d: number, p: number, currentIteration: number): boolean {
    const key = `${unitId}-${d}-${p}`;
    const expiry = this.tabuMap.get(key);

    if (!expiry) return false;

    if (currentIteration > expiry) {
      this.tabuMap.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Returns true when a tabu move should receive a penalty.
   * Zero-cost moves and improving aspiration moves bypass tabu.
   */
  shouldPenalizeTabu(
    unitId: string,
    d: number,
    p: number,
    currentIteration: number,
    moveCost: number,
    bestKnownCost: number,
  ): boolean {
    if (!this.isTabu(unitId, d, p, currentIteration)) return false;
    if (moveCost === 0) return false;
    if (moveCost < bestKnownCost) return false;
    return true;
  }

  cleanup(currentIteration: number): void {
    for (const [key, expiry] of this.tabuMap.entries()) {
      if (currentIteration > expiry) this.tabuMap.delete(key);
    }
  }
}
