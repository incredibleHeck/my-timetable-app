import { describe, it, expect, vi } from 'vitest';
import { validateFullSchedule } from '../src/features/generator/scheduler/validation';
import { AppData, Teacher, Class, Subject } from '../src/types';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('Real-time Validation Integration', () => {
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
  };

  const mockSubject: Subject = {
      id: 's1',
      name: 'Math'
  };

  const baseData: AppData = {
    ...DEFAULT_DATA,
    settings: {
        ...DEFAULT_DATA.settings,
        maxTeacherPeriodsPerDay: 6,
    },
    teachers: [mockTeacher],
    classes: [mockClass],
    subjects: [mockSubject],
    schedule: {
      'c1': {
        0: {
          0: { subjectId: 's1', teacherId: 't1', classId: 'c1' },
          1: { subjectId: 's2', teacherId: 't1', classId: 'c1' },
          2: { subjectId: 's3', teacherId: 't1', classId: 'c1' }
        }
      }
    }
  };

  it('should detect new conflicts when a teacher limit is lowered', () => {
    // Current state: 3 periods for John Doe. Max global is 6.
    const initialConflicts = validateFullSchedule(baseData);
    expect(initialConflicts.length).toBe(0);

    // Update teacher to have limit of 2
    const updatedTeacher = { ...mockTeacher, maxPeriodsPerDay: 2 };
    const updatedData: AppData = {
      ...baseData,
      teachers: [updatedTeacher]
    };

    const newConflicts = validateFullSchedule(updatedData);
    expect(newConflicts.length).toBeGreaterThan(0);
    expect(newConflicts[0].reason).toContain("Exceeds John Doe's daily limit of 2 periods");
  });

  it('should clear conflicts when a teacher limit is raised', () => {
     // Start with a conflict (Limit 2, 3 periods assigned)
    const updatedTeacher = { ...mockTeacher, maxPeriodsPerDay: 2 };
    const badData: AppData = {
      ...baseData,
      teachers: [updatedTeacher]
    };

    const initialConflicts = validateFullSchedule(badData);
    expect(initialConflicts.length).toBeGreaterThan(0);

    // Raise limit to 4
    const fixedTeacher = { ...mockTeacher, maxPeriodsPerDay: 4 };
    const fixedData: AppData = {
      ...baseData,
      teachers: [fixedTeacher]
    };

    const finalConflicts = validateFullSchedule(fixedData);
    expect(finalConflicts.length).toBe(0);
  });
});
