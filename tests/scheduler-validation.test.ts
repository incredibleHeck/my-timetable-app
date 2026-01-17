import { describe, it, expect } from 'vitest';
import { checkSlotValidity } from '../src/features/generator/scheduler/validation';
import { initializeState } from '../src/features/generator/scheduler/state';
import { AppData, Teacher, Class, Subject, Room } from '../src/types';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('Scheduler Validation', () => {
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
    defaultRoomId: 'r1',
  };

  const mockSubject: Subject = {
    id: 's1',
    name: 'Math',
    color: '#ff0000',
    requiredRoomId: null,
  };

  const mockRoom: Room = {
    id: 'r1',
    name: 'Room 101',
    capacity: 25,
    type: 'Classroom',
  };

  const baseData: AppData = {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: 10,
      dayStructure: Array(10).fill({ type: 'CLASS', label: 'C' }),
    },
    teachers: [mockTeacher],
    classes: [mockClass],
    subjects: [mockSubject],
    rooms: [mockRoom],
  };

  it('should detect teacher overlap', () => {
    const otherClass: Class = { id: 'other-class', name: 'Other', curriculum: [], defaultRoomId: 'r1' };
    const data: AppData = {
      ...baseData,
      classes: [...baseData.classes, otherClass],
      schedule: {
        'other-class': {
          0: { // Monday
            0: { // Period 0
              subjectId: 's2',
              teacherId: 't1',
              classId: 'other-class',
            }
          }
        }
      }
    };

    const state = initializeState(data);
    const result = checkSlotValidity(
      data,
      0, // day
      0, // period
      't1', // teacherId
      'c1', // classId
      's1', // subjectId
      state
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Teacher Busy');
  });

  it('should detect room overlap', () => {
    const otherClass: Class = { id: 'other-class', name: 'Other', curriculum: [], defaultRoomId: 'r1' };
    const data: AppData = {
      ...baseData,
      classes: [...baseData.classes, otherClass],
      schedule: {
        'other-class': {
          0: { // Monday
            0: { // Period 0
              subjectId: 's2',
              teacherId: 't2',
              classId: 'other-class',
              roomId: 'r1'
            }
          }
        }
      }
    };

    const state = initializeState(data);
    const result = checkSlotValidity(
      data,
      0, // day
      0, // period
      't1', // teacherId
      'c1', // classId
      's1', // subjectId
      state,
      undefined,
      'r1' // roomId
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Room occupied');
  });

  it('should respect teacher constraints', () => {
    const restrictedTeacher = {
      ...mockTeacher,
      constraints: Array(5).fill(null).map((_, d) => 
        Array(10).fill(null).map((_, p) => d === 0 && p === 0)
      )
    };

    const data: AppData = {
      ...baseData,
      teachers: [restrictedTeacher]
    };

    const state = initializeState(data);
    const result = checkSlotValidity(
      data,
      0, // Monday
      0, // Period 0
      't1',
      'c1',
      's1',
      state
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain('is unavailable');
  });

  it('should enforce subject daily limit (max 2)', () => {
    const data: AppData = {
      ...baseData,
      schedule: {
        'c1': {
          0: {
            0: { subjectId: 's1', teacherId: 't2', classId: 'c1' },
            1: { subjectId: 's1', teacherId: 't2', classId: 'c1' },
          }
        }
      }
    };

    const state = initializeState(data);
    const result = checkSlotValidity(
      data,
      0,
      2,
      't1',
      'c1',
      's1',
      state
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Max 2 periods');
  });

  it('should enforce gap detection (sandwich rule)', () => {
    const data: AppData = {
      ...baseData,
      schedule: {
        'c1': {
          0: {
            0: { subjectId: 's1', teacherId: 't2', classId: 'c1' },
            // Gap at Period 1
            2: { subjectId: 's2', teacherId: 't3', classId: 'c1' },
          }
        }
      }
    };

    const state = initializeState(data);
    const result = checkSlotValidity(
      data,
      0,
      4, // Proposed at P4
      't1',
      'c1',
      's3',
      state
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Gap detected');
  });

  it('should enforce single resource subject constraint', () => {
    const singleSubject = { ...mockSubject, id: 's1_res', name: 'S1 Res', isSingleResource: true };
    const data: AppData = {
      ...baseData,
      subjects: [singleSubject],
      schedule: {
        'other-class': {
          0: {
            0: { subjectId: 's1_res', teacherId: 't2', classId: 'other-class' }
          }
        }
      }
    };

    const state = initializeState(data);
    const result = checkSlotValidity(
      data,
      0,
      0,
      't1',
      'c1',
      's1_res',
      state
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Resource bottleneck');
  });

  it('should enforce teacher fatigue (consecutive periods)', () => {
    // Max consecutive is 4 by default
    const otherClass: Class = { id: 'other-class', name: 'Other', curriculum: [], defaultRoomId: 'r1' };
    const data: AppData = {
      ...baseData,
      classes: [...baseData.classes, otherClass],
      schedule: {
        'other-class': {
          0: {
            0: { subjectId: 's1', teacherId: 't1', classId: 'other-class' },
            1: { subjectId: 's1', teacherId: 't1', classId: 'other-class' },
            3: { subjectId: 's1', teacherId: 't1', classId: 'other-class' },
            4: { subjectId: 's1', teacherId: 't1', classId: 'other-class' }
          }
        }
      }
    };

    const state = initializeState(data);
    const result = checkSlotValidity(
      data,
      0,
      2, // Filling the gap at P2 to make 5 consecutive periods (P0, P1, P2, P3, P4)
      't1',
      'c1',
      's1',
      state
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Exceeds consecutive limit');
  });

  it('should enforce teacher daily load', () => {
    const longDayClass: Class = {
      ...mockClass,
      periodCount: 10, // Class runs for 10 periods
      structure: Array(10).fill({ type: 'CLASS', label: 'C' })
    };
    
    const otherClass: Class = { id: 'other-class', name: 'Other', curriculum: [], defaultRoomId: 'r1' };
    // Set global limit to 6
    const data: AppData = {
      ...baseData,
      settings: {
          ...baseData.settings,
          periodsPerDay: 6 
      },
      classes: [longDayClass, otherClass],
      schedule: {
        'other-class': {
          0: {
            0: { subjectId: 's1', teacherId: 't1', classId: 'other-class' },
            2: { subjectId: 's1', teacherId: 't1', classId: 'other-class' },
            4: { subjectId: 's1', teacherId: 't1', classId: 'other-class' },
            5: { subjectId: 's1', teacherId: 't1', classId: 'other-class' },
            6: { subjectId: 's1', teacherId: 't1', classId: 'other-class' }, // 5th existing
            7: { subjectId: 's1', teacherId: 't1', classId: 'other-class' }  // 6th existing
          }
        }
      }
    };

    const state = initializeState(data);
    const result = checkSlotValidity(
      data,
      0,
      1, // Adding 7th period (Proposed) at P1.
      't1',
      'c1',
      's1',
      state
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain("Exceeds daily limit");
  });

  it('should enforce joint class integrity', () => {
    const data: AppData = {
      ...baseData,
      jointClasses: [
        { id: 'jc1', name: 'Joint Math', subjectId: 's1', classIds: ['c1', 'c2'] }
      ]
    };

    const state = initializeState(data);
    const result = checkSlotValidity(
      data,
      0,
      0,
      't1',
      'c1',
      's1',
      state
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Joint classes must be moved via the Generator');
  });

  it('should enforce room capacity constraint', () => {
    const smallRoom: Room = {
      id: 'r_small',
      name: 'Small Room',
      capacity: 20,
      type: 'Classroom'
    };
    const largeClass: Class = {
      ...mockClass,
      studentCount: 30
    };

    const data: AppData = {
      ...baseData,
      rooms: [smallRoom],
      classes: [largeClass]
    };

    const state = initializeState(data);
    const result = checkSlotValidity(
      data,
      0,
      0,
      't1',
      'c1',
      's1',
      state,
      undefined,
      'r_small'
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain('capacity');
  });

  it('should detect teacher overlap across different class schedules (staggered)', () => {
    const classB: Class = {
      id: 'c2',
      name: '10B',
      curriculum: [],
      duration: 60,
    };

    const data: AppData = {
      ...baseData,
      classes: [...baseData.classes, classB],
      schedule: {
        'c2': {
          0: { // Monday
            0: { // Period 0 for Class B (08:00 - 09:00)
              subjectId: 's2',
              teacherId: 't1',
              classId: 'c2',
            }
          }
        }
      }
    };

    const state = initializeState(data);
    const result = checkSlotValidity(
      data,
      0, // Monday
      1, // Period 1
      't1',
      'c1',
      's1',
      state
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Teacher Busy');
  });
});
