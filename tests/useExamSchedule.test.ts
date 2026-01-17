import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useExamSchedule } from '../src/features/exams/hooks/useExamSchedule';
import { DEFAULT_DATA } from '../src/utils/constants';
import { ExamSession } from '../src/types';

// Mock ProfileContext
vi.mock("../src/contexts/ProfileContext", () => ({
  useProfile: () => ({
    pushToHistory: vi.fn(),
  }),
}));

describe('useExamSchedule', () => {
  const mockOnUpdate = vi.fn();
  
  const initialExams: ExamSession[] = [
    {
      id: 'e1',
      subjectId: 's1',
      date: '2026-05-01',
      startTime: '09:00',
      duration: 90,
      classIds: ['c1'],
      roomId: 'r1',
      invigilatorIds: ['t1'],
      paperNumber: 1
    },
    {
      id: 'e2',
      subjectId: 's2',
      date: '2026-05-01',
      startTime: '14:00',
      duration: 90,
      classIds: ['c1'],
      roomId: 'r2',
      invigilatorIds: ['t2'],
      paperNumber: 1
    }
  ];

  const mockData = {
    ...DEFAULT_DATA,
    classes: [{ id: 'c1', name: '10A', level: '10', defaultRoomId: 'r1' }],
    exams: initialExams
  };

  it('should move an exam to a new slot and reset invigilators', () => {
    const { result } = renderHook(() => useExamSchedule(mockData, mockOnUpdate));
    
    act(() => {
      result.current.moveExamToSlot(['e1'], '2026-05-02', '10:00');
    });
    
    const moved = result.current.exams.find(e => e.id === 'e1');
    expect(moved?.date).toBe('2026-05-02');
    expect(moved?.startTime).toBe('10:00');
    expect(moved?.invigilatorIds).toEqual([]); // Should be reset
  });

  it('should swap two exams subjects but keep slot infrastructure', () => {
    const { result } = renderHook(() => useExamSchedule(mockData, mockOnUpdate));
    
    act(() => {
      result.current.swapExams(['e1'], ['e2']);
    });
    
    const exam1 = result.current.exams.find(e => e.id === 'e1');
    const exam2 = result.current.exams.find(e => e.id === 'e2');
    
    // e1 should stay in its original slot/room but have e2's subject
    expect(exam1?.date).toBe('2026-05-01');
    expect(exam1?.startTime).toBe('09:00');
    expect(exam1?.subjectId).toBe('s2');
    
    // e2 should stay in its original slot/room but have e1's subject
    expect(exam2?.date).toBe('2026-05-01');
    expect(exam2?.startTime).toBe('14:00');
    expect(exam2?.subjectId).toBe('s1');
  });
});
