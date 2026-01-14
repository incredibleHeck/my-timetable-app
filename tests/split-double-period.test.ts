import { describe, it, expect } from 'vitest';
import { checkSlotValidity } from '../src/features/generator/scheduler/validation';
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
    // Schedule:
    // P0: Empty
    // P1: Math (t1)
    // BREAK
    // P2: Math (t1) -> This is the split double period (P1 + P2)
    // P3: Empty
    const data: AppData = {
      ...baseData,
      schedule: {
        'c1': {
          0: {
            1: { subjectId: 's1', teacherId: 't1', classId: 'c1' }, // Pre-break
            2: { subjectId: 's1', teacherId: 't1', classId: 'c1' }, // Post-break (index 3 in reality? No, index depends on structure)
          }
        }
      }
    };

    // Indices in splitDayStructure:
    // 0: P1 (CLASS)
    // 1: P2 (CLASS)
    // 2: Recess (BREAK)
    // 3: P3 (CLASS)
    
    // Wait, let's align indices:
    // Index 0: P0 (CLASS)
    // Index 1: P1 (CLASS)
    // Index 2: BREAK
    // Index 3: P2 (CLASS)

    // So if we schedule at Index 1 and Index 3, that's a split double.
    const splitScheduleData: AppData = {
      ...baseData,
      schedule: {
        'c1': {
          0: {
            1: { subjectId: 's1', teacherId: 't1', classId: 'c1' }, // Period 1 (Before Break)
            3: { subjectId: 's1', teacherId: 't1', classId: 'c1' }, // Period 2 (After Break)
          }
        }
      }
    };

    // We want to drag a NEW single period into Index 1.
    // The validator should see that Index 1 is part of a split double with Index 3.
    // It should ideally return isSwap: true and identify it as a Double Period swap, 
    // OR at least acknowledge the connection.
    
    // Currently, checkSlotValidity checks `duration`. 
    // If we pass duration=1 (default for the dragged item), and target is Index 1.
    // It sees a slot at Index 1. 
    // It checks if it's a double by looking at Index 1 + 1 = Index 2.
    // Index 2 is a BREAK. So `getDuration` logic (if inside validation) or `checkSlotValidity` logic
    // likely fails to see the connection to Index 3.

    // Let's test dragging a new subject into Index 1.
    const result = checkSlotValidity(
      splitScheduleData,
      0, // Day 0
      1, // Target Period Index 1
      't1', // Same teacher (or different)
      'c1',
      's1', // Same subject (swapping with itself? or different subject)
      undefined,
      undefined,
      1 // Dragging a single period
    );

    // If logic works for split periods, it should recognize the target is effectively a double period unit
    // and ideally propose a swap that involves both parts.
    
    // HOWEVER, `checkSlotValidity` currently just returns valid/invalid/swap.
    // If it returns `isSwap: true`, that's a start.
    // But the bug is likely that it treats Index 1 as a SINGLE period because Index 2 is BREAK.
    // So if we mock the UI behavior, the UI asks "what is the duration of the slot at Index 1?"
    // If it says "1", then we only swap Index 1. Index 3 is left stranded.
    
    // This test might be better positioned against `getDuration` logic if that was exposed, 
    // but here we are testing `checkSlotValidity` which is used for validation.
    
    // Let's frame the test as: attempting to swap into a split double.
    // If the system thinks it's a single, it will allow a single swap.
    // If the system thinks it's a double, it might block it if we are dragging a single.
    
    // Wait, the Requirement is: "Users can successfully drag and swap a double period that is split... moves both... simultaneously."
    // This implies the SOURCE is the split double.
    
    // So let's test dragging FROM the split double.
    // But `checkSlotValidity` validates the TARGET.
    
    // Let's look at `checkSlotValidity` code again. 
    // It checks `schedule[classId]?.[targetPeriod]`.
    // If occupied, it returns `isSwap: true`.
    // The UI `ScheduleGrid` calls `getDuration` to decide if it's a double.
    
    // So the bug might actually be in `ScheduleGrid.tsx`'s `getDuration` or similar logic 
    // AND `checkSlotValidity` needs to support it.
    
    // Let's verify `checkSlotValidity` handles the split when WE ARE THE SPLIT DOUBLE.
    // i.e., we are dragging a split double (duration 2?) to a new spot.
    
    // If we drag a split double, `duration` passed to `checkSlotValidity` should be 2.
    // The validation logic checks consecutive slots: `targetPeriod` and `targetPeriod + 1`.
    // If target has a break, `checkSlotValidity` currently fails?
    
    // Let's test: Dragging a Double Period (duration 2) into a slot with a break.
    // Target: Index 1 (Class), Index 2 (Break), Index 3 (Class).
    // We try to place a Double Period at Index 1.
    // `checkSlotValidity` loops `i=0` to `duration-1`.
    // i=0: P = 1 + 0 = 1. Valid.
    // i=1: P = 1 + 1 = 2. BREAK.
    // Current logic: `if (structureType !== "CLASS") return { valid: false ... }`
    
    // THIS IS THE BUG REPRODUCTION in Validation.
    // It forbids placing a double period across a break.
    
    const resultDoubleAcrossBreak = checkSlotValidity(
        baseData, // Empty schedule
        0, // Day 0
        1, // Target Period Index 1
        't1',
        'c1',
        's1',
        undefined,
        undefined,
        2 // Duration 2 (Double Period)
    );

    // Now this should PASS because it skips the break at Index 2
    expect(resultDoubleAcrossBreak.valid).toBe(true); 
    expect(resultDoubleAcrossBreak.message).toBe('Available');
  });
});
