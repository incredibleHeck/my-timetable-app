import { describe, it, expect } from 'vitest';
import { generateExams } from '../src/features/exams/logic/examGeneratorAlgorithms';
import { DEFAULT_DATA } from '../src/utils/constants';

describe('generateExams', () => {
  const baseData = {
    ...DEFAULT_DATA,
    settings: {
      ...DEFAULT_DATA.settings,
      timeSlots: [
        { start: '08:00', end: '09:00' },
        { start: '09:00', end: '10:00' },
        { start: '10:00', end: '11:00' },
        { start: '11:00', end: '12:00' },
        { start: '13:00', end: '14:00' },
        { start: '14:00', end: '15:00' },
      ],
    },
    subjects: [
      { id: 'math', name: 'Mathematics', color: '#000', type: 'CORE' as const, isExaminable: true, examPaperCount: 2 },
      { id: 'eng', name: 'English', color: '#111', type: 'CORE' as const, isExaminable: true, examPaperCount: 1 },
    ],
    classes: [
      {
        id: 'c1',
        name: '10A',
        level: '10',
        defaultRoomId: 'r1',
        curriculum: [
          { id: 'cur1', subjectId: 'math', periodsPerWeek: 5, singles: 5, doubles: 0 },
          { id: 'cur2', subjectId: 'eng', periodsPerWeek: 4, singles: 4, doubles: 0 },
        ],
      },
    ],
  };

  it('schedules exams for curriculum subjects', () => {
    const { sessions, unscheduled } = generateExams(baseData, {
      subjects: [
        { id: 'math', papers: 2, duration: 120 },
        { id: 'eng', papers: 1, duration: 90 },
      ],
      mode: 'UNIFORM',
      startDate: '2026-06-01',
      startTime: '09:00',
      maxPerDay: 2,
      gapMinutes: 30,
      syncStreams: true,
    });

    expect(sessions.length).toBeGreaterThan(0);
    expect(unscheduled.length).toBe(0);
    expect(sessions.some((s) => s.subjectId === 'math')).toBe(true);
  });

  it('does not schedule on weekends', () => {
    const { sessions } = generateExams(baseData, {
      subjects: [{ id: 'math', papers: 1, duration: 60 }],
      mode: 'UNIFORM',
      startDate: '2026-06-06',
      startTime: '09:00',
      maxPerDay: 1,
      gapMinutes: 0,
      syncStreams: false,
    });

    sessions.forEach((s) => {
      const day = new Date(s.date + 'T12:00:00').getDay();
      expect(day).not.toBe(0);
      expect(day).not.toBe(6);
    });
  });

  it('reports unscheduled units when calendar is too constrained', () => {
    const { sessions, unscheduled } = generateExams(baseData, {
      subjects: [{ id: 'math', papers: 1, duration: 480 }],
      selectedClassIds: ['c1'],
      mode: 'UNIFORM',
      startDate: '2026-06-01',
      startTime: '09:00',
      maxPerDay: 1,
      gapMinutes: 0,
      syncStreams: false,
    });

    expect(sessions.length).toBe(0);
    expect(unscheduled.length).toBeGreaterThan(0);
    expect(unscheduled[0].subjectId).toBe('math');
  });
});
