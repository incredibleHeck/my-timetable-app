import { describe, it, expect } from 'vitest';
import { checkSlotValidity } from '../src/features/generator/scheduler/validation/index';
import { initializeState } from '../src/features/generator/scheduler/core/state';
import { AppData, Teacher, Class, Subject, PeriodConfig } from '../src/types';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('Split Double Period Swap Logic', () => {
  const mockTeacher: Teacher = {
    id: 't1',
    name: 'John Doe',
    specialtyIds: ['s1'],
    constraints: Array(5).fill(null).map(() => Array(8).fill(false)),
  };

  const mockClass: Class = {
    id: 'c1',
    name: '10A',
    curriculum: [],
    studentCount: 30,
  };

  const mockSubject: Subject = {
    id: 's1',
    name: 'Math',
    color: '#ff0000',
  };

  // Define a day structure with a Break between Period 1 and Period 2
  // Structure: P0 (CLASS), P1 (CLASS), BREAK, P2 (CLASS), P3 (CLASS) ...
  const splitDayStructure: PeriodConfig[] = [
    { type: 'CLASS', label: '1' },
    { type: 'CLASS', label: '2' },
    { type: 'BREAK', label: 'Recess' },
    { type: 'CLASS', label: '3' },
    { type: 'CLASS', label: '4' },
    { type: 'LUNCH', label: 'Lunch' },
    { type: 'CLASS', label: '5' },
    { type: 'CLASS', label: '6' },
  ];

  const baseData: AppData = {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      periodsPerDay: 8,
      dayStructure: splitDayStructure,
    },
    teachers: [mockTeacher],
    classes: [mockClass],
    subjects: [mockSubject],
  };

  it('should identify a split double period as a swap target', () => {
    // Indices in splitDayStructure:
    // 0: P1 (CLASS)
    // 1: P2 (CLASS)
    // 2: Recess (BREAK)
    // 3: P3 (CLASS)
    
    // So if we schedule at Index 1 and Index 3, that's a split double.
    const splitScheduleData: AppData = {
      ...baseData,
      schedule: {
        'c1': {
          0: {
            1: { subjectId: 's1', teacherId: 't1', classId: 'c1', isFixed: false }, // Period 1 (Before Break)
            3: { subjectId: 's1', teacherId: 't1', classId: 'c1', isFixed: true },  // Period 2 (After Break)
          }
        }
      }
    };

    const state = initializeState(splitScheduleData);
    const result = checkSlotValidity(
      splitScheduleData,
      0, // Day 0
      1, // Target Period Index 1
      't1', // Same teacher (or different)
      'c1',
      's1', // Same subject (swapping with itself? or different subject)
      state,
      undefined,
      undefined,
      1 // Dragging a single period
    );

    // If logic works for split periods, it should recognize the target is effectively a double period unit
    // and ideally propose a swap that involves both parts.
    
    expect(result.valid).toBe(true); 
    
    // Let's verify `checkSlotValidity` handles the split when WE ARE THE SPLIT DOUBLE.
    // i.e., we are dragging a split double (duration 2?) to a new spot.
    
    const state2 = initializeState(baseData);
    const resultDoubleAcrossBreak = checkSlotValidity(
        baseData, // Empty schedule
        0, // Day 0
        1, // Target Period Index 1
        't1',
        'c1',
        's1',
        state2,
        undefined,
        undefined,
        2 // Duration 2 (Double Period)
    );

    // Now this should PASS because it skips the break at Index 2
    expect(resultDoubleAcrossBreak.valid).toBe(true); 
    expect(resultDoubleAcrossBreak.message).toBe('Available');
  });
});
