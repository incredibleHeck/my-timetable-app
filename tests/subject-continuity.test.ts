import { describe, it, expect } from 'vitest';
import { checkSubjectContinuity } from '../src/features/generator/scheduler/validation/load-checks';
import { AppData, Teacher, ClassGroup, Subject } from '../src/types';
import { DEFAULT_DATA } from '../src/utils/constants';
import { ValidationContext } from '../src/features/generator/scheduler/validation/types';

describe('Subject Continuity Validation', () => {
  const mockTeacher: Teacher = {
    id: 't1',
    name: 'John Doe',
    specialtyIds: ['s1'],
    constraints: Array(5).fill(null).map(() => Array(8).fill(false)),
  };

  const mockClass: ClassGroup = {
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
    },
    teachers: [mockTeacher],
    classes: [mockClass],
    subjects: [mockSubject],
    schedule: {},
  };

  const createCtx = (data: AppData, subjectId: string): ValidationContext => ({
    data,
    targetDay: 0,
    targetPeriod: 0,
    teacherId: 't1',
    classId: 'c1',
    subjectId: subjectId,
    duration: 1,
    maxPeriods: 8,
    structure: data.settings.dayStructure,
    classSchedule: [],
    allClassSchedules: new Map(),
    ignoredSlots: new Set(),
  });

  it('should be valid for a single period', () => {
    const data = { ...baseData };
    const ctx = createCtx(data, 's1');
    const result = checkSubjectContinuity(ctx, new Set([2]), new Set());
    expect(result).toBeNull();
  });

  it('should be valid for adjacent periods', () => {
    const data = { ...baseData };
    const ctx = createCtx(data, 's1');
    const result = checkSubjectContinuity(ctx, new Set([2, 3]), new Set());
    expect(result).toBeNull();
  });

  it('should be valid for periods bridged by BREAK', () => {
    const data = {
      ...baseData,
      settings: {
        ...baseData.settings,
        dayStructure: [
          { type: 'CLASS', label: 'P1' },
          { type: 'BREAK', label: 'B1' },
          { type: 'CLASS', label: 'P2' },
        ],
      },
    };
    const ctx = createCtx(data, 's1');
    // Period 0 and Period 2 are CLASS, Period 1 is BREAK
    const result = checkSubjectContinuity(ctx, new Set([0, 2]), new Set());
    expect(result).toBeNull();
  });

  it('should be invalid for periods split by another subject', () => {
    const data: AppData = {
      ...baseData,
      schedule: {
        'c1': {
          0: {
            1: { subjectId: 's2', teacherId: 't2', classId: 'c1' }
          }
        }
      }
    };
    const ctx = createCtx(data, 's1');
    // Math at P0 and P2, English at P1
    const result = checkSubjectContinuity(ctx, new Set([0, 2]), new Set());
    expect(result).not.toBeNull();
    expect(result?.message).toMatch(/split by|sandwiched by/i);
  });

  it('should be invalid for periods split by an empty CLASS slot', () => {
    const data = { ...baseData };
    const ctx = createCtx(data, 's1');
    // Math at P0 and P2, P1 is empty CLASS
    const result = checkSubjectContinuity(ctx, new Set([0, 2]), new Set());
    expect(result).not.toBeNull();
    expect(result?.message).toMatch(/split by|sandwiched by/i);
  });

  it('should be invalid for multiple blocks on the same day', () => {
     const data = { ...baseData };
     const ctx = createCtx(data, 's1');
     // Math block P0-P1, and another block P4-P5
     const result = checkSubjectContinuity(ctx, new Set([0, 1, 4, 5]), new Set());
     expect(result).not.toBeNull();
     expect(result?.message).toMatch(/split by|sandwiched by/i);
  });
});
