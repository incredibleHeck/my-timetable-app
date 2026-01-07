import { describe, it, expect } from 'vitest';
import { validateProfile, Profile } from '../src/types/profile';

describe('Profile Schema', () => {
  it('should validate a correct profile', () => {
    const validProfile: any = {
      id: 'p1',
      name: 'Test Profile',
      created: 1234567890,
      lastModified: 1234567890,
      data: { settings: {}, schedule: {} }, // Minimal AppData mock
      meta: { description: 'A test' }
    };
    expect(validateProfile(validProfile)).toBe(true);
  });

  it('should reject missing required fields', () => {
    const invalidProfile = {
      name: 'No ID'
    };
    expect(validateProfile(invalidProfile)).toBe(false);
  });

  it('should reject invalid types', () => {
    const invalidProfile = {
      id: 123, // should be string
      name: 'Test'
    };
    expect(validateProfile(invalidProfile)).toBe(false);
  });
});
