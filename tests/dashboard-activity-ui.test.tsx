import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecentActivity } from '../src/features/dashboard/components/RecentActivity';
import { useProfile } from '../src/contexts/ProfileContext';
import React from 'react';

// Mock useProfile
vi.mock('../src/contexts/ProfileContext', () => ({
  useProfile: vi.fn(),
}));

describe('RecentActivity UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render activities from profile context', () => {
    const mockRecentActivity = [
      { id: '1', type: 'SYSTEM', message: 'Test System Activity', timestamp: new Date().toISOString() },
      { id: '2', type: 'ACADEMIC', message: 'Test Academic Activity', timestamp: new Date().toISOString() },
      { id: '3', type: 'SCHEDULING', message: 'Test Scheduling Activity', timestamp: new Date().toISOString() },
    ];

    vi.mocked(useProfile).mockReturnValue({
      activeProfile: {
        data: {
          recentActivity: mockRecentActivity
        }
      }
    } as any);

    render(<RecentActivity />);
    
    expect(screen.getByText('Test System Activity')).toBeInTheDocument();
    expect(screen.getByText('Test Academic Activity')).toBeInTheDocument();
    expect(screen.getByText('Test Scheduling Activity')).toBeInTheDocument();
    
    // Check for "Just now" (case-insensitive or exact match)
    const timestamps = screen.getAllByText('Just now');
    expect(timestamps.length).toBe(3);
  });

  it('should render empty state when no activities', () => {
    vi.mocked(useProfile).mockReturnValue({
        activeProfile: {
          data: {
            recentActivity: []
          }
        }
    } as any);

    render(<RecentActivity />);
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });
});
