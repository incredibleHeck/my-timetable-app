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
    const move = { id: 'e1', subjectId: 's1', date: '2026-05-01', startTime: '09:00', classIds: ['c1'], roomId: 'r1' } as any;
    const conflicts = validateExamMove(move, [], mockData);
    
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('CAPACITY');
    expect(conflicts[0].severity).toBe('WARNING');
  });

  it('should detect room booking conflicts', () => {
    const existing = [
      { id: 'e1', subjectId: 's1', date: '2026-05-01', startTime: '09:00', classIds: ['c1'], roomId: 'r1' }
    ] as any;

    const move = { id: 'e2', subjectId: 's2', date: '2026-05-01', startTime: '09:00', classIds: ['c2'], roomId: 'r1' } as any;
    const conflicts = validateExamMove(move, existing, mockData);
    
    // Should have ROOM conflict AND CAPACITY warning (since c2 has 25 students and r1 capacity is 20)
    expect(conflicts).toHaveLength(2);
    expect(conflicts.some(c => c.type === 'ROOM')).toBe(true);
  });
});
