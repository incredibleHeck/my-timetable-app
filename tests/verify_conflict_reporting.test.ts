import { describe, it, expect } from 'vitest';
import { solveSmart } from '../src/features/generator/scheduler/solver/solver';
import { prepareAllocationUnits } from '../src/features/generator/scheduler/logic/preparation';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('Conflict Reporting Verification', () => {
  it('should report unplaced lessons when oversubscribed', () => {
    // 1. Create data with 12 periods available but 15 periods requested in curriculum
    const data = {
      ...DEFAULT_DATA,
      settings: {
        ...DEFAULT_DATA.settings,
        periodsPerDay: 12,
        daysPerWeek: 1 // Only 1 day for a small, fast test
      },
      classes: [{
        id: 'c1',
        name: 'Test Class',
        defaultRoomId: 'r1',
        curriculum: [{
          id: 'curr1',
          subjectId: 's1',
          periodsPerWeek: 15, // MORE than the 12 available slots
          doubles: 0,
          singles: 15,
          assignedTeacherId: 't1'
        }]
      }],
      subjects: [{ id: 's1', name: 'Math' }],
      teachers: [{ id: 't1', name: 'Teacher 1', specialtyIds: ['s1'], constraints: [] }],
      rooms: [{ id: 'r1', name: 'Room 1', capacity: 30 }]
    };

    const units = prepareAllocationUnits(data);
    
    // 2. Run Solver
    const { conflicts } = solveSmart(units, data);

    // 3. Verify conflicts contain the unplaced messages
    console.log('Detected Conflicts:', conflicts.map(c => c.reason));
    
    const hasUnplaced = conflicts.some(c => c.reason.includes('Unplaced') || c.reason.includes('Could not find'));
    expect(hasUnplaced).toBe(true);
    
    const mathConflict = conflicts.find(c => c.subjectName === 'Math');
    expect(mathConflict).toBeDefined();
    expect(mathConflict?.className).toBe('Test Class');
  });
});
