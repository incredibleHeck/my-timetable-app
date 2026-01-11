import { describe, it, expect } from 'vitest';
import { checkSlotValidity } from '../src/services/scheduler/validation';
import { AppData, Teacher, Class, Subject, Room } from '../src/types';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('Reproduction: Swap Daily Limit Logic', () => {
  const mockTeacher: Teacher = {
    id: 't1',
    name: 'John Doe',
    specialtyIds: ['math', 'eng', 'hist'],
    constraints: Array(5).fill(null).map(() => Array(8).fill(false)),
  };

  const mockClass: Class = {
    id: 'c1',
    name: '10A',
    curriculum: [],
    studentCount: 30,
    periodCount: 6, // 6 periods per day
    structure: Array(6).fill({ type: 'CLASS', label: 'C' }),
  };

  const mockMath: Subject = { id: 'math', name: 'Math', color: 'red' };
  const mockEng: Subject = { id: 'eng', name: 'English', color: 'blue' };

  const baseData: AppData = {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: 6,
      maxConsecutivePeriods: 2, // Strict consecutive limit
      dayStructure: Array(6).fill({ type: 'CLASS', label: 'C' }),
    },
    teachers: [mockTeacher],
    classes: [mockClass],
    subjects: [mockMath, mockEng],
    rooms: [],
  };

  it('should allow swapping without false consecutive chain', () => {
    // Setup: 
    // P0-P1: Math (Double)
    // P2-P3: English (Double)
    // Consecutive Limit: 2.
    // Existing: (P0,P1)=2 OK. (P2,P3)=2 OK.
    const data: AppData = {
      ...baseData,
      schedule: {
        'c1': {
          0: { // Monday
            0: { subjectId: 'math', teacherId: 't1', classId: 'c1', duration: 2 },
            1: { subjectId: 'math', teacherId: 't1', classId: 'c1', duration: 2 }, 
            2: { subjectId: 'eng', teacherId: 't1', classId: 'c1', duration: 2 },
            3: { subjectId: 'eng', teacherId: 't1', classId: 'c1', duration: 2 },
          }
        }
      }
    };

    // Action: Swap Math (P0-P1) to P2 (English).
    // Validate Math move.
    const result = checkSlotValidity(
      data,
      0, // day
      2, // targetPeriod (P2)
      't1', // teacherId
      'c1', // classId
      'math', // subjectId
      { day: 0, period: 0 }, // ignoreSlot (P0)
      undefined,
      2 // duration
    );

    // Expectation:
    // P0 Ignored.
    // P1 Ignored (Old Tail - NOW IGNORED by Fix).
    // P2 Busy (New).
    // P3 Busy (Existing B).
    // Chain: P2-P3 = 2.
    // Limit: 2.
    // Result: Valid.
    expect(result.valid).toBe(true);
  });
});
