import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDashboard } from '../src/features/dashboard/hooks/useDashboard';
import { AppData } from '../src/types';

// Mock ProfileContext because useDashboard might indirectly depend on it if it used useProfile
// but here it doesn't seem to. However, useWorkloadStats is used.

describe('useDashboard Metrics', () => {
  const mockData: AppData = {
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
    teachers: [
      { id: 't1', name: 'Teacher 1', constraints: [[],[],[],[],[]] } as any,
      { id: 't2', name: 'Teacher 2', constraints: [[],[],[],[],[]] } as any
    ],
    classes: [
      {
        id: 'c1',
        name: 'Class 1',
        curriculum: [
          { id: 'curr1', subjectId: 's1', periodsPerWeek: 3, assignedTeacherId: 't1' }
        ]
      },
      {
        id: 'c2',
        name: 'Class 2',
        curriculum: [
          { id: 'curr2', subjectId: 's1', periodsPerWeek: 3, assignedTeacherId: 't1' }
        ]
      }
    ] as any,
    jointClasses: [
      { id: 'j1', name: 'Joint S1', subjectId: 's1', classIds: ['c1', 'c2'], teacherId: 't1' }
    ],
    electives: [],
    schedule: {},
    subjects: [{ id: 's1', name: 'Subject 1' } as any],
    rooms: [],
    conflicts: [],
    lastGenerated: null,
  };

  it('should report correct metrics with de-duplicated joint class workload', () => {
    const { result } = renderHook(() => useDashboard(mockData, vi.fn()));
    
    // T1 has 3 periods (de-duplicated). Capacity is 3 periods * 5 days = 15.
    // Utilization = 3 / 15 * 100 = 20%.
    // T2 has 0 periods. Utilization = 0%.
    // Avg Utilization = (20 + 0) / 2 = 10%.
    
    expect(result.current.metrics.avgUtilization).toBe(10);
    expect(result.current.metrics.overloadedCount).toBe(0);
  });

  it('should identify unused teachers correctly', () => {
    const { result } = renderHook(() => useDashboard(mockData, vi.fn()));
    const unusedTeacherIssue = result.current.healthIssues.issues.find(i => i.message.includes('Teacher Teacher 2 is currently unassigned'));
    expect(unusedTeacherIssue).toBeDefined();
  });

  it('should identify overloaded teachers correctly', () => {
    const overloadedData = {
      ...mockData,
      classes: [
        {
          id: 'c1',
          name: 'Class 1',
          curriculum: [
            { id: 'curr1', subjectId: 's1', periodsPerWeek: 20, assignedTeacherId: 't1' }
          ]
        }
      ] as any,
      jointClasses: []
    };
    
    const { result } = renderHook(() => useDashboard(overloadedData as AppData, vi.fn()));
    
    // T1 has 20 periods. Capacity is 15. Utilization > 100%.
    expect(result.current.metrics.overloadedCount).toBe(1);
    
    const overloadedIssue = result.current.healthIssues.issues.find(i => i.message.includes('overloaded'));
    expect(overloadedIssue).toBeDefined();
  });
});
