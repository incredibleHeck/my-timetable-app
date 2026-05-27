import { describe, it, expect } from 'vitest';
import { validateExamMove } from '../src/features/exams/logic/examValidation';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('Exam Validation Logic', () => {
  const mockData = {
    ...DEFAULT_DATA,
    classes: [
      { id: 'c1', name: '10A', studentCount: 30, level: '10', defaultRoomId: 'r1' },
      { id: 'c2', name: '10B', studentCount: 25, level: '10' }
    ],
    rooms: [
      { id: 'r1', name: 'Lab 1', capacity: 20 }
    ]
  };

  it('should detect room capacity warnings', () => {
    const move = { id: 'e1', subjectId: 's1', date: '2026-05-01', startTime: '09:00', duration: 90, classIds: ['c1'], roomId: 'r1' } as any;
    const conflicts = validateExamMove(move, [], mockData);
    
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('CAPACITY');
    expect(conflicts[0].severity).toBe('WARNING');
  });

  it('should detect room booking conflicts at identical start times', () => {
    const existing = [
      { id: 'e1', subjectId: 's1', date: '2026-05-01', startTime: '09:00', duration: 90, classIds: ['c1'], roomId: 'r1' }
    ] as any;

    const move = { id: 'e2', subjectId: 's2', date: '2026-05-01', startTime: '09:00', duration: 90, classIds: ['c2'], roomId: 'r1' } as any;
    const conflicts = validateExamMove(move, existing, mockData);
    
    expect(conflicts.some(c => c.type === 'ROOM')).toBe(true);
  });

  it('should detect room conflicts with overlapping intervals (not identical start)', () => {
    const existing = [
      { id: 'e1', subjectId: 's1', date: '2026-05-01', startTime: '09:00', duration: 150, classIds: ['c1'], roomId: 'r1' }
    ] as any;

    const move = { id: 'e2', subjectId: 's2', date: '2026-05-01', startTime: '10:00', duration: 120, classIds: ['c2'], roomId: 'r1' } as any;
    const conflicts = validateExamMove(move, existing, mockData);
    
    expect(conflicts.some(c => c.type === 'ROOM')).toBe(true);
  });

  it('should detect student class conflicts with overlapping times', () => {
    const existing = [
      { id: 'e1', subjectId: 's1', date: '2026-05-01', startTime: '09:00', duration: 150, classIds: ['c1'] }
    ] as any;

    const move = { id: 'e2', subjectId: 's2', date: '2026-05-01', startTime: '10:00', duration: 120, classIds: ['c1'] } as any;
    const conflicts = validateExamMove(move, existing, mockData);
    
    expect(conflicts.some(c => c.type === 'STUDENT')).toBe(true);
    expect(conflicts.find(c => c.type === 'STUDENT')?.severity).toBe('CRITICAL');
  });

  it('should detect staff conflicts with overlapping intervals', () => {
    const existing = [
      { id: 'e1', subjectId: 's1', date: '2026-05-01', startTime: '09:00', duration: 150, classIds: ['c1'], invigilatorIds: ['t1'] }
    ] as any;

    const move = { id: 'e2', subjectId: 's2', date: '2026-05-01', startTime: '10:00', duration: 120, classIds: ['c2'], invigilatorIds: ['t1'] } as any;
    const conflicts = validateExamMove(move, existing, mockData);
    
    expect(conflicts.some(c => c.type === 'STAFF')).toBe(true);
  });

  it('warns when invigilator is teaching during exam', () => {
    const exam = {
      id: 'e1',
      subjectId: 's1',
      date: '2026-06-01',
      startTime: '09:00',
      duration: 60,
      classIds: ['c1'],
      invigilatorIds: ['t1'],
    } as any;

    const dataWithSchedule = {
      ...mockData,
      teachers: [{ id: 't1', name: 'Busy Teacher', subjects: [], constraints: {} }],
      settings: {
        ...mockData.settings,
        timeSlots: [
          { start: '08:00', end: '09:00' },
          { start: '09:00', end: '10:00' },
        ],
      },
      schedule: {
        c1: {
          0: {
            1: { subjectId: 's2', teacherId: 't1', classId: 'c1' },
          },
        },
      },
    };

    const conflicts = validateExamMove(exam, [], dataWithSchedule);
    expect(conflicts.some((c) => c.type === 'STAFF' && c.severity === 'WARNING')).toBe(true);
  });
});
