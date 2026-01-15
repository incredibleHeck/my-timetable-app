import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useGlobalConfig } from '../src/features/configuration/hooks/useGlobalConfig';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('useGlobalConfig', () => {
  it('should update maxSubjectPeriodsPerDay', () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useGlobalConfig(DEFAULT_DATA, onUpdate));

    act(() => {
      result.current.updateMaxSubjectPeriods(3);
    });

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({
        maxSubjectPeriodsPerDay: 3
      })
    }));
  });

  it('should update maxTeacherPeriodsPerDay', () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useGlobalConfig(DEFAULT_DATA, onUpdate));

    act(() => {
      result.current.updateMaxTeacherPeriods(8);
    });

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({
        maxTeacherPeriodsPerDay: 8
      })
    }));
  });
});
