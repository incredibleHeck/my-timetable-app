import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExamGrid } from '../src/features/exams/components/ExamGrid';
import { DEFAULT_DATA } from '../src/utils/constants';

// Mock dnd-kit hooks to track calls
vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual('@dnd-kit/core') as any;
  return {
    ...actual,
    useDraggable: vi.fn((props) => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      isDragging: false,
    })),
    useDroppable: vi.fn((props) => ({
      setNodeRef: vi.fn(),
      isOver: false,
    })),
  };
});

import { useDraggable, useDroppable } from '@dnd-kit/core';

describe('ExamGrid DND Integration', () => {
  const mockExams = [
    {
      id: 'e1',
      subjectId: 's1',
      date: '2026-05-01',
      startTime: '09:00',
      duration: 90,
      classIds: ['c1'],
      roomId: 'r1',
      invigilatorIds: [],
      paperNumber: 1
    }
  ];

  const mockData = {
    ...DEFAULT_DATA,
    subjects: [{ id: 's1', name: 'Mathematics', color: '#ff0000' }],
    classes: [{ id: 'c1', name: '10A', defaultRoomId: 'r1' }],
    rooms: [{ id: 'r1', name: 'Hall 1' }]
  };

  const defaultProps = {
    data: mockData,
    exams: mockExams,
    onEdit: vi.fn(),
    checkConflicts: vi.fn(() => []),
    onSwap: vi.fn(),
    onMoveToSlot: vi.fn(),
    isEditMode: true
  };

  it('should initialize draggable components for exams in edit mode', () => {
    render(<ExamGrid {...defaultProps} />);
    
    // Mathematics should be visible
    expect(screen.getByText('Mathematics')).toBeInTheDocument();
    
    // useDraggable should be called with exam ID
    expect(useDraggable).toHaveBeenCalledWith(expect.objectContaining({
      id: 'e1'
    }));
  });

  it('should initialize droppable components for grid cells', () => {
    render(<ExamGrid {...defaultProps} />);
    
    // Should have droppable cells for the date
    expect(useDroppable).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringContaining('cell-2026-05-01')
    }));
  });

  it('should initialize swapping targets for existing exam cards', () => {
    render(<ExamGrid {...defaultProps} />);
    
    // Each exam card should also be a drop target for swapping
    expect(useDroppable).toHaveBeenCalledWith(expect.objectContaining({
      id: 'target-e1'
    }));
  });
});
