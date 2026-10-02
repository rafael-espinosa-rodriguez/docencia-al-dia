import { describe, it, expect } from 'vitest';
import { computeAttendanceTrend } from './attendanceTrend';
import type { Attendance } from '../db';

describe('attendanceTrend', () => {
  it('returns empty metrics when no records exist', () => {
    const metrics = computeAttendanceTrend([]);
    expect(metrics.totalSessions).toBe(0);
    expect(metrics.trendData).toHaveLength(0);
    expect(metrics.averageRate).toBe(0);
    expect(metrics.bestSession).toBeNull();
  });

  it('computes chronological attendance rates across sessions', () => {
    const records: Attendance[] = [
      // Sesión 1: 2026-09-01 (100% de asistencia)
      { studentId: 1, courseId: 1, date: '2026-09-01', status: 'present' },
      { studentId: 2, courseId: 1, date: '2026-09-01', status: 'present' },
      // Sesión 2: 2026-09-05 (50% de asistencia)
      { studentId: 1, courseId: 1, date: '2026-09-05', status: 'present' },
      { studentId: 2, courseId: 1, date: '2026-09-05', status: 'absent' },
      // Sesión 3: 2026-09-08 (75% con tardanza)
      { studentId: 1, courseId: 1, date: '2026-09-08', status: 'present' },
      { studentId: 2, courseId: 1, date: '2026-09-08', status: 'late' }
    ];

    const metrics = computeAttendanceTrend(records);

    expect(metrics.totalSessions).toBe(3);
    expect(metrics.trendData[0].date).toBe('2026-09-01');
    expect(metrics.trendData[0].attendanceRate).toBe(100);

    expect(metrics.trendData[1].date).toBe('2026-09-05');
    expect(metrics.trendData[1].attendanceRate).toBe(50);

    expect(metrics.trendData[2].date).toBe('2026-09-08');
    expect(metrics.trendData[2].attendanceRate).toBe(75);

    // Promedio: (100 + 50 + 75) / 3 = 75%
    expect(metrics.averageRate).toBe(75);
    expect(metrics.bestSession?.date).toBe('2026-09-01');
    expect(metrics.lowestSession?.date).toBe('2026-09-05');
  });
});
