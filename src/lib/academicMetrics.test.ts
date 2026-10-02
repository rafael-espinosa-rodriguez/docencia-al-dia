import { describe, it, expect } from 'vitest';
import {
  calculateStudentAttendance,
  calculateStudentAverage,
  buildExcelExportData
} from './academicMetrics';
import type { Attendance, Evaluation, Grade, Student } from '../db';

describe('academicMetrics', () => {
  describe('calculateStudentAttendance', () => {
    it('returns 100% when no records exist yet', () => {
      const result = calculateStudentAttendance(1, []);
      expect(result.percentage).toBe(100);
      expect(result.totalSessions).toBe(0);
    });

    it('calculates 100% when student was present in all classes', () => {
      const records: Attendance[] = [
        { studentId: 1, courseId: 10, date: '2026-09-01', status: 'present' },
        { studentId: 1, courseId: 10, date: '2026-09-02', status: 'present' }
      ];
      const result = calculateStudentAttendance(1, records);
      expect(result.totalSessions).toBe(2);
      expect(result.presents).toBe(2);
      expect(result.absents).toBe(0);
      expect(result.percentage).toBe(100);
    });

    it('handles absences and computes correct percentage', () => {
      const records: Attendance[] = [
        { studentId: 1, courseId: 10, date: '2026-09-01', status: 'present' },
        { studentId: 1, courseId: 10, date: '2026-09-02', status: 'absent' },
        { studentId: 1, courseId: 10, date: '2026-09-03', status: 'present' },
        { studentId: 1, courseId: 10, date: '2026-09-04', status: 'absent' }
      ];
      const result = calculateStudentAttendance(1, records);
      expect(result.totalSessions).toBe(4);
      expect(result.presents).toBe(2);
      expect(result.absents).toBe(2);
      expect(result.percentage).toBe(50);
    });

    it('considers lates with half attendance weight', () => {
      const records: Attendance[] = [
        { studentId: 1, courseId: 10, date: '2026-09-01', status: 'present' },
        { studentId: 1, courseId: 10, date: '2026-09-02', status: 'late' }
      ];
      const result = calculateStudentAttendance(1, records);
      expect(result.percentage).toBe(75); // (1 + 0.5) / 2 = 75%
    });
  });

  describe('calculateStudentAverage', () => {
    const evaluations: Evaluation[] = [
      { id: 101, courseId: 1, name: 'Evaluación 1' },
      { id: 102, courseId: 1, name: 'Prueba Final' }
    ];

    it('returns null if student has no recorded grades', () => {
      const result = calculateStudentAverage(1, evaluations, []);
      expect(result.average).toBeNull();
      expect(result.completedCount).toBe(0);
    });

    it('calculates average correctly with partial grades', () => {
      const grades: Grade[] = [
        { studentId: 1, evaluationId: 101, score: 18 }
      ];
      const result = calculateStudentAverage(1, evaluations, grades);
      expect(result.average).toBe(18);
      expect(result.completedCount).toBe(1);
    });

    it('calculates average with all grades', () => {
      const grades: Grade[] = [
        { studentId: 1, evaluationId: 101, score: 14 },
        { studentId: 1, evaluationId: 102, score: 18 }
      ];
      const result = calculateStudentAverage(1, evaluations, grades);
      expect(result.average).toBe(16);
      expect(result.completedCount).toBe(2);
    });
  });

  describe('buildExcelExportData', () => {
    it('constructs dynamic columns with user provided evaluation names', () => {
      const students: Student[] = [
        { id: 1, name: 'Camila Torres', courseId: 1 },
        { id: 2, name: 'Andrés Mora', courseId: 1 }
      ];

      const evaluations: Evaluation[] = [
        { id: 11, courseId: 1, name: 'Evaluacion 1' },
        { id: 12, courseId: 1, name: 'Prueba Final' }
      ];

      const grades: Grade[] = [
        { studentId: 1, evaluationId: 11, score: 19 },
        { studentId: 1, evaluationId: 12, score: 20 },
        { studentId: 2, evaluationId: 11, score: 15 }
      ];

      const attendance: Attendance[] = [
        { studentId: 1, courseId: 1, date: '2026-09-01', status: 'present' },
        { studentId: 2, courseId: 1, date: '2026-09-01', status: 'absent' }
      ];

      const rows = buildExcelExportData(students, evaluations, grades, attendance);

      expect(rows).toHaveLength(2);
      // Alphabetical order: Andrés Mora first
      expect(rows[0]['Estudiante']).toBe('Andrés Mora');
      expect(rows[0]['Evaluacion 1']).toBe(15);
      expect(rows[0]['Prueba Final']).toBe('-');
      expect(rows[0]['% Asistencia']).toBe('0%');

      expect(rows[1]['Estudiante']).toBe('Camila Torres');
      expect(rows[1]['Evaluacion 1']).toBe(19);
      expect(rows[1]['Prueba Final']).toBe(20);
      expect(rows[1]['% Asistencia']).toBe('100%');
      expect(rows[1]['Promedio Final']).toBe(19.5);
    });
  });
});
