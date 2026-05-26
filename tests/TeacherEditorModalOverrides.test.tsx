import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TeacherEditorModal } from '../src/features/teachers/components/TeacherEditorModal';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('TeacherEditorModal Overrides', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    editingTeacher: null,
    data: DEFAULT_DATA,
    onSave: mockOnSave,
  };

  it('renders the Max Periods Per Day field', () => {
    render(<TeacherEditorModal {...defaultProps} />);

    expect(screen.getByLabelText(/Max Periods Per Day/i)).toBeDefined();
  });

  it('allows entering a value for Max Periods Per Day', () => {
    render(<TeacherEditorModal {...defaultProps} />);

    const input = screen.getByLabelText(/Max Periods Per Day/i);
    fireEvent.change(input, { target: { value: '4' } });

    expect((input as HTMLInputElement).value).toBe('4');
  });

  it('passes the maxPeriodsPerDay value to onSave', () => {
    render(<TeacherEditorModal {...defaultProps} />);

    const nameInput = screen.getByLabelText(/Full Name/i);
    fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });

    const input = screen.getByLabelText(/Max Periods Per Day/i);
    fireEvent.change(input, { target: { value: '5' } });

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Jane Doe',
        maxPeriodsPerDay: 5,
      }),
    );
  });

  it('handles empty Max Periods Per Day as undefined', () => {
    render(<TeacherEditorModal {...defaultProps} />);

    const nameInput = screen.getByLabelText(/Full Name/i);
    fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });

    const input = screen.getByLabelText(/Max Periods Per Day/i);
    fireEvent.change(input, { target: { value: '' } });

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Jane Doe',
        maxPeriodsPerDay: undefined,
      }),
    );
  });

  it('passes targetLoad to onSave when set', () => {
    render(<TeacherEditorModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: 'Jane Doe' },
    });
    fireEvent.change(screen.getByLabelText(/Target Load/i), {
      target: { value: '20' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Jane Doe',
        targetLoad: 20,
      }),
    );
  });
});
