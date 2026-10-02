import type { Attendance, Evaluation, Grade, Student } from '../db';

export interface StudentAttendanceSummary {
  totalSessions: number;
  presents: number;
  absents: number;
  lates: number;
  excused: number;
  percentage: number;
}

export function calculateStudentAttendance(
  studentId: number,
  attendanceRecords: Attendance[]
): StudentAttendanceSummary {
  const records = attendanceRecords.filter(a => a.studentId === studentId);
  const total = records.length;
  if (total === 0) {
    return {
      totalSessions: 0,
      presents: 0,
      absents: 0,
      lates: 0,
      excused: 0,
      percentage: 100
    };
  }

  const presents = records.filter(a => a.status === 'present').length;
  const lates = records.filter(a => a.status === 'late').length;
  const excused = records.filter(a => a.status === 'excused').length;
  const absents = records.filter(a => a.status === 'absent').length;

  // En la mayoría de universidades, cada tardanza cuenta como 0.5 o se permite justificación
  // Aquí usamos fórmula estándar: (presentes + excusas + tardanzas * 0.5) / total * 100
  const effectivePresent = presents + excused + (lates * 0.5);
  const percentage = Math.min(100, Math.max(0, Math.round((effectivePresent / total) * 100)));

  return {
    totalSessions: total,
    presents,
    absents,
    lates,
    excused,
    percentage
  };
}

export function calculateStudentAverage(
  studentId: number,
  evaluations: Evaluation[],
  grades: Grade[]
): { average: number | null; completedCount: number } {
  if (evaluations.length === 0) return { average: null, completedCount: 0 };

  const studentGrades = grades.filter(g => g.studentId === studentId);
  if (studentGrades.length === 0) return { average: null, completedCount: 0 };

  let totalScore = 0;
  let count = 0;

  for (const evalItem of evaluations) {
    const grade = studentGrades.find(g => g.evaluationId === evalItem.id);
    if (grade !== undefined && typeof grade.score === 'number' && !isNaN(grade.score)) {
      totalScore += grade.score;
      count++;
    }
  }

  if (count === 0) return { average: null, completedCount: 0 };
  const average = Number((totalScore / count).toFixed(2));
  return { average, completedCount: count };
}

export interface ExcelRowReport {
  'N°': number;
  'Estudiante': string;
  [key: string]: string | number;
  'Total Clases': number;
  'Asistencias': number;
  'Faltas': number;
  '% Asistencia': string;
  'Promedio Final': string | number;
}

export function buildExcelExportData(
  students: Student[],
  evaluations: Evaluation[],
  grades: Grade[],
  attendance: Attendance[]
): ExcelRowReport[] {
  // Ordenar alfabéticamente por apellido/nombre
  const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name));

  return sortedStudents.map((student, index) => {
    const attSummary = calculateStudentAttendance(student.id!, attendance);
    const gradeSummary = calculateStudentAverage(student.id!, evaluations, grades);

    const row: ExcelRowReport = {
      'N°': index + 1,
      'Estudiante': student.name,
      'Total Clases': attSummary.totalSessions,
      'Asistencias': attSummary.presents,
      'Faltas': attSummary.absents,
      '% Asistencia': `${attSummary.percentage}%`,
      'Promedio Final': gradeSummary.average !== null ? gradeSummary.average : 'Sin notas'
    };

    // Encabezados dinámicos especificados por el profesor (ej: "Evaluación 1", "Prueba Final")
    evaluations.forEach(ev => {
      const matchGrade = grades.find(g => g.studentId === student.id && g.evaluationId === ev.id);
      row[ev.name] = matchGrade !== undefined && matchGrade.score !== null ? matchGrade.score : '-';
    });

    return row;
  });
}
