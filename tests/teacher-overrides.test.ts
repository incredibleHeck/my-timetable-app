import { describe, it, expect } from 'vitest';
import { Teacher } from '../src/features/teachers/types';

describe('Teacher Interface', () => {
  it('should allow setting maxPeriodsPerDay on a teacher', () => {
    // This tests the type definition update (in spirit, as this is runtime)
    // and prepares for the logic change.
    const teacher: Teacher = {
      id: 't1',
      name: 'John Doe',
      specialtyIds: [],
      constraints: [],
      maxPeriodsPerDay: 4 // This property does not exist yet
    };

    expect(teacher.maxPeriodsPerDay).toBe(4);
  });
});
