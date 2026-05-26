import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TeacherEditorModal } from '../src/features/teachers/components/TeacherEditorModal';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('TeacherEditorModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    editingTeacher: null,
    data: DEFAULT_DATA,
    onSave: mockOnSave,
  };

  it('does not render per-teacher capacity fields', () => {
    render(<TeacherEditorModal {...defaultProps} />);

    expect(screen.queryByLabelText(/Max Periods Per Day/i)).toBeNull();
    expect(screen.queryByLabelText(/Target Load/i)).toBeNull();
  });

  it('passes teacher core fields to onSave', () => {
    render(<TeacherEditorModal {...defaultProps} />);

    const nameInput = screen.getByLabelText(/Full Name/i);
    fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Jane Doe',
        specialtyIds: [],
        constraints: expect.any(Array),
      }),
    );
    const saved = mockOnSave.mock.calls[0][0];
    expect(saved).not.toHaveProperty('maxPeriodsPerDay');
    expect(saved).not.toHaveProperty('targetLoad');
  });
});
