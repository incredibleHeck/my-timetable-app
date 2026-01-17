import { describe, it, expect } from 'vitest';
import { checkSlotValidity } from '../src/features/generator/scheduler/validation';
import { AppData, Teacher, Class, Subject } from '../src/types';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('Teacher Daily Limit Overrides', () => {
  const mockTeacher: Teacher = {
    id: 't1',
    name: 'John Doe',
    specialtyIds: ['s1'],
    constraints: Array(5).fill(null).map(() => Array(10).fill(false)),
  };

  const mockClass: Class = {
    id: 'c1',
    name: '10A',
    curriculum: [],
    studentCount: 30,
    periodCount: 10,
    structure: Array(10).fill({ type: 'CLASS', label: 'C' })
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
      maxTeacherPeriodsPerDay: 6, // Global limit
      maxConsecutivePeriods: 10,
      periodsPerDay: 10,
      dayStructure: Array(10).fill({ type: 'CLASS', label: 'C' }),
    },
    teachers: [mockTeacher],
    classes: [mockClass],
    subjects: [mockSubject],
    schedule: {
        'c1': {
          0: {
            2: { subjectId: 's1', teacherId: 't1', classId: 'c1' },
            3: { subjectId: 's1', teacherId: 't1', classId: 'c1' },
            4: { subjectId: 's1', teacherId: 't1', classId: 'c1' },
            5: { subjectId: 's1', teacherId: 't1', classId: 'c1' }
          }
        }
    }
  };

  it('should respect a STRICTER teacher-specific limit (e.g. 4 vs global 6)', () => {
    const strictTeacher = {
      ...mockTeacher,
      maxPeriodsPerDay: 4
    };

    const data: AppData = {
      ...baseData,
      teachers: [strictTeacher]
    };

    // Teacher already has 4 periods at P2, P3, P4, P5.
    // Adding 5th period at P0 should FAIL.
    const result = checkSlotValidity(
      data,
      0, // Monday
      0, // Period 0
      't1',
      'c1',
      's1'
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain("Exceeds daily limit");
  });

  it('should respect a MORE LENIENT teacher-specific limit (e.g. 8 vs global 6)', () => {
    const lenientTeacher = {
      ...mockTeacher,
      maxPeriodsPerDay: 8
    };

    const data: AppData = {
      ...baseData,
      teachers: [lenientTeacher]
    };

    // Teacher has 4 periods. Adding 5th, 6th, 7th should PASS.
    // Let's add 6 existing periods and try to add a 7th.
    const busyData: AppData = {
        ...data,
        schedule: {
            'c1': {
                0: {
                    0: { subjectId: 's1', teacherId: 't1', classId: 'c1' },
                    1: { subjectId: 's2', teacherId: 't1', classId: 'c1' },
                    2: { subjectId: 's3', teacherId: 't1', classId: 'c1' },
                    3: { subjectId: 's4', teacherId: 't1', classId: 'c1' },
                    4: { subjectId: 's5', teacherId: 't1', classId: 'c1' },
                    5: { subjectId: 's6', teacherId: 't1', classId: 'c1' }
                }
            }
        }
    };

    const result = checkSlotValidity(
        busyData,
        0,
        6, // Adding 7th period
        't1',
        'c1',
        's7'
    );

    expect(result.valid).toBe(true);
  });

  it('should fall back to global limit if teacher limit is undefined', () => {
    // Teacher has no override. Global is 6.
    // Adding 7th period should FAIL with global limit.
    const busyData: AppData = {
        ...baseData,
        schedule: {
            'c1': {
                0: {
                    0: { subjectId: 's1', teacherId: 't1', classId: 'c1' },
                    1: { subjectId: 's2', teacherId: 't1', classId: 'c1' },
                    2: { subjectId: 's3', teacherId: 't1', classId: 'c1' },
                    3: { subjectId: 's4', teacherId: 't1', classId: 'c1' },
                    4: { subjectId: 's5', teacherId: 't1', classId: 'c1' },
                    5: { subjectId: 's6', teacherId: 't1', classId: 'c1' }
                }
            }
        }
    };

    const result = checkSlotValidity(
        busyData,
        0,
        6, // Adding 7th period
        't1',
        'c1',
        's7'
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain("Exceeds daily limit");
  });
});
