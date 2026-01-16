import { describe, it, expect } from 'vitest';
import { checkSlotValidity } from '../src/features/generator/scheduler/validation';
import { AppData, Teacher, Class, Subject } from '../src/types';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('Configurable Constraints', () => {
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
      dayStructure: Array(8).fill(null).map(() => ({ type: 'CLASS', label: 'C' })),
      maxSubjectPeriodsPerDay: 2,
      maxTeacherPeriodsPerDay: 6,
    },
    teachers: [mockTeacher],
    classes: [mockClass],
    subjects: [mockSubject],
  };

  it('should respect configurable maxSubjectPeriodsPerDay', () => {
    const data: AppData = {
      ...baseData,
      settings: {
        ...baseData.settings,
        maxSubjectPeriodsPerDay: 1, // Stricter limit
      },
      schedule: {
        'c1': {
          0: {
            0: { subjectId: 's1', teacherId: 't1', classId: 'c1' },
          }
        }
      }
    };

    const result = checkSlotValidity(
      data,
      0, // day
      1, // period
      't1',
      'c1',
      's1',
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Max 1 periods');
  });

  it('should respect configurable maxTeacherPeriodsPerDay', () => {
    const otherClass: Class = { id: 'other', name: 'Other', curriculum: [] };
    const data: AppData = {
      ...baseData,
      settings: {
        ...baseData.settings,
        maxTeacherPeriodsPerDay: 2, // Very strict
      },
      classes: [...baseData.classes, otherClass],
      schedule: {
        'other': {
          0: {
            0: { subjectId: 's2', teacherId: 't1', classId: 'other' },
            1: { subjectId: 's2', teacherId: 't1', classId: 'other' },
          }
        }
      }
    };

    const result = checkSlotValidity(
      data,
      0,
      2,
      't1',
      'c1',
      's1',
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain("Exceeds John Doe's daily limit of 2 periods");
  });
});
