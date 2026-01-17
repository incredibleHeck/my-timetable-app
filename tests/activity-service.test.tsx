import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileProvider, useProfile } from '../src/contexts/ProfileContext';
import * as ProfileStorage from '../src/services/profile/profileStorage';
import { DEFAULT_DATA } from '../src/utils/constants';

vi.mock('../src/services/profile/profileStorage', () => ({
  init: vi.fn(),
  listProfiles: vi.fn(),
  loadProfile: vi.fn(),
  saveProfile: vi.fn(),
  setActiveProfile: vi.fn(),
  getActiveProfileId: vi.fn()
}));

vi.mock('../src/services/profile/migration', () => ({
  migrateFromLocalStorage: vi.fn().mockResolvedValue(false)
}));

const ActivityTester = ({ onContext }: { onContext: (ctx: any) => void }) => {
  const context = useProfile();
  onContext(context);
  return null;
};

describe('Activity Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add activities and limit to 50', async () => {
    const mockProfile = {
      id: 'p1',
      name: 'Test Profile',
      data: { ...DEFAULT_DATA, recentActivity: [] },
      created: Date.now(),
      lastModified: Date.now(),
      meta: {}
    };

    vi.mocked(ProfileStorage.listProfiles).mockResolvedValue([{ id: 'p1', name: 'Test Profile', lastModified: 100 }]);
    vi.mocked(ProfileStorage.getActiveProfileId).mockResolvedValue('p1');
    vi.mocked(ProfileStorage.loadProfile).mockResolvedValue(mockProfile);

    let context: any;
    render(
      <ProfileProvider>
        <ActivityTester onContext={(ctx) => { context = ctx; }} />
      </ProfileProvider>
    );

    await waitFor(() => expect(context?.activeProfile).not.toBeNull());

    await act(async () => {
      context.addActivity('SYSTEM', 'Profile Created');
    });

    expect(context.activeProfile.data.recentActivity).toHaveLength(1);
    expect(context.activeProfile.data.recentActivity[0].message).toBe('Profile Created');
    expect(context.activeProfile.data.recentActivity[0].type).toBe('SYSTEM');

    // Test limit
    for (let i = 0; i < 60; i++) {
      await act(async () => {
        context.addActivity('ACADEMIC', `Activity ${i}`);
      });
    }

    expect(context.activeProfile.data.recentActivity).toHaveLength(50);
    expect(context.activeProfile.data.recentActivity[0].message).toBe('Activity 59');
  });
});
