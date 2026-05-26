import { describe, it, expect } from 'vitest';
import { Teacher } from '../src/features/teachers/types';

describe('Teacher Interface', () => {
  it('defines core teacher fields without per-teacher capacity overrides', () => {
    const teacher: Teacher = {
      id: 't1',
      name: 'John Doe',
      specialtyIds: ['s1'],
      constraints: [],
    };

    expect(teacher.name).toBe('John Doe');
    expect(teacher).not.toHaveProperty('maxPeriodsPerDay');
    expect(teacher).not.toHaveProperty('targetLoad');
  });
});
