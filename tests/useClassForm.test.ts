import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useClassForm } from '../src/features/classes/hooks/useClassForm';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('useClassForm', () => {
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    editingClass: null,
    data: DEFAULT_DATA,
    onSave: mockOnSave,
  };

  it('should initialize with default values when creating a new class', () => {
    const { result } = renderHook(() => useClassForm(defaultProps));
    
    expect(result.current.cName).toBe('');
    expect(result.current.cPeriodCount).toBe(DEFAULT_DATA.settings.periodsPerDay);
    expect(result.current.cDuration).toBe(DEFAULT_DATA.settings.defaultClassDuration || 50);
  });

  it('should resize structure when period count changes', () => {
    const { result } = renderHook(() => useClassForm(defaultProps));
    
    act(() => {
      result.current.handlePeriodCountChange(10);
    });

    expect(result.current.cPeriodCount).toBe(10);
    expect(result.current.cStructure).toHaveLength(10);
  });

  it('should hydrate with editing class data', () => {
    const editingClass = {
      id: 'c1',
      name: '10A',
      periodCount: 6,
      duration: 45,
      curriculum: [],
      defaultRoomId: 'r1'
    };
    
    const { result } = renderHook(() => useClassForm({ ...defaultProps, editingClass: editingClass as any }));
    
    expect(result.current.cName).toBe('10A');
    expect(result.current.cPeriodCount).toBe(6);
    expect(result.current.cDuration).toBe(45);
  });

  it('should call onSave with correct data structure', () => {
    const { result } = renderHook(() => useClassForm(defaultProps));
    
    act(() => {
      result.current.setCName('Test Class');
    });

    act(() => {
      result.current.handleSave();
    });

    expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Test Class',
      structure: expect.any(Array)
    }), null);
  });
});
