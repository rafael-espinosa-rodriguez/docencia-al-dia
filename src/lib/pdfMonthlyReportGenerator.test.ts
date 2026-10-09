import { describe, it, expect } from 'vitest';
import { computeMonthlyReportData, generateMonthlyConsolidatedPDF } from './pdfMonthlyReportGenerator';
import type { Course, Student, Attendance, Evaluation, Grade } from '../db';

describe('pdfMonthlyReportGenerator', () => {
  const dummyCourse: Course = {
    id: 1,
    name: 'Sistemas Distribuidos',
    modality: 'CD',
    semesterId: 1
  };

  const dummyStudents: Student[] = [
    { id: 1, name: 'Álvarez Vega, Roberto', code: 'EST-001', courseId: 1 },
    { id: 2, name: 'Castro Méndez, Elena', code: 'EST-002', courseId: 1 }
  ];

  const dummyAttendance: Attendance[] = [
    { studentId: 1, courseId: 1, date: '2026-09-05', status: 'present' },
    { studentId: 1, courseId: 1, date: '2026-09-12', status: 'present' },
    { studentId: 2, courseId: 1, date: '2026-09-05', status: 'absent' },
    { studentId: 2, courseId: 1, date: '2026-09-12', status: 'late' },
    { studentId: 1, courseId: 1, date: '2026-10-01', status: 'present' }
  ];

  const dummyEvaluations: Evaluation[] = [
    { id: 1, courseId: 1, name: 'Control 1', weight: 20 },
    { id: 2, courseId: 1, name: 'Prueba Parcial', weight: 30 }
  ];

  const dummyGrades: Grade[] = [
    { studentId: 1, evaluationId: 1, score: 5 },
    { studentId: 1, evaluationId: 2, score: 4 },
    { studentId: 2, evaluationId: 1, score: 2 },
    { studentId: 2, evaluationId: 2, score: 2 }
  ];

  it('computes monthly metrics accurately for target month 2026-09', () => {
    const data = computeMonthlyReportData({
      students: dummyStudents,
      attendance: dummyAttendance,
      evaluations: dummyEvaluations,
      grades: dummyGrades,
      targetMonth: '2026-09'
    });

    expect(data.totalStudents).toBe(2);
    expect(data.monthSessions).toBe(2); // Two dates in 2026-09
    expect(data.rows.length).toBe(2);

    const st1 = data.rows.find(r => r.code === 'EST-001')!;
    expect(st1.monthPresents).toBe(2);
    expect(st1.monthAttendancePct).toBe(100);
    expect(st1.average).toBe(4.5);
    expect(st1.status).toBe('Aprobado');

    const st2 = data.rows.find(r => r.code === 'EST-002')!;
    expect(st2.monthAbsents).toBe(1);
    expect(st2.monthLates).toBe(1);
    expect(st2.status).toBe('Riesgo Asistencia');
  });

  it('generates a jsPDF instance with landscape orientation', () => {
    const doc = generateMonthlyConsolidatedPDF({
      course: dummyCourse,
      students: dummyStudents,
      attendance: dummyAttendance,
      evaluations: dummyEvaluations,
      grades: dummyGrades,
      targetMonth: '2026-09',
      professorName: 'Prof. Test',
      institutionName: 'UNIVERSIDAD DE PRUEBA'
    });

    expect(doc).toBeDefined();
    expect(typeof doc.save).toBe('function');
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight()); // Landscape
  });
});
