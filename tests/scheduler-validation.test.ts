import { describe, it, expect } from 'vitest';
import { checkSlotValidity } from '../src/services/scheduler/validation';
import { AppData, Teacher, Class, Subject, Room } from '../src/types';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('Scheduler Validation', () => {
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
    studentCount: 30,
  };

  const mockSubject: Subject = {
    id: 's1',
    name: 'Math',
    color: '#ff0000',
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
    const data: AppData = {
      ...baseData,
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

    const result = checkSlotValidity(
      data,
      0, // day
      0, // period
      't1', // teacherId
      'c1', // classId
      's1', // subjectId
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Teacher is busy');
  });

  it('should detect room overlap', () => {
    const data: AppData = {
      ...baseData,
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

    const result = checkSlotValidity(
      data,
      0, // day
      0, // period
      't1', // teacherId
      'c1', // classId
      's1', // subjectId
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
        Array(8).fill(null).map((_, p) => d === 0 && p === 0)
      )
    };

    const data: AppData = {
      ...baseData,
      teachers: [restrictedTeacher]
    };

    const result = checkSlotValidity(
      data,
      0, // Monday
      0, // Period 0
      't1',
      'c1',
      's1'
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain('not available');
  });

  it('should enforce subject daily limit (max 2)', () => {
    const data: AppData = {
      ...baseData,
      schedule: {
        'c1': {
          0: {
            0: { subjectId: 's1', teacherId: 't1', classId: 'c1' },
            1: { subjectId: 's1', teacherId: 't1', classId: 'c1' }
          }
        }
      }
    };

    const result = checkSlotValidity(
      data,
      0,
      3, // Period 3 (CLASS)
      't1',
      'c1',
      's1'
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
            0: { subjectId: 's1', teacherId: 't1', classId: 'c1' }
            // Gap at Period 1
          }
        }
      }
    };

    const result = checkSlotValidity(
      data,
      0,
      3, // Period 3 (CLASS), creating a gap at P1 & P2
      't1',
      'c1',
      's1'
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Gap detected');
  });

  it('should enforce single resource subject constraint', () => {
    const singleSubject = { ...mockSubject, isSingleResource: true };
    const data: AppData = {
      ...baseData,
      subjects: [singleSubject],
      schedule: {
        'other-class': {
          0: {
            0: { subjectId: 's1', teacherId: 't2', classId: 'other-class' }
          }
        }
      }
    };

    const result = checkSlotValidity(
      data,
      0,
      0,
      't1',
      'c1',
      's1'
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain('already being taught elsewhere');
  });

  it('should enforce teacher fatigue (consecutive periods)', () => {
    // Max consecutive is 4 by default
    const data: AppData = {
      ...baseData,
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

    const result = checkSlotValidity(
      data,
      0,
      2, // Filling the gap at P2 to make 5 consecutive periods (P0, P1, P2, P3, P4)
      't1',
      'c1',
      's1'
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain('exceed consecutive period limit');
  });

  it('should enforce teacher daily load', () => {
    // Max daily load is 6
    const data: AppData = {
      ...baseData,
      schedule: {
        'other-class': {
          0: {
            0: { subjectId: 's1', teacherId: 't1', classId: 'other-class' },
            2: { subjectId: 's1', teacherId: 't1', classId: 'other-class' },
            4: { subjectId: 's1', teacherId: 't1', classId: 'other-class' },
            6: { subjectId: 's1', teacherId: 't1', classId: 'other-class' },
            8: { subjectId: 's1', teacherId: 't1', classId: 'other-class' },
            9: { subjectId: 's1', teacherId: 't1', classId: 'other-class' }
          }
        }
      }
    };

    const result = checkSlotValidity(
      data,
      0,
      1, // Adding 7th period. P0, P1, P2 will be consecutive (3 < 4)
      't1',
      'c1',
      's1'
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain('exceeds daily limit of 6 classes');
  });

  it('should enforce joint class integrity', () => {
    const data: AppData = {
      ...baseData,
      jointClasses: [
        { id: 'jc1', name: 'Joint Math', subjectId: 's1', classIds: ['c1', 'c2'] }
      ]
    };

    const result = checkSlotValidity(
      data,
      0,
      0,
      't1',
      'c1',
      's1'
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Cannot move Joint Class manually');
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

    const result = checkSlotValidity(
      data,
      0,
      0,
      't1',
      'c1',
      's1',
      undefined,
      'r_small'
    );

    // This is expected to FAIL currently as it's not implemented
    expect(result.valid).toBe(false);
    expect(result.message).toContain('capacity');
  });
});
