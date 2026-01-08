import { describe, it, expect } from 'vitest';
import { generateDutyRoster } from '../src/features/duty/logic/dutyGenerator';
import { AppData, Teacher } from '../src/types';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('Duty Roster Generator', () => {
  const teachers: Teacher[] = Array.from({ length: 10 }, (_, i) => ({
    id: `t${i}`,
    name: `Teacher ${i}`,
    specialtyIds: [],
    constraints: [],
  }));

  const mockData: AppData = {
    ...DEFAULT_DATA,
    teachers,
  };

  it('should not assign a teacher more than once in a DAILY roster', () => {
    const config = {
      viewType: 'DAILY' as const,
      numWeeks: 1,
      minTeachers: 2,
      maxTeachers: 2,
      excludedTeacherIds: [],
    };

    const assignments = generateDutyRoster(mockData, config);
    
    // Total slots = 5 days * 2 teachers = 10 slots
    // Since we have 10 teachers, everyone should be assigned exactly once.
    expect(assignments.length).toBe(10);

    const teacherIds = assignments.map(a => a.teacherId);
    const uniqueTeachers = new Set(teacherIds);
    
    expect(uniqueTeachers.size).toBe(assignments.length);
  });

  it('should stop assigning when no more unique teachers are available', () => {
    const config = {
      viewType: 'DAILY' as const,
      numWeeks: 1,
      minTeachers: 3,
      maxTeachers: 3,
      excludedTeacherIds: [],
    };

    // Total slots desired = 5 days * 3 teachers = 15 slots
    // We only have 10 teachers. It should stop at 10.
    const assignments = generateDutyRoster(mockData, config);
    
    expect(assignments.length).toBe(10);
    
    const uniqueTeachers = new Set(assignments.map(a => a.teacherId));
    expect(uniqueTeachers.size).toBe(10);
  });

  it('should respect excluded teachers', () => {
    const config = {
      viewType: 'DAILY' as const,
      numWeeks: 1,
      minTeachers: 2,
      maxTeachers: 2,
      excludedTeacherIds: ['t0', 't1'],
    };

    const assignments = generateDutyRoster(mockData, config);
    const teacherIds = assignments.map(a => a.teacherId);
    
    expect(teacherIds).not.toContain('t0');
    expect(teacherIds).not.toContain('t1');
    expect(new Set(teacherIds).size).toBe(teacherIds.length);
  });
});
