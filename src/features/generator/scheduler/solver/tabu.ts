/**
 * TABU MANAGER: Prevents cyclic moves in the repair phase.
 *
 * Reactive tenure adapts to both problem size and search dynamics:
 * - Base tenure scales with sqrt(N) where N = unplaced count
 * - Randomized jitter prevents deterministic cycling
 * - Shortens on success, lengthens on stagnation
 */
import { TABU_TENURE_DEFAULT, TABU_TENURE_MIN, TABU_TENURE_MAX } from "../constants";

export type TabuOptions = {
  tenure?: number;
  minTenure?: number;
  maxTenure?: number;
};

export class TabuManager {
  private tabuMap: Map<string, number> = new Map();
  private tenure: number;
  private baseTenure: number;
  private readonly minTenure: number;
  private readonly maxTenure: number;
  private stagnationSignals = 0;
  private recentGangIds: string[] = [];
  private readonly cycleWindow = 20;

  constructor(options: TabuOptions = {}) {
    this.tenure = options.tenure ?? TABU_TENURE_DEFAULT;
    this.baseTenure = this.tenure;
    this.minTenure = options.minTenure ?? TABU_TENURE_MIN;
    this.maxTenure = options.maxTenure ?? TABU_TENURE_MAX;
  }

  getTenure(): number {
    return this.tenure;
  }

  /**
   * Recompute base tenure from current problem size.
   * Formula: base + floor(sqrt(N)) + random jitter in [0, floor(sqrt(N))]
   */
  adaptToSize(unplacedCount: number): void {
    const sqrtN = Math.floor(Math.sqrt(Math.max(1, unplacedCount)));
    const jitter = Math.floor(Math.random() * (sqrtN + 1));
    this.baseTenure = Math.min(
      this.maxTenure,
      Math.max(this.minTenure, this.minTenure + sqrtN + jitter),
    );
    this.tenure = this.baseTenure;
  }

  /** Shrink tenure after a successful repair placement. */
  recordSuccess(): void {
    this.stagnationSignals = 0;
    this.tenure = Math.max(this.minTenure, Math.floor(this.tenure * 0.85));
  }

  /** Lengthen tenure when repair makes no net progress. */
  recordStagnation(): void {
    this.stagnationSignals++;
    this.tenure = Math.min(this.maxTenure, this.tenure + 2);
    if (this.stagnationSignals >= 3) {
      this.tenure = Math.min(this.maxTenure, this.baseTenure + 5);
      this.stagnationSignals = 0;
    }
  }

  /**
   * Record that a gang was dequeued for repair. If the same gang keeps
   * appearing in a short window, bump tenure to break the cycle.
   */
  recordGangAttempt(gangId: string): void {
    this.recentGangIds.push(gangId);
    if (this.recentGangIds.length > this.cycleWindow) {
      this.recentGangIds.shift();
    }

    if (this.recentGangIds.length >= this.cycleWindow) {
      const freq = this.recentGangIds.filter((id) => id === gangId).length;
      if (freq >= Math.ceil(this.cycleWindow / 3)) {
        this.tenure = Math.min(this.maxTenure, this.tenure + 3);
      }
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
