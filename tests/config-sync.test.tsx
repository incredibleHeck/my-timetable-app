import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GlobalConfigView } from '../src/features/configuration/GlobalConfigView';
import { DEFAULT_DATA } from '../src/utils/constants';
import { ProfileProvider } from '../src/contexts/ProfileContext';

// Mock the child components that we don't need for this test to reduce noise
vi.mock('../src/features/configuration/components/SchoolIdentitySection', () => ({
  SchoolIdentitySection: () => <div data-testid="school-identity" />
}));
vi.mock('../src/features/configuration/components/TimelineAutomationSection', () => ({
  TimelineAutomationSection: (props: any) => (
    <div data-testid="timeline-automation">
        <button onClick={() => props.handleDurationChange('defaultClassDuration', 60)}>Change Duration</button>
    </div>
  )
}));
vi.mock('../src/features/configuration/components/RulesSection', () => ({
  RulesSection: () => <div data-testid="rules" />
}));
vi.mock('../src/features/configuration/components/ScheduleChainSection', () => ({
  ScheduleChainSection: () => <div data-testid="schedule-chain" />
}));
vi.mock('../src/features/configuration/components/ReservationsGridSection', () => ({
  ReservationsGridSection: () => <div data-testid="reservations-grid" />
}));
vi.mock('../src/features/configuration/components/SlotEditModal', () => ({
  SlotEditModal: () => <div data-testid="slot-edit-modal" />
}));

describe('GlobalConfigView Synchronization', () => {
  it('updates dayStructure when period slider is changed', () => {
    const onUpdate = vi.fn();
    const data = {
      ...DEFAULT_DATA,
      settings: {
        ...DEFAULT_DATA.settings,
        periodsPerDay: 8,
        dayStructure: Array(8).fill({ type: 'CLASS', label: 'P' })
      }
    };

    render(
      <ProfileProvider>
        <GlobalConfigView data={data} onUpdate={onUpdate} />
      </ProfileProvider>
    );

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '10' } });

    // Expect onUpdate to be called with 10 periods AND 10 items in dayStructure
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({
        periodsPerDay: 10,
        dayStructure: expect.arrayContaining([
            expect.objectContaining({ type: 'CLASS' })
        ])
      })
    }));
    
    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
    expect(lastCall.settings.dayStructure.length).toBe(10);
  });

  it('updates timeSlots when timeline automation changes', () => {
    const onUpdate = vi.fn();
    const data = DEFAULT_DATA;

    render(
      <ProfileProvider>
        <GlobalConfigView data={data} onUpdate={onUpdate} />
      </ProfileProvider>
    );

    const automationBtn = screen.getByText(/Change Duration/i);
    fireEvent.click(automationBtn);

    // handleDurationChange in useGlobalConfig recalculates timeline
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({
        defaultClassDuration: 60,
        timeSlots: expect.any(Array)
      })
    }));
  });
});
