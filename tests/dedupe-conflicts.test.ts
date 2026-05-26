import { describe, it, expect } from 'vitest';
import {
  conflictDedupeKey,
  dedupeConflicts,
  collectResourceDoubleBookings,
} from '../src/features/generator/scheduler/validation/final-conflicts';
import { validateFullSchedule } from '../src/features/generator/scheduler/validation';
import { initializeState } from '../src/features/generator/scheduler/core/state';
import { Conflict, AppData, ScheduleResult } from '../src/types';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('dedupeConflicts', () => {
  it('merges duplicate slot violations into one', () => {
    const duplicate: Conflict = {
      classId: 'c1',
      className: 'Class 1A',
      subjectId: 's1',
      subjectName: 'Math',
      teacherId: 't1',
      teacherName: 'Mr Smith',
      day: 0,
      period: 2,
      reason: 'Exceeds daily limit (7/6)',
      severity: 'MEDIUM',
    };

    const merged = dedupeConflicts([duplicate, { ...duplicate }]);
    expect(merged).toHaveLength(1);
  });

  it('merges vfs-style and crdb-style teacher double-book per class (2 not 4)', () => {
    const schedule: ScheduleResult = {
      c1: {
        0: { 0: { subjectId: 's1', teacherId: 't1', classId: 'c1' } },
      },
      c2: {
        0: { 0: { subjectId: 's2', teacherId: 't1', classId: 'c2' } },
      },
    };

    const data: AppData = {
      ...DEFAULT_DATA,
      settings: {
        ...DEFAULT_DATA.settings,
        periodsPerDay: 5,
        dayStructure: Array(5).fill({ type: 'CLASS', label: 'P' }),
      },
      subjects: [
        { id: 's1', name: 'Math', color: 'blue', type: 'CORE' },
        { id: 's2', name: 'Science', color: 'green', type: 'CORE' },
      ],
      teachers: [
        {
          id: 't1',
          name: 'Mr Smith',
          specialtyIds: ['s1', 's2'],
          constraints: Array(5)
            .fill(null)
            .map(() => Array(5).fill(false)),
        },
      ],
      classes: [
        {
          id: 'c1',
          name: 'Class 1A',
          periodCount: 5,
          subjects: [],
          curriculum: [],
          defaultRoomId: 'r1',
        },
        {
          id: 'c2',
          name: 'Class 1B',
          periodCount: 5,
          subjects: [],
          curriculum: [],
          defaultRoomId: 'r2',
        },
      ],
      rooms: [
        { id: 'r1', name: 'Room 1', capacity: 30 },
        { id: 'r2', name: 'Room 2', capacity: 30 },
      ],
      schedule,
    };

    const vfsStyle: Conflict[] = [
      {
        classId: 'c1',
        className: 'Class 1A',
        subjectId: 's1',
        subjectName: 'Math',
        teacherId: 't1',
        teacherName: 'Mr Smith',
        day: 0,
        period: 0,
        reason: 'Teacher Busy in Class 1B',
        severity: 'HIGH',
      },
      {
        classId: 'c2',
        className: 'Class 1B',
        subjectId: 's2',
        subjectName: 'Science',
        teacherId: 't1',
        teacherName: 'Mr Smith',
        day: 0,
        period: 0,
        reason: 'Teacher is busy',
        severity: 'HIGH',
      },
    ];

    const fromResources = collectResourceDoubleBookings(data);
    const raw = [...vfsStyle, ...fromResources];
    const merged = dedupeConflicts(raw);

    const teacherRaw = raw.filter((c) =>
      conflictDedupeKey(c).startsWith('teacher:t1:0:0:'),
    );
    const teacherMerged = merged.filter((c) =>
      conflictDedupeKey(c).startsWith('teacher:t1:0:0:'),
    );

    expect(teacherRaw).toHaveLength(4);
    expect(teacherMerged).toHaveLength(2);
  });

  it('prefers HIGH severity and longer reason when merging', () => {
    const low: Conflict = {
      classId: 'c1',
      className: 'Class 1A',
      teacherId: 't1',
      teacherName: 'Mr Smith',
      day: 0,
      period: 0,
      reason: 'Teacher is busy',
      severity: 'MEDIUM',
    };
    const high: Conflict = {
      ...low,
      reason:
        'Double Booking: Teacher Mr Smith is assigned to multiple classes (c1, c2)',
      severity: 'HIGH',
    };

    const merged = dedupeConflicts([low, high]);
    expect(merged).toHaveLength(1);
    expect(merged[0].severity).toBe('HIGH');
    expect(merged[0].reason).toContain('Double Booking');
  });

  it('uses same dedupe key for Teacher Busy and Double Booking messages', () => {
    const a: Conflict = {
      classId: 'c1',
      className: 'A',
      teacherId: 't1',
      day: 0,
      period: 1,
      reason: 'Teacher Busy in Class 2B',
      severity: 'HIGH',
    };
    const b: Conflict = {
      classId: 'c1',
      className: 'A',
      teacherId: 't1',
      day: 0,
      period: 1,
      reason: 'Double Booking: Teacher X is assigned to multiple classes (c1, c2)',
      severity: 'HIGH',
    };

    expect(conflictDedupeKey(a)).toBe(conflictDedupeKey(b));
  });
});
