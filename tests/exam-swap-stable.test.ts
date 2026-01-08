import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useExamSchedule } from '../src/features/exams/hooks/useExamSchedule';
import { DEFAULT_DATA } from '../src/utils/constants';
import { ExamSession } from '../src/types';

describe('Vertical Swapping Logic', () => {
  const mockOnUpdate = vi.fn();
  
  const initialExams: ExamSession[] = [
    {
      id: 'e1',
      subjectId: 's1',
      date: '2026-05-01',
      startTime: '14:00', // Session 2
      duration: 90,
      classIds: ['c1'],
      roomId: 'r1',
      invigilatorIds: [],
      paperNumber: 1,
      status: 'DRAFT'
    },
    {
      id: 'e2',
      subjectId: 's2',
      date: '2026-05-02',
      startTime: '14:00', // Session 2
      duration: 90,
      classIds: ['c2'],
      roomId: 'r2',
      invigilatorIds: [],
      paperNumber: 1,
      status: 'DRAFT'
    }
  ];

  const mockData = {
    ...DEFAULT_DATA,
    classes: [
      { id: 'c1', name: '10A', level: '10', curriculum: [] },
      { id: 'c2', name: '10B', level: '10', curriculum: [] }
    ],
    exams: initialExams
  };

  it('should successfully swap exams vertically in Session 2', () => {
    const { result } = renderHook(() => useExamSchedule(mockData, mockOnUpdate));
    
    // Swap e1 (May 1, 14:00) with e2 (May 2, 14:00)
    act(() => {
      result.current.swapExams(['e1'], ['e2']);
    });
    
    // After swap:
    // e1 (original May 1) should now have subject s2
    // e2 (original May 2) should now have subject s1
    
    const exam1 = result.current.exams.find(e => e.id === 'e1');
    const exam2 = result.current.exams.find(e => e.id === 'e2');
    
    // e1 stays on May 1 but changes subject
    expect(exam1?.date).toBe('2026-05-01');
    expect(exam1?.subjectId).toBe('s2');
    
    // e2 stays on May 2 but changes subject
    expect(exam2?.date).toBe('2026-05-02');
    expect(exam2?.subjectId).toBe('s1');
  });

  it('should maintain multi-stream consistency during swap', () => {
    // Setup: 10A and 10B both have Math (s1) on May 1, and History (s2) on May 2
    const multiStreamExams: ExamSession[] = [
      { id: '10a-math', subjectId: 's1', date: '2026-05-01', startTime: '09:00', duration: 60, classIds: ['c1'], status: 'DRAFT', paperNumber: 1 },
      { id: '10b-math', subjectId: 's1', date: '2026-05-01', startTime: '09:00', duration: 60, classIds: ['c2'], status: 'DRAFT', paperNumber: 1 },
      { id: '10a-hist', subjectId: 's2', date: '2026-05-02', startTime: '09:00', duration: 60, classIds: ['c1'], status: 'DRAFT', paperNumber: 1 },
      { id: '10b-hist', subjectId: 's2', date: '2026-05-02', startTime: '09:00', duration: 60, classIds: ['c2'], status: 'DRAFT', paperNumber: 1 },
    ];

    const streamData = { ...mockData, exams: multiStreamExams };
    const { result } = renderHook(() => useExamSchedule(streamData, mockOnUpdate));

    // Swap 10A-Math with 10A-Hist
    act(() => {
      result.current.swapExams(['10a-math'], ['10a-hist']);
    });

    // Verify 10A swapped
    expect(result.current.exams.find(e => e.id === '10a-math')?.subjectId).toBe('s2');
    expect(result.current.exams.find(e => e.id === '10a-hist')?.subjectId).toBe('s1');

    // Verify 10B also swapped automatically (Consistency)
    expect(result.current.exams.find(e => e.id === '10b-math')?.subjectId).toBe('s2');
    expect(result.current.exams.find(e => e.id === '10b-hist')?.subjectId).toBe('s1');
  });
});
