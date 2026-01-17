import { describe, it, expect } from 'vitest';
import { validateFullSchedule } from '../src/features/generator/scheduler/validation';
import { initializeState } from '../src/features/generator/scheduler/state';
import { AppData, Teacher, Class, Subject } from '../src/types';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('Real-time Validation Integration', () => {
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
      maxTeacherPeriodsPerDay: 4,
      maxSubjectPeriodsPerDay: 4,
    },
    teachers: [mockTeacher],
    classes: [mockClass],
    subjects: [mockSubject],
    schedule: {
      'c1': {
        0: {
          0: { subjectId: 's1', teacherId: 't1', classId: 'c1' },
          1: { subjectId: 's1', teacherId: 't1', classId: 'c1' },
          2: { subjectId: 's1', teacherId: 't1', classId: 'c1' },
        }
      }
    },
    recentActivity: [],
  };

  it('should detect new conflicts when a teacher limit is lowered', () => {
    const stateInitial = initializeState(baseData);
    const initialConflicts = validateFullSchedule(baseData, stateInitial);
    expect(initialConflicts.length).toBe(0);

    const updatedData = {
      ...baseData,
      settings: {
        ...baseData.settings,
        maxTeacherPeriodsPerDay: 2,
      }
    };

    const stateUpdated = initializeState(updatedData);
    const newConflicts = validateFullSchedule(updatedData, stateUpdated);
    expect(newConflicts.length).toBeGreaterThan(0);
    expect(newConflicts[0].reason).toContain('Exceeds daily limit');
  });

  it('should clear conflicts when a teacher limit is raised', () => {
    const dataForLimit = {
      ...baseData,
      settings: {
        ...baseData.settings,
        maxTeacherPeriodsPerDay: 2,
      }
    };

    const stateInitial = initializeState(dataForLimit);
    const initialConflicts = validateFullSchedule(dataForLimit, stateInitial);
    expect(initialConflicts.length).toBeGreaterThan(0);

    const fixedData = {
      ...dataForLimit,
      settings: {
        ...dataForLimit.settings,
        maxTeacherPeriodsPerDay: 4,
      }
    };

    const stateFinal = initializeState(fixedData);
    const finalConflicts = validateFullSchedule(fixedData, stateFinal);
    expect(finalConflicts.length).toBe(0);
  });
});
