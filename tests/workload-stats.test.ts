import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWorkloadStats } from '../src/features/workload/hooks/useWorkloadStats';
import { AppData } from '../src/types';

describe('useWorkloadStats', () => {
  const mockData: Partial<AppData> = {
    settings: {
      periodsPerDay: 8,
      dayStructure: [
        { type: 'CLASS', label: '1' },
        { type: 'CLASS', label: '2' },
        { type: 'BREAK', label: 'B' },
        { type: 'CLASS', label: '3' },
      ],
      fixedOccasions: [],
      timeSlots: [],
      maxConsecutivePeriods: 4,
    } as any,
    teachers: [{ id: 't1', name: 'Teacher 1', constraints: [[],[],[],[],[]] } as any],
    classes: [
      {
        id: 'c1',
        name: 'Class 1',
        curriculum: [
          { id: 'curr1', subjectId: 's1', periodsPerWeek: 2, assignedTeacherId: 't1' }
        ],
        defaultRoomId: 'r1'
      },
      {
        id: 'c2',
        name: 'Class 2',
        curriculum: [
          { id: 'curr2', subjectId: 's1', periodsPerWeek: 2, assignedTeacherId: 't1' }
        ],
        defaultRoomId: 'r1'
      }
    ] as any,
    jointClasses: [
      { id: 'j1', name: 'Joint S1', subjectId: 's1', classIds: ['c1', 'c2'], teacherId: 't1' }
    ],
    electives: [],
    schedule: {
      'c1': { 0: { 0: { subjectId: 's1', teacherId: 't1', isFixed: false } } },
      'c2': { 0: { 0: { subjectId: 's1', teacherId: 't1', isFixed: false } } },
    },
    subjects: [],
    rooms: [],
    conflicts: [],
    lastGenerated: null,
  };

  it('should de-duplicate requested workload for joint classes', () => {
    const { result } = renderHook(() => useWorkloadStats(mockData as AppData));
    const stat = result.current.workloadStats.find(s => s.t.id === 't1');
    
    // Joint class 's1' for c1 and c2 should count as 2 periods total, not 4
    expect(stat?.assignedPeriods).toBe(2);
  });

  it('should de-duplicate scheduled workload for concurrent sessions', () => {
    const { result } = renderHook(() => useWorkloadStats(mockData as AppData));
    const stat = result.current.workloadStats.find(s => s.t.id === 't1');
    
    // Teacher t1 is in c1 and c2 at Day 0, Period 0. Should count as 1 scheduled period.
    expect(stat?.scheduledPeriods).toBe(1);
  });
});
