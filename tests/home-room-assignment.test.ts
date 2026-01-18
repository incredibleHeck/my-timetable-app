import { describe, it, expect } from 'vitest';
import { assignDefaultRooms } from '../src/features/classes/utils';
import { ClassGroup } from '../src/features/classes/types';
import { Room } from '../src/features/rooms/types';

describe('Home Room Assignment Utility', () => {
  const mockRooms: Room[] = [
    { id: 'r1', name: 'Room 1', type: 'Classroom', capacity: 30 },
    { id: 'r2', name: 'Room 2', type: 'Classroom', capacity: 30 },
    { id: 'r3', name: 'Room 3', type: 'Classroom', capacity: 30 },
  ];

  const mockClasses: Partial<ClassGroup>[] = [
    { id: 'c1', name: '10A' },
    { id: 'c2', name: '10B' },
  ];

  it('should assign unique rooms to classes that do not have one', () => {
    const result = assignDefaultRooms(mockClasses as ClassGroup[], mockRooms);
    
    expect(result[0].defaultRoomId).toBeDefined();
    expect(result[1].defaultRoomId).toBeDefined();
    expect(result[0].defaultRoomId).not.toBe(result[1].defaultRoomId);
  });

  it('should preserve existing assignments', () => {
    const classesWithOneAssigned: Partial<ClassGroup>[] = [
      { id: 'c1', name: '10A', defaultRoomId: 'r2' },
      { id: 'c2', name: '10B' },
    ];
    
    const result = assignDefaultRooms(classesWithOneAssigned as ClassGroup[], mockRooms);
    
    expect(result[0].defaultRoomId).toBe('r2');
    expect(result[1].defaultRoomId).toBeDefined();
    expect(result[1].defaultRoomId).not.toBe('r2');
  });

  it('should handle more classes than rooms gracefully', () => {
    const manyClasses: Partial<ClassGroup>[] = [
      { id: 'c1', name: '10A' },
      { id: 'c2', name: '10B' },
      { id: 'c3', name: '10C' },
      { id: 'c4', name: '10D' },
    ];
    
    const result = assignDefaultRooms(manyClasses as ClassGroup[], mockRooms);
    expect(result.length).toBe(4);
    // Some might be empty or reused if we run out of rooms, but it shouldn't crash.
  });
});
