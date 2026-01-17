import { describe, it, expect } from 'vitest';
import { checkSlotValidity } from '../src/features/generator/scheduler/validation';
import { AppData, Teacher, Class, Subject } from '../src/types';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('Swap Validation Reproduction', () => {
  const mockTeacher: Teacher = {
    id: 't1',
    name: 'John Doe',
    specialtyIds: ['s1'],
    constraints: Array(5).fill(null).map(() => Array(8).fill(false)),
  };

  const mockClass: Class = {
    id: 'c1',
    name: '10A',
    curriculum: [],
  };

  const mockSubject: Subject = {
    id: 's1',
    name: 'Math',
    color: '#ff0000',
  };

  const baseData: AppData = {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: 8,
      dayStructure: Array(8).fill({ type: 'CLASS', label: 'C' }),
      maxSubjectPeriodsPerDay: 2,
      maxTeacherPeriodsPerDay: 6,
    },
    teachers: [mockTeacher],
    classes: [mockClass],
    subjects: [mockSubject],
    schedule: {
      'c1': {
        0: { // Monday
           0: { subjectId: 's1', teacherId: 't1', classId: 'c1', isFixed: false },
           1: { subjectId: 's1', teacherId: 't1', classId: 'c1', isFixed: true }
        }
      }
    },
  };

  it('FAIL: should NOT trigger "Max Subject Periods" error when moving a Double Period to an empty slot on same day', () => {
    // Current state: P0 and P1 are 's1'. Total = 2.
    // Subject limit = 2.
    // Moving P0 & P1 to P3 & P4 should be valid if we ignore the source.
    
    const result = checkSlotValidity(
      baseData,
      0, // day
      3, // target period
      't1',
      'c1',
      's1',
      { day: 0, period: 0, duration: 2 }, // ignore source (P0, P1)
      undefined,
      2, // duration = 2
      undefined,
      true
    );

    expect(result.valid).toBe(true); 
  });

  it('FAIL: should NOT trigger "Exceeds daily limit" error when moving a teacher lesson on the same day if they are at limit', () => {
    // Set teacher limit to 2 for simplicity
    const data = {
        ...baseData,
        settings: { ...baseData.settings, maxTeacherPeriodsPerDay: 2 }
    };

    // Current state: Teacher t1 has 2 periods (P0, P1). Total = 2. Limit = 2.
    // Moving P0 to P2 should be valid (avoids gap conflict at P2).
    
    const result = checkSlotValidity(
      data,
      0,
      2,
      't1',
      'c1',
      's1',
      { day: 0, period: 0, duration: 1 }, // ignore source (P0)
      undefined,
      1,
      undefined,
      true
    );

    expect(result.valid).toBe(true);
  });

  it('FAIL: should NOT trigger "Exceeds daily limit" error during a 2nd-period check of a double period swap', () => {
    // Current state: Teacher t1 has 2 periods at P0, P1.
    // We are moving them to P3, P4.
    const data = {
        ...baseData,
        settings: { ...baseData.settings, maxTeacherPeriodsPerDay: 2 }
    };

    const result = checkSlotValidity(
        data,
        0,
        3,
        't1',
        'c1',
        's1',
        { day: 0, period: 0, duration: 2 }, // Ignore P0, P1
        undefined,
        2, // duration
        undefined,
        true
    );

    expect(result.valid).toBe(true);
  });

  it('FAIL: should correctly handle a swap between two lessons of the same teacher', () => {
    // Teacher T1: Math at P0, Science at P1. Limit = 2.
    // Swapping Math (P0) with Science (P1).
    // Final state should still be 2 periods.
    const data = {
        ...baseData,
        subjects: [...baseData.subjects, { id: 's2', name: 'Science' }],
        settings: { ...baseData.settings, maxTeacherPeriodsPerDay: 2 },
        schedule: {
            'c1': {
                0: {
                    0: { subjectId: 's1', teacherId: 't1', classId: 'c1' },
                    1: { subjectId: 's2', teacherId: 't1', classId: 'c1' }
                }
            }
        }
    } as AppData;

    const result = checkSlotValidity(
        data,
        0,
        1, // target P1 (where Science is)
        't1',
        'c1',
        's1', // Math
        { day: 0, period: 0 }, // ignore source P0
        undefined,
        1,
        { day: 0, period: 1, duration: 1 }, // ignore target P1 (atomic swap)
        true
    );

    expect(result.valid).toBe(true);
  });

  it('FAIL: should NOT trigger "Consecutive period limit" error incorrectly during a swap', () => {
    // Max consecutive = 2
    const data = {
        ...baseData,
        settings: { ...baseData.settings, maxConsecutivePeriods: 2 },
        schedule: {
            'c1': {
                0: {
                    0: { subjectId: 's1', teacherId: 't1', classId: 'c1' },
                    1: { subjectId: 's1', teacherId: 't1', classId: 'c1' },
                    3: { subjectId: 's2', teacherId: 't1', classId: 'c1' }
                }
            }
        },
        subjects: [...baseData.subjects, { id: 's2', name: 'Science' }]
    } as AppData;

    // Current state: T1 is busy at P0, P1 and P3. Blocks are 2 and 1. Max = 2. Valid.
    // Moving P0, P1 to P1, P2.
    // Atomic result: Busy at P1, P2 (moved) and P3 (existing).
    // Blocks: P1, P2, P3. Consecutive = 3. Wait, P1, P2, P3 ARE consecutive.
    // Let's move them to P4, P5.
    // Busy at P4, P5 (moved) and P3 (existing).
    // Blocks: P3 and P4, P5. P3, P4, P5 is 3 consecutive.
    
    // Let's use P0, P1 -> P1, P2 but Science is at P4.
    // Moving P0, P1 to P1, P2. Science is at P4.
    // Busy at P1, P2 (moved) and P4 (existing).
    // Blocks: [1,2] and [4]. Max consecutive = 2. VALID.
    
    // IF DOUBLE COUNTED:
    // P0, P1 (old) + P1, P2 (new) = P0, P1, P2 busy. Consecutive = 3. FAIL.
    
    const reproData = {
        ...data,
        schedule: {
            'c1': {
                0: {
                    0: { subjectId: 's1', teacherId: 't1', classId: 'c1' },
                    1: { subjectId: 's1', teacherId: 't1', classId: 'c1' },
                    4: { subjectId: 's2', teacherId: 't1', classId: 'c1' }
                }
            }
        }
    } as AppData;

    const result = checkSlotValidity(
      reproData,
      0,
      1,
      't1',
      'c1',
      's1',
      { day: 0, period: 0, duration: 2 }, // ignore source P0, P1
      undefined,
      2, // duration = 2
      undefined,
      true
    );

    expect(result.valid).toBe(true);
  });
});
