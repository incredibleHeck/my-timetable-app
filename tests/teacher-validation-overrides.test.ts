import { describe, it, expect } from 'vitest';
import { checkSlotValidity } from '../src/features/generator/scheduler/validation/index';
import { initializeState } from '../src/features/generator/scheduler/core/state';
import { AppData, Teacher, Class, Subject } from '../src/types';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('Teacher Daily Limit (global settings)', () => {
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
    structure: Array(10).fill({ type: 'CLASS', label: 'C' }),
    defaultRoomId: 'r1',
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
      maxTeacherPeriodsPerDay: 6,
      maxConsecutivePeriods: 10,
      periodsPerDay: 10,
      dayStructure: Array(10).fill({ type: 'CLASS', label: 'C' }),
    },
    teachers: [mockTeacher],
    classes: [mockClass],
    subjects: [
      mockSubject,
      { id: 's2', name: 'S2', color: '#00ff00' },
      { id: 's3', name: 'S3', color: '#0000ff' },
      { id: 's4', name: 'S4', color: '#ffff00' },
      { id: 's5', name: 'S5', color: '#ff00ff' },
      { id: 's6', name: 'S6', color: '#00ffff' },
      { id: 's7', name: 'S7', color: '#888888' },
    ],
    schedule: {
      c1: {
        0: {
          0: { subjectId: 's1', teacherId: 't1', classId: 'c1' },
          1: { subjectId: 's2', teacherId: 't1', classId: 'c1' },
          2: { subjectId: 's3', teacherId: 't1', classId: 'c1' },
          3: { subjectId: 's4', teacherId: 't1', classId: 'c1' },
          4: { subjectId: 's5', teacherId: 't1', classId: 'c1' },
          5: { subjectId: 's6', teacherId: 't1', classId: 'c1' },
        },
      },
    },
    recentActivity: [],
  };

  it('enforces global maxTeacherPeriodsPerDay when adding another period', () => {
    const state = initializeState(baseData);
    const result = checkSlotValidity(
      baseData,
      0,
      6,
      't1',
      'c1',
      's7',
      state,
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Exceeds daily limit');
  });
});
