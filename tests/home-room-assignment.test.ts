import { describe, it, expect } from 'vitest';
import { syncHomeRooms } from '../src/features/classes/utils';
import { ClassGroup } from '../src/features/classes/types';
import { Room } from '../src/features/rooms/types';

describe('Home Room Sync Utility', () => {
  const mockRooms: Room[] = [
    { id: 'r1', name: 'Science Lab', type: 'Lab', capacity: 30 },
  ];

  const mockClasses: Partial<ClassGroup>[] = [
    { id: 'c1', name: '10A' },
    { id: 'c2', name: '10B' },
  ];

  it('should create new unique home rooms for each class', () => {
    const { updatedClasses, updatedRooms } = syncHomeRooms(mockClasses as ClassGroup[], mockRooms);
    
    expect(updatedRooms.length).toBe(3); // 1 original + 2 new
    expect(updatedClasses[0].defaultRoomId).toBeDefined();
    expect(updatedClasses[1].defaultRoomId).toBeDefined();
    
    const roomA = updatedRooms.find(r => r.id === updatedClasses[0].defaultRoomId);
    const roomB = updatedRooms.find(r => r.id === updatedClasses[1].defaultRoomId);
    
    expect(roomA?.name).toBe('Home Room 10A');
    expect(roomB?.name).toBe('Home Room 10B');
    expect(roomA?.isHomeRoom).toBe(true);
    expect(roomB?.isHomeRoom).toBe(true);
  });

  it('should update room name if class name changes', () => {
    const existingRooms: Room[] = [
      { id: 'hr1', name: 'Home Room 10A', type: 'Classroom', isHomeRoom: true, capacity: 30 }
    ];
    const renamedClass: Partial<ClassGroup>[] = [
      { id: 'c1', name: '10A-Advanced', defaultRoomId: 'hr1' }
    ];
    
    const { updatedRooms } = syncHomeRooms(renamedClass as ClassGroup[], existingRooms);
    
    expect(updatedRooms[0].name).toBe('Home Room 10A-Advanced');
  });

  it('should not reuse existing non-home rooms', () => {
    const existingRooms: Room[] = [
      { id: 'r1', name: 'Science Lab', type: 'Lab', capacity: 30 }
    ];
    const { updatedClasses, updatedRooms } = syncHomeRooms(mockClasses as ClassGroup[], existingRooms);
    
    expect(updatedRooms.find(r => r.id === updatedClasses[0].defaultRoomId)?.name).not.toBe('Science Lab');
  });
});