import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ConflictPanel } from '../src/features/generator/components/ConflictPanel';
import { Conflict } from '../src/types';

describe('ConflictPanel', () => {
  const mockConflicts: Conflict[] = [
    {
      classId: 'c1',
      className: 'Class 1A',
      subjectId: 's1',
      subjectName: 'Math',
      teacherId: 't1',
      teacherName: 'John Doe',
      day: 0,
      period: 0,
      duration: 1,
      reason: 'Room capacity exceeded by Class 1A',
      severity: 'HIGH'
    },
    {
      classId: 'c1',
      className: 'Class 1A',
      subjectId: 's2',
      subjectName: 'Science',
      teacherId: 't2',
      teacherName: 'Jane Smith',
      day: 0,
      period: 1,
      duration: 2,
      reason: 'Teacher not available',
      severity: 'HIGH'
    }
  ];

  it('should render conflicts grouped by class', () => {
    render(<ConflictPanel conflicts={mockConflicts} />);
    
    expect(screen.getByText('Class 1A')).toBeInTheDocument();
    expect(screen.getByText('Math')).toBeInTheDocument();
    expect(screen.getByText('Science')).toBeInTheDocument();
  });

  it('should display the correct conflict reason', () => {
    render(<ConflictPanel conflicts={mockConflicts} />);
    
    expect(screen.getByText('Room capacity exceeded by Class 1A')).toBeInTheDocument();
    expect(screen.getByText('Teacher not available')).toBeInTheDocument();
  });

  it('should show the correct teacher name', () => {
    render(<ConflictPanel conflicts={mockConflicts} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should display the correct duration badge', () => {
    render(<ConflictPanel conflicts={mockConflicts} />);
    
    expect(screen.getByText('Single')).toBeInTheDocument();
    expect(screen.getByText('Double')).toBeInTheDocument();
  });

  it('should render nothing if there are no conflicts', () => {
    const { container } = render(<ConflictPanel conflicts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
