import { describe, it, expect, vi, beforeEach } from 'vitest';
import { migrateFromLocalStorage } from '../src/services/profile/migration';
import * as ProfileStorage from '../src/services/profile/profileStorage';
import { STORAGE_KEY } from '../src/utils/constants';

// Mock ProfileStorage
vi.mock('../src/services/profile/profileStorage', () => ({
  init: vi.fn(),
  saveProfile: vi.fn(),
  setActiveProfile: vi.fn()
}));

describe('Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should return false if localStorage is empty', async () => {
    const result = await migrateFromLocalStorage();
    expect(result).toBe(false);
    expect(ProfileStorage.init).not.toHaveBeenCalled();
  });

  it('should migrate data if exists', async () => {
    const legacyProfiles = [
      { id: 'legacy1', name: 'Legacy 1', data: { foo: 'bar' } }
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyProfiles));

    const result = await migrateFromLocalStorage();

    expect(result).toBe(true);
    expect(ProfileStorage.init).toHaveBeenCalled();
    expect(ProfileStorage.saveProfile).toHaveBeenCalledWith(expect.objectContaining({
      id: 'legacy1',
      name: 'Legacy 1',
      meta: expect.objectContaining({ description: 'Migrated from LocalStorage' })
    }));
    
    // Check LS cleanup
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY + '_MIGRATED')).toBeTruthy();
  });
});
