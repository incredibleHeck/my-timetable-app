import { describe, it, expect } from 'vitest';
import { checkSlotValidity } from '../src/features/generator/scheduler/validation';
import { initializeState } from '../src/features/generator/scheduler/state';
import { AppData, Teacher, ClassGroup, Subject } from '../src/types';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('XYX Sandwich Pattern Repro', () => {
  const mockTeacher: Teacher = {
    id: 't1',
    name: 'Aunty Serwaa',
    specialtyIds: ['s1', 's2'],
    constraints: Array(5).fill(null).map(() => Array(10).fill(false)),
  };

  const mockClass: ClassGroup = {
    id: 'c1',
    name: 'Year 1A',
    curriculum: [],
    periodCount: 10
  };

  const subjectX: Subject = { id: 's1', name: 'BK', color: '#ff0000' };
  const subjectY: Subject = { id: 's2', name: 'Humanities', color: '#00ff00' };

  const baseData: AppData = {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: 10,
      dayStructure: Array(10).fill({ type: 'CLASS', label: 'C' }),
    },
    teachers: [mockTeacher],
    classes: [mockClass],
    subjects: [subjectX, subjectY],
    schedule: {
      'c1': {
        0: { // Monday
           0: { subjectId: 's1', teacherId: 't1', classId: 'c1' }, // BK at P1
           2: { subjectId: 's1', teacherId: 't1', classId: 'c1' }  // BK at P3
        }
      }
    },
  };

  it('should FAIL when proposing to put Subject Y at P2 between two Subject Xs', () => {
    const state = initializeState(baseData);
    
    // Proposing Subject Y (Humanities) at Period 1 (index 1, P2)
    // This creates the pattern: BK (P1), Humanities (P2), BK (P3)
    const result = checkSlotValidity(
      baseData,
      0, // day
      1, // period index 1 (P2)
      't1', // teacher
      'c1', // class
      's2', // subject Y (Humanities)
      state,
      undefined,
      undefined,
      1, // duration 1
      undefined,
      true // isAuto
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain("is split by empty period at P2");
  });
});
