import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DraggableSlot } from '../src/features/generator/components/DraggableSlot';
import React from 'react';

// Mock useDraggable
vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    isDragging: false,
  }),
}));

describe('DraggableSlot Time Labels', () => {
  const mockSlot = { subjectId: 's1', teacherId: 't1', classId: 'c1' };

  it('should render timeRange when in TEACHER mode', () => {
    render(
      <DraggableSlot
        slot={mockSlot}
        day={0}
        period={0}
        mode="TEACHER"
        timeRange="09:00 - 09:50"
      />
    );
    
    expect(screen.getByText('09:00 - 09:50')).toBeInTheDocument();
  });

  it('should not render timeRange when in CLASS mode even if provided', () => {
    render(
      <DraggableSlot
        slot={mockSlot}
        day={0}
        period={0}
        mode="CLASS"
        timeRange="09:00 - 09:50"
      />
    );
    
    expect(screen.queryByText('09:00 - 09:50')).not.toBeInTheDocument();
  });
});
