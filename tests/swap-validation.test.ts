import { describe, it, expect } from 'vitest';
import { checkSlotValidity } from '../src/features/generator/scheduler/validation/index';
import { initializeState } from '../src/features/generator/scheduler/core/state';
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
      maxConsecutivePeriods: 10,
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
    recentActivity: [],
  };

  it('FAIL: should NOT trigger "Max Subject Periods" error when moving a Double Period to an empty slot on same day', () => {
    const state = initializeState(baseData);
    const result = checkSlotValidity(
      baseData,
      0, // day
      3, // target period
      't1',
      'c1',
      's1',
      state,
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

    const state = initializeState(data);
    const result = checkSlotValidity(
      data,
      0,
      2,
      't1',
      'c1',
      's1',
      state,
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

    const state = initializeState(data);
    const result = checkSlotValidity(
        data,
        0,
        3,
        't1',
        'c1',
        's1',
        state,
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

    const state = initializeState(data);
    const result = checkSlotValidity(
        data,
        0,
        1, // target P1 (where Science is)
        't1',
        'c1',
        's1', // Math
        state,
        { day: 0, period: 0 }, // ignore source P0
        undefined,
        1,
        { day: 0, period: 1, duration: 1 }, // ignore target P1 (atomic swap)
        true
    );

    expect(result.valid).toBe(true);
  });

  it('FAIL: should NOT trigger "Consecutive period limit" error incorrectly during a swap', () => {
    const reproData = {
        ...baseData,
        settings: { ...baseData.settings, maxConsecutivePeriods: 2 },
        schedule: {
            'c1': {
                0: {
                    0: { subjectId: 's1', teacherId: 't1', classId: 'c1' },
                    1: { subjectId: 's1', teacherId: 't1', classId: 'c1' }
                }
            }
        }
    } as AppData;

    const state = initializeState(reproData);
    const result = checkSlotValidity(
      reproData,
      0,
      1,
      't1',
      'c1',
      's1',
      state,
      { day: 0, period: 0, duration: 2 }, // ignore source P0, P1
      undefined,
      2, // duration = 2
      undefined,
      true
    );

    expect(result.valid).toBe(true);
  });
});
