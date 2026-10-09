import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { Attendance, Course, Evaluation, Grade, Semester, Student } from '../db';
import { calculateStudentAttendance, calculateStudentAverage } from './academicMetrics';

export function exportCourseDataToExcel({
  semester,
  course,
  students,
  evaluations,
  grades,
  attendance
}: {
  semester?: Semester;
  course: Course;
  students: Student[];
  evaluations: Evaluation[];
  grades: Grade[];
  attendance: Attendance[];
}) {
  const wb = XLSX.utils.book_new();
  const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name));

  const modalityLabel = course.modality === 'CD' ? 'Curso Diurno (CD)' : 'Curso por Encuentro (CPE)';

  // --- HOJA 1: RESUMEN GENERAL & CALIFICACIONES ---
  const summaryRows = sortedStudents.map((student, index) => {
    const attSummary = calculateStudentAttendance(student.id!, attendance);
    const gradeSummary = calculateStudentAverage(student.id!, evaluations, grades);

    const row: Record<string, string | number> = {
      'N°': index + 1,
      'Código': student.code || `EST-${String(student.id).padStart(4, '0')}`,
      'Estudiante': student.name,
      'Modalidad': course.modality
    };

    // Evaluaciones con encabezados personalizados ("Evaluación 1", "Prueba Final", etc.)
    evaluations.forEach(ev => {
      const matchGrade = grades.find(g => g.studentId === student.id && g.evaluationId === ev.id);
      row[ev.name] = matchGrade !== undefined && matchGrade.score !== null ? matchGrade.score : '-';
    });

    row['Promedio'] = gradeSummary.average !== null ? gradeSummary.average : '-';
    row['Clases'] = attSummary.totalSessions;
    row['Asistencias'] = attSummary.presents;
    row['Faltas'] = attSummary.absents;
    row['Tardanzas'] = attSummary.lates;
    row['% Asistencia'] = `${attSummary.percentage}%`;

    // Estado estimado según promedio (escala oficial 2–5, aprueba con 3)
    if (gradeSummary.average !== null) {
      const isApproved = gradeSummary.average >= 3;
      row['Estado'] = isApproved ? 'Aprobado' : 'Desaprobado';
    } else {
      row['Estado'] = 'Pendiente';
    }

    return row;
  });

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);

  // Auto-ajustar anchos de columna para evitar "###"
  const colWidths = [
    { wch: 5 },  // N°
    { wch: 14 }, // Código
    { wch: 32 }, // Estudiante
    { wch: 12 }  // Modalidad (CD / CPE)
  ];
  evaluations.forEach(ev => {
    colWidths.push({ wch: Math.max(14, ev.name.length + 3) });
  });
  colWidths.push(
    { wch: 10 }, // Promedio
    { wch: 8 },  // Clases
    { wch: 12 }, // Asistencias
    { wch: 8 },  // Faltas
    { wch: 10 }, // Tardanzas
    { wch: 14 }, // % Asistencia
    { wch: 14 }  // Estado
  );
  wsSummary['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Calificaciones y Asistencia');

  // --- HOJA 2: REGISTRO DIARIO DE ASISTENCIA ---
  const uniqueDates = Array.from(new Set(attendance.map(a => a.date))).sort();

  if (uniqueDates.length > 0) {
    const dailyRows = sortedStudents.map((student, index) => {
      const row: Record<string, string | number> = {
        'N°': index + 1,
        'Estudiante': student.name
      };

      uniqueDates.forEach(date => {
        const record = attendance.find(a => a.studentId === student.id && a.date === date);
        if (!record) {
          row[date] = '-';
        } else if (record.status === 'present') {
          row[date] = 'P';
        } else if (record.status === 'absent') {
          row[date] = 'A';
        } else if (record.status === 'late') {
          row[date] = 'T';
        } else if (record.status === 'excused') {
          row[date] = 'J';
        }
      });

      return row;
    });

    const wsDaily = XLSX.utils.json_to_sheet(dailyRows);
    const dailyColWidths = [{ wch: 5 }, { wch: 32 }];
    uniqueDates.forEach(() => dailyColWidths.push({ wch: 12 }));
    wsDaily['!cols'] = dailyColWidths;

    XLSX.utils.book_append_sheet(wb, wsDaily, 'Detalle de Sesiones');
  }

  // --- HOJA 3: OBSERVACIONES DE SESIÓN (SI EXISTEN) ---
  const recordsWithNotes = attendance.filter(a => a.note && a.note.trim().length > 0);
  if (recordsWithNotes.length > 0) {
    const noteRows = recordsWithNotes
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(rec => {
        const student = sortedStudents.find(s => s.id === rec.studentId);
        return {
          'Fecha': rec.date,
          'Estudiante': student?.name || `Estudiante #${rec.studentId}`,
          'Código': student?.code || '-',
          'Estado': rec.status === 'present' ? 'Presente' : rec.status === 'absent' ? 'Ausente' : rec.status === 'late' ? 'Tardanza' : 'Justificado',
          'Observación / Nota': rec.note
        };
      });
    const wsNotes = XLSX.utils.json_to_sheet(noteRows);
    wsNotes['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsNotes, 'Observaciones de Sesión');
  }

  // Nombre de archivo con modalidad CD o CPE, asignatura y semestre
  const cleanCourseName = course.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const semesterTag = semester?.name ? `_${semester.name.replace(/[^a-zA-Z0-9_\-]/g, '_')}` : '';
  const dateTag = format(new Date(), 'yyyyMMdd');
  const fileName = `DocenciaAlDia_${course.modality}_${cleanCourseName}${semesterTag}_${dateTag}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
