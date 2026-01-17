import { describe, it, expect } from 'vitest';
import { solveSmart } from '../src/features/generator/scheduler/solver';
import { AppData, Teacher, Class, Subject, Room } from '../src/types';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('Room Mapping Hierarchy', () => {
  const mockTeacher: Teacher = {
    id: 't1',
    name: 'Teacher 1',
    specialtyIds: ['s1', 's2'],
    constraints: Array(5).fill(null).map(() => Array(8).fill(false)),
  };

  const mockRoomLab: Room = {
    id: 'r-lab',
    name: 'Computer Lab',
    capacity: 30,
    type: 'Lab',
  };

  const mockRoomHome: Room = {
    id: 'r-home',
    name: 'Home Room 101',
    capacity: 30,
    type: 'Classroom',
  };

  const subjectICT: Subject = {
    id: 's-ict',
    name: 'ICT',
    color: '#0000ff',
    requiredRoomId: 'r-lab',
  };

  const subjectMath: Subject = {
    id: 's-math',
    name: 'Math',
    color: '#ff0000',
    requiredRoomId: null,
  };

  const class10A: Class = {
    id: 'c-10a',
    name: '10A',
    curriculum: [],
    defaultRoomId: 'r-home',
  };

  const baseData: AppData = {
    ...DEFAULT_DATA,
    teachers: [mockTeacher],
    classes: [class10A],
    subjects: [subjectICT, subjectMath],
    rooms: [mockRoomLab, mockRoomHome],
  };

  it('should assign specialized subject to its required room (ICT -> Lab)', () => {
    const units = [{
      id: 'u1',
      subjectId: 's-ict',
      subjectName: 'ICT',
      duration: 1,
      classIds: ['c-10a'],
      classNames: ['10A'],
      teacherIds: ['t1'],
      teacherNames: ['Teacher 1'],
      priority: 10,
    }];

    const result = solveSmart(units as any, baseData);
    
    // Check if scheduled in Lab
    const slot = result.schedule['c-10a'][0][0]; // Should be at 0,0
    expect(slot).toBeDefined();
    expect(slot.roomId).toBe('r-lab');
  });

  it('should assign standard subject to class home room (Math -> Home)', () => {
    const units = [{
      id: 'u2',
      subjectId: 's-math',
      subjectName: 'Math',
      duration: 1,
      classIds: ['c-10a'],
      classNames: ['10A'],
      teacherIds: ['t1'],
      teacherNames: ['Teacher 1'],
      priority: 5,
    }];

    const result = solveSmart(units as any, baseData);
    
    // Check if scheduled in Home Room
    const slot = result.schedule['c-10a'][0][0];
    expect(slot).toBeDefined();
    expect(slot.roomId).toBe('r-home');
  });

  it('should fail to schedule in occupied rooms and find next available slot', () => {
    const class10B: Class = {
      id: 'c-10b',
      name: '10B',
      curriculum: [],
      defaultRoomId: 'r-lab', // 10B's home is the Lab!
    };

    const data: AppData = {
      ...baseData,
      teachers: [
        ...baseData.teachers,
        {
          id: 't2',
          name: 'Teacher 2',
          specialtyIds: ['s-math'],
          constraints: Array(5).fill(null).map(() => Array(8).fill(false)),
        }
      ],
      classes: [...baseData.classes, class10B],
    };

    const units = [
      {
        id: 'u-10b-math',
        subjectId: 's-math',
        subjectName: 'Math',
        duration: 1,
        classIds: ['c-10b'],
        classNames: ['10B'],
        teacherIds: ['t2'],
        teacherNames: ['Teacher 2'],
        priority: 100, // Very high priority to ensure it schedules at P0
      },
      {
        id: 'u-10a-ict',
        subjectId: 's-ict',
        subjectName: 'ICT',
        duration: 1,
        classIds: ['c-10a'],
        classNames: ['10A'],
        teacherIds: ['t1'],
        teacherNames: ['Teacher 1'],
        priority: 10,
      }
    ];

    const result = solveSmart(units as any, data);
    
    // Find where they landed
    let ictSlot = -1;
    let mathSlot = -1;
    let ictDay = -1;
    let mathDay = -1;
    for(let d=0; d<5; d++) {
      for(let p=0; p<8; p++) {
        if(result.schedule['c-10a'][d]?.[p]?.subjectId === 's-ict') { ictSlot = p; ictDay = d; }
        if(result.schedule['c-10b'][d]?.[p]?.subjectId === 's-math') { mathSlot = p; mathDay = d; }
      }
    }
    
    expect(mathDay).toBe(0);
    expect(mathSlot).toBe(0);
    expect(ictSlot).not.toBe(-1);
    
    // If on same day, verify no overlap
    if (ictDay === mathDay) {
      expect(ictSlot).not.toBe(mathSlot);
    }
  });

  it('should respect room occupancy for double periods', () => {
    const class10B: Class = {
      id: 'c-10b',
      name: '10B',
      curriculum: [],
      defaultRoomId: 'r-lab',
    };

    const data: AppData = {
      ...baseData,
      teachers: [
        ...baseData.teachers,
        {
          id: 't2',
          name: 'Teacher 2',
          specialtyIds: ['s-math'],
          constraints: Array(5).fill(null).map(() => Array(8).fill(false)),
        }
      ],
      classes: [...baseData.classes, class10B],
    };

    const units = [
      {
        id: 'u-10b-double',
        subjectId: 's-math',
        subjectName: 'Math',
        duration: 2,
        classIds: ['c-10b'],
        classNames: ['10B'],
        teacherIds: ['t2'],
        teacherNames: ['Teacher 2'],
        priority: 100,
      },
      {
        id: 'u-10a-ict',
        subjectId: 's-ict',
        subjectName: 'ICT',
        duration: 1,
        classIds: ['c-10a'],
        classNames: ['10A'],
        teacherIds: ['t1'],
        teacherNames: ['Teacher 1'],
        priority: 10,
      }
    ];

    const result = solveSmart(units as any, data);

    // 10B Math Double should take r-lab at D0 P0 and P1
    // 10A ICT should NOT be at P0 or P1
    
    let ictSlot = -1;
    let ictDay = -1;
    let mathSlot = -1;
    let mathDay = -1;
    for(let d=0; d<5; d++) {
      for(let p=0; p<8; p++) {
        if(result.schedule['c-10a'][d]?.[p]?.subjectId === 's-ict') { ictSlot = p; ictDay = d; }
        if(result.schedule['c-10b'][d]?.[p]?.subjectId === 's-math') { mathSlot = p; mathDay = d; }
      }
    }

    if (ictDay === mathDay && mathDay === 0) {
      // 10B Math is at P0, so it also occupies P1
      expect(ictSlot).not.toBe(0);
      expect(ictSlot).not.toBe(1);
    }
  });
});
