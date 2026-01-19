/**
 * TABU MANAGER: Prevents cyclic moves in the repair phase.
 * It acts as a "Short-Term Memory" for the solver.
 */
export class TabuManager {
  private tabuMap: Map<string, number> = new Map();
  private tenure: number;

  constructor(tenure: number = 20) {
    this.tenure = tenure;
  }

  /**
   * Adds a move to the tabu list.
   * Key format: "unitId-day-period"
   */
  markTabu(unitId: string, d: number, p: number, currentIteration: number) {
    const key = `${unitId}-${d}-${p}`;
    this.tabuMap.set(key, currentIteration + this.tenure);
  }

  /**
   * Checks if a move is currently restricted.
   */
  isTabu(unitId: string, d: number, p: number, currentIteration: number): boolean {
    const key = `${unitId}-${d}-${p}`;
    const expiry = this.tabuMap.get(key);
    
    if (!expiry) return false;
    
    // If the iteration has passed the expiry, it's no longer tabu
    if (currentIteration > expiry) {
      this.tabuMap.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Periodic cleanup to keep the memory footprint small.
   */
  cleanup(currentIteration: number) {
    for (const [key, expiry] of this.tabuMap.entries()) {
      if (currentIteration > expiry) this.tabuMap.delete(key);
    }
  }
}
