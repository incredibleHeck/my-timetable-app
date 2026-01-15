import { describe, it, expect } from 'vitest';
import { mergeWithDefaults } from '../src/utils/utils';
import { AppData } from '../src/types';

describe('mergeWithDefaults', () => {
  it('should populate missing settings with defaults', () => {
    const defaults = {
      settings: {
        maxSubjectPeriodsPerDay: 2,
        maxTeacherPeriodsPerDay: 6,
        otherSetting: 'default'
      }
    } as any as AppData;

    const loaded = {
      settings: {
        otherSetting: 'loaded'
      }
    } as any as AppData;

    const merged = mergeWithDefaults(loaded, defaults);

    expect(merged.settings.maxSubjectPeriodsPerDay).toBe(2);
    expect(merged.settings.maxTeacherPeriodsPerDay).toBe(6);
    expect(merged.settings.otherSetting).toBe('loaded');
  });

  it('should not overwrite existing settings', () => {
    const defaults = {
      settings: {
        maxSubjectPeriodsPerDay: 2,
      }
    } as any as AppData;

    const loaded = {
      settings: {
        maxSubjectPeriodsPerDay: 1,
      }
    } as any as AppData;

    const merged = mergeWithDefaults(loaded, defaults);

    expect(merged.settings.maxSubjectPeriodsPerDay).toBe(1);
  });
});
