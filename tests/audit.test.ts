import { describe, it, expect } from 'vitest';
import { runConflictAudit } from '../src/features/generator/scheduler/validation/audit';
import { initializeState } from '../src/features/generator/scheduler/core/state';
import { AppData } from '../src/types';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('Conflict Audit', () => {
  const mockData: AppData = {
    ...DEFAULT_DATA,
    classes: [
      {
        id: 'c1',
        name: 'Class 1',
        curriculum: [
          { subjectId: 's1', singles: 2, doubles: 0, assignedTeacherId: 't1' }
        ],
        periodCount: 8,
      }
    ],
    teachers: [{ id: 't1', name: 'Teacher 1', constraints: [] }],
    subjects: [{ id: 's1', name: 'Math' }],
    schedule: {
      'c1': {
        0: {
          0: { subjectId: 's1', teacherId: 't1', classId: 'c1', isFixed: false, duration: 1 }
        }
      }
    }
  };

  it('should identify curriculum gaps when periods are missing', () => {
    const state = initializeState(mockData);
    // mockData requires 2 periods of s1, but schedule only has 1.
    const audit = runConflictAudit(mockData, state);

    expect(audit.curriculumGaps).toHaveLength(1);
    expect(audit.curriculumGaps[0].missing).toBe(1);
    expect(audit.curriculumGaps[0].classId).toBe('c1');
  });

  it('should report zero gaps when curriculum is fully satisfied', () => {
    const fullData: AppData = {
      ...mockData,
      schedule: {
        'c1': {
          0: {
            0: { subjectId: 's1', teacherId: 't1', classId: 'c1', isFixed: false, duration: 1 },
            1: { subjectId: 's1', teacherId: 't1', classId: 'c1', isFixed: false, duration: 1 }
          }
        }
      }
    };
    const state = initializeState(fullData);
    const audit = runConflictAudit(fullData, state);

    expect(audit.curriculumGaps).toHaveLength(0);
  });

  it('should calculate utilization statistics correctly', () => {
    const state = initializeState(mockData);
    const audit = runConflictAudit(mockData, state);

    expect(audit.statistics.totalLessonsPlaced).toBe(1);
    expect(audit.statistics.teacherUtilization['t1']).toBe(1);
  });
});
