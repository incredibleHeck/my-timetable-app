import { describe, it, expect } from 'vitest';
import { TabuManager } from '../src/features/generator/scheduler/solver/tabu';

describe('TabuManager', () => {
  it('should mark a move as tabu and respect tenure', () => {
    const tabu = new TabuManager(5); // Tenure 5
    
    tabu.markTabu('unit1', 0, 0, 10); // Mark at iteration 10
    
    // Should be tabu at iteration 11, 12, 13, 14, 15
    expect(tabu.isTabu('unit1', 0, 0, 11)).toBe(true);
    expect(tabu.isTabu('unit1', 0, 0, 15)).toBe(true);
    
    // Should expire at iteration 16
    expect(tabu.isTabu('unit1', 0, 0, 16)).toBe(false);
  });

  it('should handle different coordinates separately', () => {
    const tabu = new TabuManager(10);
    tabu.markTabu('unit1', 0, 0, 10);
    
    expect(tabu.isTabu('unit1', 0, 1, 11)).toBe(false);
    expect(tabu.isTabu('unit2', 0, 0, 11)).toBe(false);
  });

  it('should cleanup expired entries', () => {
    const tabu = new TabuManager(5);
    tabu.markTabu('unit1', 0, 0, 10);
    tabu.markTabu('unit2', 1, 1, 20);
    
    tabu.cleanup(16); // unit1 should be removed
    
    expect(tabu.isTabu('unit1', 0, 0, 17)).toBe(false);
    expect(tabu.isTabu('unit2', 1, 1, 21)).toBe(true);
  });
});
