import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ClassEditorModal } from '../src/features/classes/components/ClassEditorModal';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('ClassEditorModal UI Reorganization', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    editingClass: null,
    data: DEFAULT_DATA,
    onSave: mockOnSave,
  };

  it('does not show timing inputs in Basics tab', () => {
    render(<ClassEditorModal {...defaultProps} />);
    
    // Check Basics tab is active by default
    expect(screen.getByText(/Class Name/i)).toBeDefined();

    // These should NOT be in the Basics tab
    expect(screen.queryByLabelText(/Periods\/Day/i)).toBeNull();
    expect(screen.queryByLabelText(/Duration \(min\)/i)).toBeNull();
    expect(screen.queryByLabelText(/Break \(min\)/i)).toBeNull();
    expect(screen.queryByLabelText(/Lunch \(min\)/i)).toBeNull();
  });

  it('shows timing inputs in Structure tab', () => {
    render(<ClassEditorModal {...defaultProps} />);
    
    // Switch to Structure tab
    const structureTabButton = screen.getByRole('button', { name: /Structure/i });
    fireEvent.click(structureTabButton);

    // These SHOULD be in the Structure tab
    expect(screen.getByText(/Periods\/Day/i)).toBeDefined();
    expect(screen.getByText(/Duration \(min\)/i)).toBeDefined();
    expect(screen.getByText(/Break \(min\)/i)).toBeDefined();
    expect(screen.getByText(/Lunch \(min\)/i)).toBeDefined();
  });

  it('updates reservations grid when Periods/Day is changed in Structure tab', () => {
    render(<ClassEditorModal {...defaultProps} />);
    
    // Switch to Structure tab
    const structureTabButton = screen.getByRole('button', { name: /Structure/i });
    fireEvent.click(structureTabButton);

    // Change Periods/Day to 10
    const periodsInput = screen.getByDisplayValue(DEFAULT_DATA.settings.periodsPerDay.toString());
    fireEvent.change(periodsInput, { target: { value: '10' } });

    // Switch back to Basics tab
    const basicsTabButton = screen.getByRole('button', { name: /Basics/i });
    fireEvent.click(basicsTabButton);

    // Check for 10 period headers (P1 through P10)
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByText(`P${i}`)).toBeDefined();
    }
  });

  it('shows Home Classroom selection in Basics tab', () => {
    const dataWithRooms = {
      ...DEFAULT_DATA,
      rooms: [{ id: 'r1', name: 'Room 101', type: 'Classroom', capacity: 30 }]
    };
    render(<ClassEditorModal {...defaultProps} data={dataWithRooms as any} />);
    
    // Check for labels using queryAll if needed or more specific text
    const labels = screen.getAllByText(/Home Classroom/i);
    expect(labels.length).toBeGreaterThan(0);
    expect(screen.getByText(/Room 101/i)).toBeDefined();
  });
});
