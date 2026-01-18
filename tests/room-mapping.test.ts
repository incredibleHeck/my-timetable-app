import { describe, it, expect } from 'vitest';
import { solveSmart } from '../src/features/generator/scheduler/solver';
import { calculatePriority } from '../src/features/generator/scheduler/heuristics';
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

  it('should calculate higher priority for subjects with requiredRoomId', () => {
    const unitICT = {
      subjectId: 's-ict',
      teacherIds: ['t1'],
      duration: 1,
      classIds: ['c1'],
    } as any;

    const unitMath = {
      subjectId: 's-math',
      teacherIds: ['t1'],
      duration: 1,
      classIds: ['c1'],
    } as any;

    const data = {
      subjects: [
        { id: 's-ict', requiredRoomId: 'r1' },
        { id: 's-math', requiredRoomId: null }
      ],
      rooms: [{ id: 'r1', type: 'Lab' }],
      settings: { maxTeacherPeriodsPerDay: 6 }
    } as any;

    const priorityICT = calculatePriority(unitICT, [], data);
    const priorityMath = calculatePriority(unitMath, [], data);

    expect(priorityICT).toBeGreaterThan(priorityMath);
  });

  it('should handle complex end-to-end scenario with competing room requirements', () => {
    // 3 Classes, 2 Rooms
    // r-lab (bottleneck)
    // r-home-a (home for class A)
    // r-home-b (home for class B)
    // r-home-c (home for class C)
    
    const mockRooms: Room[] = [
      { id: 'r-lab', name: 'Computer Lab', type: 'Lab', capacity: 30 },
      { id: 'r-a', name: 'Room A', type: 'Classroom', capacity: 30 },
      { id: 'r-b', name: 'Room B', type: 'Classroom', capacity: 30 },
      { id: 'r-c', name: 'Room C', type: 'Classroom', capacity: 30 },
    ];

    const mockSubjects: Subject[] = [
      { id: 's-ict', name: 'ICT', color: 'blue', requiredRoomId: 'r-lab' },
      { id: 's-sci', name: 'Science', color: 'green', requiredRoomId: 'r-lab' }, // Also wants Lab!
      { id: 's-math', name: 'Math', color: 'red', requiredRoomId: null },
    ];

    const mockClasses: Class[] = [
      { id: 'c-a', name: 'Class A', curriculum: [], defaultRoomId: 'r-a' },
      { id: 'c-b', name: 'Class B', curriculum: [], defaultRoomId: 'r-b' },
      { id: 'c-c', name: 'Class C', curriculum: [], defaultRoomId: 'r-c' },
    ];

    const units = [
      // Class A: ICT (1), Math (1)
      { id: 'u-a-ict', subjectId: 's-ict', duration: 1, classIds: ['c-a'], teacherIds: ['t1'], priority: 8000 },
      { id: 'u-a-math', subjectId: 's-math', duration: 1, classIds: ['c-a'], teacherIds: ['t1'], priority: 0 },
      // Class B: Sci (1), Math (1)
      { id: 'u-b-sci', subjectId: 's-sci', duration: 1, classIds: ['c-b'], teacherIds: ['t2'], priority: 8000 },
      { id: 'u-b-math', subjectId: 's-math', duration: 1, classIds: ['c-b'], teacherIds: ['t2'], priority: 0 },
      // Class C: ICT (1), Math (1)
      { id: 'u-c-ict', subjectId: 's-ict', duration: 1, classIds: ['c-c'], teacherIds: ['t3'], priority: 8000 },
    ];

    const data: AppData = {
      ...DEFAULT_DATA,
      rooms: mockRooms,
      subjects: mockSubjects,
      classes: mockClasses,
      teachers: [
        { id: 't1', name: 'T1', specialtyIds: ['s-ict', 's-math'], constraints: [] },
        { id: 't2', name: 'T2', specialtyIds: ['s-sci', 's-math'], constraints: [] },
        { id: 't3', name: 'T3', specialtyIds: ['s-ict'], constraints: [] },
      ] as any,
    };

    const result = solveSmart(units as any, data);

    expect(result.conflicts.length).toBe(0);

    // Verify Lab assignments
    const labUsage = new Set<string>();
    for(const cId of ['c-a', 'c-b', 'c-c']) {
      for(let d=0; d<5; d++) {
        for(let p=0; p<8; p++) {
          const slot = result.schedule[cId]?.[d]?.[p];
          if(slot && (slot.subjectId === 's-ict' || slot.subjectId === 's-sci')) {
            expect(slot.roomId).toBe('r-lab');
            const key = `D${d}P${p}`;
            expect(labUsage.has(key)).toBe(false); // No overlaps in Lab
            labUsage.add(key);
          }
          if(slot && slot.subjectId === 's-math') {
            expect(slot.roomId).toBe(mockClasses.find(c => c.id === cId)?.defaultRoomId);
          }
        }
      }
    }
    
    expect(labUsage.size).toBe(3); // 2 ICTs + 1 Science = 3 lab slots total
  });

  it('should use class default room when subject has no specific requiredRoomId', () => {
    const mockRoomHome: Room = { id: 'r-home', name: 'Home Room', type: 'Classroom', capacity: 30, isHomeRoom: true };
    const mockClass: Class = { id: 'c1', name: '10A', curriculum: [], defaultRoomId: 'r-home' };
    const mockSubject: Subject = { id: 's1', name: 'General', color: 'blue', requiredRoomId: null };
    
    const units = [{
      id: 'u1',
      subjectId: 's1',
      subjectName: 'General',
      duration: 1,
      classIds: ['c1'],
      classNames: ['10A'],
      teacherIds: ['t1'],
      teacherNames: ['T1'],
      priority: 10,
      defaultRoomId: 'r-home'
    }];

    const data: AppData = {
      ...DEFAULT_DATA,
      rooms: [mockRoomHome],
      classes: [mockClass],
      subjects: [mockSubject],
      teachers: [{ id: 't1', name: 'T1', specialtyIds: ['s1'], constraints: [] } as any]
    };

    const result = solveSmart(units as any, data);
    const slot = result.schedule['c1'][0][0];
    expect(slot.roomId).toBe('r-home');
  });
});
