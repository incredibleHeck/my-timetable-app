import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ClassEditorModal } from '../src/features/classes/components/ClassEditorModal';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('ClassEditorModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    editingClass: null,
    data: DEFAULT_DATA,
    onSave: mockOnSave,
  };

  it('initializes durations from global defaults when creating new class and saves them', async () => {
    render(<ClassEditorModal {...defaultProps} />);
    
    // Set a name so save is enabled
    const nameInput = screen.getByPlaceholderText(/e\.g\. Grade 10A/i);
    fireEvent.change(nameInput, { target: { value: 'Test Class' } });

    // Click Save
    const saveButton = screen.getByText(/Save Class/i);
    fireEvent.click(saveButton);

    // Verify onSave was called with default durations from DEFAULT_DATA
    // DEFAULT_DATA.settings has defaultBreakDuration: 20, defaultLunchDuration: 60
    expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Test Class',
      breakDuration: 20,
      lunchDuration: 60,
      duration: 50
    }));
  });

  it('hydrates existing durations from editingClass and saves them', async () => {
    const existingClass = {
      id: 'c1',
      name: 'Existing Class',
      curriculum: [],
      breakDuration: 15,
      lunchDuration: 45,
      duration: 40,
      periodCount: 8,
      structure: []
    };

    render(<ClassEditorModal {...defaultProps} editingClass={existingClass as any} />);
    
    // Click Save
    const saveButton = screen.getByText(/Save Class/i);
    fireEvent.click(saveButton);

    expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Existing Class',
      breakDuration: 15,
      lunchDuration: 45,
      duration: 40
    }));
  });
});
