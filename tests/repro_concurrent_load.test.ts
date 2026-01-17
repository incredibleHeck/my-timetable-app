import { describe, it, expect } from 'vitest';
import { checkSlotValidity } from '../src/features/generator/scheduler/validation';
import { initializeState } from '../src/features/generator/scheduler/state';
import { AppData } from '../src/types';

describe('checkSlotValidity - Concurrent Daily Load', () => {
  const mockData: Partial<AppData> = {
    settings: {
      periodsPerDay: 8,
      dayStructure: [
        { type: 'CLASS', label: '1' },
        { type: 'CLASS', label: '2' },
        { type: 'CLASS', label: '3' },
        { type: 'CLASS', label: '4' },
      ],
      fixedOccasions: [],
      maxTeacherPeriodsPerDay: 3, // Set a low limit for testing
    } as any,
    teachers: [{ id: 't1', name: 'Teacher 1', constraints: [[],[],[],[],[]] } as any],
    classes: [
      { id: 'c1', name: 'Class 1', curriculum: [], defaultRoomId: 'r1' },
      { id: 'c2', name: 'Class 2', curriculum: [] },
    ] as any,
    subjects: [{ id: 's1', name: 'Subject 1' } as any],
    jointClasses: [
      { id: 'j1', name: 'Joint S1', subjectId: 's1', classIds: ['c1', 'c2'] }
    ],
    electives: [],
    rooms: [],
    schedule: {
      'c2': {
        0: {
          0: { subjectId: 's1', teacherId: 't1' },
          1: { subjectId: 's1', teacherId: 't1' },
        }
      }
    },
    recentActivity: [],
  };

  it('should NOT fail daily load check when assigning same teacher to a concurrent slot', () => {
    // Current state: t1 has 2 periods in c2 (P0, P1). Total = 2.
    // We try to assign t1 to c1 at P0.
    // If it counts unique periods, load is still 2 (P0 and P1).
    // If it counts assignments, load becomes 3 (c2@P0, c2@P1, c1@P0).
    
    // We'll set max to 2 to trigger failure if it counts assignments.
    const data = {
        ...mockData,
        settings: { ...mockData.settings, maxTeacherPeriodsPerDay: 2 }
    } as AppData;

    const state = initializeState(data);
    const result = checkSlotValidity(
      data,
      0, // day
      0, // period (concurrent with c2@P0)
      't1',
      'c1',
      's1',
      state,
      undefined,
      undefined,
      1,
      undefined,
      true
    );

    // It SHOULD be valid because unique periods (0, 1) = 2, which is <= max (2).
    if (!result.valid) {
        console.log('Validation Message:', result.message);
    }
    expect(result.valid).toBe(true);
  });
  
  it('should fail daily load check only when unique periods exceed limit', () => {
    const data = {
        ...mockData,
        settings: { ...mockData.settings, maxTeacherPeriodsPerDay: 2 }
    } as AppData;

    // Try to assign to P2. Unique periods would be P0, P1, P2 = 3. 3 > 2.
    const state = initializeState(data);
    const result = checkSlotValidity(
      data,
      0,
      2, 
      't1',
      'c1',
      's1',
      state,
      undefined,
      undefined,
      1,
      undefined,
      true
    );

    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/exceeds daily limit/i);
  });
});
