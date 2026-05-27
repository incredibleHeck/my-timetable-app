import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useDndLogic } from '../src/features/generator/hooks/useDndLogic';
import { AppData, Teacher, Class, Subject } from '../src/types';
import { DEFAULT_DATA } from '../src/utils/constants';
import { ProfileContext } from '../src/contexts/ProfileContext';
import React from 'react';

// Mock useProfile
const mockPushToHistory = vi.fn();
const mockGetClassSchedule = vi.fn(() => []);

vi.mock('../src/contexts/ProfileContext', () => ({
  useProfile: () => ({
    pushToHistory: mockPushToHistory,
    getClassSchedule: mockGetClassSchedule,
  }),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

describe('Swap Integration - useDndLogic', () => {
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
  };

  const mockSubject: Subject = {
    id: 's1',
    name: 'Math',
    color: '#ff0000',
  };

  const baseData: AppData = {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: 8,
      dayStructure: Array(8).fill({ type: 'CLASS', label: 'C' }),
      maxSubjectPeriodsPerDay: 2,
    },
    teachers: [mockTeacher],
    classes: [mockClass],
    subjects: [mockSubject],
    schedule: {
      'c1': {
        0: { // Monday
           0: { subjectId: 's1', teacherId: 't1', classId: 'c1', isFixed: false },
           1: { subjectId: 's1', teacherId: 't1', classId: 'c1', isFixed: true }
        }
      }
    },
  };

  it('should allow dragging a double period to an empty slot on same day without subject limit conflict', () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useDndLogic(baseData, 'c1', 'CLASS', onUpdate), { wrapper });

    // Start drag of the double period at P0
    act(() => {
      result.current.handleDragStart({
        active: {
          id: 'c1-0-0',
          data: {
            current: {
              day: 0,
              period: 0,
              slot: baseData.schedule['c1'][0][0],
              classGroup: mockClass
            }
          }
        }
      } as any);
    });

    // Check validity of target P3
    // It should call checkSlotValidity with sourceDuration=2 and ignoreSlot={day:0, period:0, duration:2}
    const isValid = result.current.checkDragValidity(0, 3);

    expect(isValid).toBe(true);
  });

  it('should allow shifting a double period into an adjacent empty gap', () => {
    const dataWithGap: AppData = {
      ...baseData,
      schedule: {
        c1: {
          0: {
            2: { subjectId: 's1', teacherId: 't1', classId: 'c1', isFixed: false },
            3: { subjectId: 's1', teacherId: 't1', classId: 'c1', isFixed: true },
          },
        },
      },
    };

    const onUpdate = vi.fn();
    const { result } = renderHook(
      () => useDndLogic(dataWithGap, 'c1', 'CLASS', onUpdate),
      { wrapper },
    );

    act(() => {
      result.current.handleDragStart({
        active: {
          id: 'c1-0-2',
          data: {
            current: {
              day: 0,
              period: 2,
              slot: dataWithGap.schedule.c1[0][2],
              classGroup: mockClass,
            },
          },
        },
      } as any);
    });

    // Shift double from P2-P3 down to P1-P2 (empty gap before the double)
    expect(result.current.checkDragValidity(0, 1)).toBe(true);
  });

  it('should allow dragging a single period to swap with another single period of same teacher on same day (at load limit)', () => {
    const dataAtLimit: AppData = {
        ...baseData,
        settings: { ...baseData.settings, maxTeacherPeriodsPerDay: 2 },
        schedule: {
            'c1': {
                0: {
                    0: { subjectId: 's1', teacherId: 't1', classId: 'c1' },
                    1: { subjectId: 's2', teacherId: 't1', classId: 'c1' }
                }
            }
        },
        subjects: [...baseData.subjects, { id: 's2', name: 'Science' }]
    };

    const onUpdate = vi.fn();
    const { result } = renderHook(() => useDndLogic(dataAtLimit, 'c1', 'CLASS', onUpdate), { wrapper });

    // Drag Math (P0)
    act(() => {
      result.current.handleDragStart({
        active: {
          id: 'c1-0-0',
          data: {
            current: {
              day: 0,
              period: 0,
              slot: dataAtLimit.schedule['c1'][0][0],
              classGroup: mockClass
            }
          }
        }
      } as any);
    });

    // Check target P1 (Science)
    // This is a swap. Should ignore P0 (source) AND P1 (target).
    const isValid = result.current.checkDragValidity(0, 1);

    expect(isValid).toBe(true);
  });
});
