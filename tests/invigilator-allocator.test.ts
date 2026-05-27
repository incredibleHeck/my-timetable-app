import { describe, it, expect } from 'vitest';
import { allocateInvigilators } from '../src/features/exams/logic/invigilatorAllocator';
import { DEFAULT_DATA } from '../src/utils/constants';
import { ExamSession } from '../src/types';

describe('allocateInvigilators', () => {
  const teachers = [
    { id: 't1', name: 'Alice', subjects: [], constraints: [[false, false], [false, false], [false, false], [false, false], [false, false]] },
    { id: 't2', name: 'Bob', subjects: [], constraints: [[false, false], [false, false], [false, false], [false, false], [false, false]] },
    { id: 't3', name: 'Carol', subjects: [], constraints: [[false, false], [false, false], [false, false], [false, false], [false, false]] },
  ];

  const baseExams: ExamSession[] = [
    {
      id: 'e1',
      subjectId: 's1',
      classIds: ['c1', 'c2'],
      date: '2026-06-03',
      startTime: '09:00',
      duration: 120,
      paperNumber: 1,
      status: 'DRAFT',
    },
  ];

  const data = {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      timeSlots: [
        { start: '08:00', end: '09:00' },
        { start: '09:00', end: '10:00' },
      ],
    },
    teachers,
    classes: [
      { id: 'c1', name: '10A', level: '10', defaultRoomId: 'r1', curriculum: [] },
      { id: 'c2', name: '10B', level: '10', defaultRoomId: 'r1', curriculum: [] },
    ],
    exams: baseExams,
  };

  it('splits multi-class exams into per-class rows', () => {
    const { exams } = allocateInvigilators(data, {
      minInvigilators: 1,
      maxInvigilators: 1,
    });

    expect(exams).toHaveLength(2);
    expect(exams.every((e) => e.classIds.length === 1)).toBe(true);
    expect(exams.map((e) => e.classIds[0]).sort()).toEqual(['c1', 'c2']);
    expect(exams.map((e) => e.id).sort()).toEqual(['e1__c1', 'e1__c2']);
  });

  it('assigns invigilators to each split row', () => {
    const splitData = {
      ...data,
      classes: [
        { id: 'c1', name: '10A', level: '10', defaultRoomId: 'r1', curriculum: [] },
        { id: 'c2', name: '11A', level: '11', defaultRoomId: 'r1', curriculum: [] },
      ],
      exams: [
        {
          id: 'e1',
          subjectId: 's1',
          classIds: ['c1'],
          date: '2026-06-03',
          startTime: '09:00',
          duration: 120,
          paperNumber: 1,
          status: 'DRAFT' as const,
        },
        {
          id: 'e2',
          subjectId: 's2',
          classIds: ['c2'],
          date: '2026-06-03',
          startTime: '14:00',
          duration: 120,
          paperNumber: 1,
          status: 'DRAFT' as const,
        },
      ],
    };

    const { exams } = allocateInvigilators(splitData, {
      minInvigilators: 2,
      maxInvigilators: 2,
    });

    expect(exams).toHaveLength(2);
    exams.forEach((e) => {
      expect(e.invigilatorIds?.length).toBe(2);
    });
  });

  it('preserves locked exams without splitting', () => {
    const lockedExam: ExamSession = {
      ...baseExams[0],
      id: 'locked1',
      locked: true,
      invigilatorIds: ['t1'],
    };

    const { exams } = allocateInvigilators(
      { ...data, exams: [lockedExam] },
      { minInvigilators: 2, maxInvigilators: 2 }
    );

    expect(exams).toHaveLength(1);
    expect(exams[0].id).toBe('locked1');
    expect(exams[0].classIds).toEqual(['c1', 'c2']);
    expect(exams[0].invigilatorIds).toEqual(['t1']);
  });

  it('excludes teachers from allocation', () => {
    const { exams, warnings } = allocateInvigilators(data, {
      minInvigilators: 1,
      maxInvigilators: 1,
      excludedTeacherIds: ['t1', 't2', 't3'],
    });

    expect(warnings.length).toBeGreaterThan(0);
    exams.forEach((e) => expect(e.invigilatorIds?.length ?? 0).toBe(0));
  });

  it('warns when understaffed', () => {
    const { warnings } = allocateInvigilators(
      { ...data, teachers: [teachers[0]] },
      { minInvigilators: 2, maxInvigilators: 2 }
    );

    expect(warnings.some((w) => w.includes('Under-staffed'))).toBe(true);
  });

  it('does not apply teacher constraints on weekend exam dates', () => {
    const weekendExam: ExamSession = {
      ...baseExams[0],
      id: 'we1',
      classIds: ['c1'],
      date: '2026-06-07',
      startTime: '09:00',
    };

    const blockedTeacher = {
      id: 't9',
      name: 'Blocked',
      subjects: [],
      constraints: [
        [true, true],
        [false, false],
        [false, false],
        [false, false],
        [false, false],
      ],
    };

    const { exams, warnings } = allocateInvigilators(
      {
        ...data,
        teachers: [blockedTeacher, ...teachers],
        exams: [weekendExam],
      },
      { minInvigilators: 1, maxInvigilators: 1 }
    );

    const assigned = exams.find((e) => e.classIds.includes('c1'));
    expect(assigned?.invigilatorIds?.length).toBeGreaterThan(0);
    expect(warnings.filter((w) => w.includes('No invigilators')).length).toBe(0);
  });

  it('scopes stream level restriction to calendar week', () => {
    const week1: ExamSession = {
      id: 'w1',
      subjectId: 's1',
      classIds: ['c1'],
      date: '2026-06-03',
      startTime: '09:00',
      duration: 60,
      paperNumber: 1,
      status: 'DRAFT',
    };
    const week2: ExamSession = {
      id: 'w2',
      subjectId: 's1',
      classIds: ['c1'],
      date: '2026-06-10',
      startTime: '09:00',
      duration: 60,
      paperNumber: 1,
      status: 'DRAFT',
    };

    const { exams: first } = allocateInvigilators(
      { ...data, classes: [{ id: 'c1', name: '10A', level: '10', defaultRoomId: 'r1', curriculum: [] }], exams: [week1] },
      { minInvigilators: 1, maxInvigilators: 1 }
    );
    const t1Week1 = first[0]?.invigilatorIds?.[0];

    const { exams: second } = allocateInvigilators(
      {
        ...data,
        classes: [{ id: 'c1', name: '10A', level: '10', defaultRoomId: 'r1', curriculum: [] }],
        exams: [week1, week2],
      },
      { minInvigilators: 1, maxInvigilators: 1 }
    );

    const week2Row = second.find((e) => e.id === 'w2__c1');
    expect(week2Row?.invigilatorIds?.length).toBe(1);
    expect(week2Row?.invigilatorIds?.[0]).not.toBe(t1Week1);
  });

  it('excludes teachers teaching during exam in class schedule', () => {
    const exam: ExamSession = {
      id: 'ex1',
      subjectId: 's1',
      classIds: ['c1'],
      date: '2026-06-01',
      startTime: '09:00',
      duration: 60,
      paperNumber: 1,
      status: 'DRAFT',
    };

    const scheduleData = {
      ...data,
      classes: [{ id: 'c1', name: '10A', level: '10', defaultRoomId: 'r1', curriculum: [] }],
      exams: [exam],
      schedule: {
        c1: {
          0: {
            1: {
              subjectId: 's2',
              teacherId: 't1',
              classId: 'c1',
            },
          },
        },
      },
    };

    const { exams } = allocateInvigilators(scheduleData, {
      minInvigilators: 1,
      maxInvigilators: 1,
    });

    expect(exams[0]?.invigilatorIds).not.toContain('t1');
    expect(exams[0]?.invigilatorIds?.length).toBe(1);
    expect(['t2', 't3']).toContain(exams[0]?.invigilatorIds?.[0]);
  });
});
