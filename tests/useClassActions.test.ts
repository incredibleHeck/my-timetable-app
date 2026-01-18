import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useClassActions } from '../src/features/classes/hooks/useClassActions';
import { DEFAULT_DATA } from '../src/utils/constants';
import { ClassGroup } from '../src/features/classes/types';

// Mock ProfileContext since it's used inside the hook
vi.mock('../src/contexts/ProfileContext', () => ({
  useProfile: () => ({
    addActivity: vi.fn(),
  }),
}));

describe('useClassActions', () => {
  let mockOnUpdate = vi.fn();

  beforeEach(() => {
    mockOnUpdate = vi.fn();
  });

  it('should create a new class and an associated home room', () => {
    const { result } = renderHook(() => useClassActions(DEFAULT_DATA, mockOnUpdate));
    
    const newClass: ClassGroup = {
      id: 'new-id',
      name: 'Grade 1A',
      curriculum: [],
      defaultRoomId: '', // Should be filled by hook
    };

    act(() => {
      result.current.handleSaveClass(newClass, null);
    });

    // Check onUpdate was called
    expect(mockOnUpdate).toHaveBeenCalled();
    const updatedData = mockOnUpdate.mock.calls[0][0];
    
    // Check Class exists
    expect(updatedData.classes).toHaveLength(1);
    const savedClass = updatedData.classes[0];
    expect(savedClass.name).toBe('Grade 1A');
    
    // Check Room was created
    expect(updatedData.rooms).toHaveLength(1);
    const savedRoom = updatedData.rooms[0];
    expect(savedRoom.name).toBe('Grade 1A Classroom');
    expect(savedRoom.isHomeRoom).toBe(true);
    
    // Check Linkage
    expect(savedClass.defaultRoomId).toBe(savedRoom.id);
  });

  it('should rename the home room when a class is renamed', () => {
    const initialRoom = { id: 'r1', name: 'Old Name Classroom', type: 'Classroom', isHomeRoom: true, capacity: 30 };
    const initialClass = { id: 'c1', name: 'Old Name', defaultRoomId: 'r1', curriculum: [] };
    
    const data = {
      ...DEFAULT_DATA,
      classes: [initialClass],
      rooms: [initialRoom]
    };

    const { result } = renderHook(() => useClassActions(data as any, mockOnUpdate));
    
    const renamedClass = { ...initialClass, name: 'New Name' };

    act(() => {
      result.current.handleSaveClass(renamedClass as any, initialClass as any);
    });

    const updatedData = mockOnUpdate.mock.calls[0][0];
    expect(updatedData.rooms[0].name).toBe('New Name Classroom');
  });

  it('should duplicate a class and create a new unique home room', () => {
    const initialRoom = { id: 'r1', name: 'Grade 1A Classroom', type: 'Classroom', isHomeRoom: true, capacity: 30 };
    const initialClass = { id: 'c1', name: 'Grade 1A', defaultRoomId: 'r1', curriculum: [] };
    
    const data = {
      ...DEFAULT_DATA,
      classes: [initialClass],
      rooms: [initialRoom]
    };

    const { result } = renderHook(() => useClassActions(data as any, mockOnUpdate));

    act(() => {
      result.current.handleDuplicate(initialClass as any);
    });

    const updatedData = mockOnUpdate.mock.calls[0][0];
    expect(updatedData.classes).toHaveLength(2);
    expect(updatedData.rooms).toHaveLength(2);
    
    const copyClass = updatedData.classes.find((c: any) => c.id !== 'c1');
    const copyRoom = updatedData.rooms.find((r: any) => r.id !== 'r1');
    
    expect(copyClass.name).toBe('Grade 1A (Copy)');
    expect(copyRoom.name).toBe('Grade 1A (Copy) Classroom');
    expect(copyClass.defaultRoomId).toBe(copyRoom.id);
    expect(copyClass.defaultRoomId).not.toBe('r1');
  });

  it('should delete the associated home room when a class is deleted', () => {
    const initialRoom = { id: 'r1', name: 'Grade 1A Classroom', type: 'Classroom', isHomeRoom: true, capacity: 30 };
    const initialClass = { id: 'c1', name: 'Grade 1A', defaultRoomId: 'r1', curriculum: [] };
    
    const data = {
      ...DEFAULT_DATA,
      classes: [initialClass],
      rooms: [initialRoom]
    };

    const { result } = renderHook(() => useClassActions(data as any, mockOnUpdate));

    act(() => {
      result.current.confirmDelete(initialClass as any);
    });

    const updatedData = mockOnUpdate.mock.calls[0][0];
    expect(updatedData.classes).toHaveLength(0);
    expect(updatedData.rooms).toHaveLength(0);
  });
});
