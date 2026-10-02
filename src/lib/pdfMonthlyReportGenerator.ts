import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Attendance, Course, Evaluation, Grade, Semester, Student } from '../db';
import { calculateStudentAttendance, calculateStudentAverage } from './academicMetrics';

export interface MonthlyReportOptions {
  course: Course;
  semester?: Semester;
  students: Student[];
  attendance: Attendance[];
  evaluations: Evaluation[];
  grades: Grade[];
  targetMonth: string; // Formato 'YYYY-MM', e.g. '2026-09' o 'all'
  professorName?: string;
  institutionName?: string;
}

export interface MonthlyStudentRow {
  index: number;
  code: string;
  name: string;
  monthSessions: number;
  monthPresents: number;
  monthAbsents: number;
  monthLates: number;
  monthAttendancePct: number;
  generalAttendancePct: number;
  evaluationScores: Record<number, number | null>;
  average: number | null;
  status: 'Aprobado' | 'Regular' | 'Riesgo Asistencia' | 'Desaprobado' | 'Sin Datos';
}

export interface MonthlyReportData {
  monthLabel: string;
  monthSessions: number;
  totalStudents: number;
  averageAttendancePct: number;
  approvedCount: number;
  atRiskCount: number;
  rows: MonthlyStudentRow[];
}

export function computeMonthlyReportData({
  students,
  attendance,
  evaluations,
  grades,
  targetMonth
}: {
  students: Student[];
  attendance: Attendance[];
  evaluations: Evaluation[];
  grades: Grade[];
  targetMonth: string;
}): MonthlyReportData {
  const isAll = targetMonth === 'all';

  // Filtrar asistencias según el mes o todas
  const filteredAttendance = isAll
    ? attendance
    : attendance.filter(a => a.date && a.date.startsWith(targetMonth));

  // Fechas únicas de sesión en este período/mes
  const uniqueDatesInPeriod = Array.from(new Set(filteredAttendance.map(a => a.date))).sort();
  const monthSessions = uniqueDatesInPeriod.length;

  // Formato legible del mes
  let monthLabel = 'Consolidado General del Semestre';
  if (!isAll && targetMonth) {
    try {
      const [yearStr, monthStr] = targetMonth.split('-');
      const dateObj = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
      monthLabel = format(dateObj, "MMMM 'de' yyyy", { locale: es });
      // Capitalize first letter
      monthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
    } catch {
      monthLabel = targetMonth;
    }
  }

  // Ordenar estudiantes por nombre
  const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name));

  let totalAttSum = 0;
  let approvedCount = 0;
  let atRiskCount = 0;

  const rows: MonthlyStudentRow[] = sortedStudents.map((st, idx) => {
    // Asistencia específica del mes
    const stMonthAtt = filteredAttendance.filter(a => a.studentId === st.id);
    const monthPresents = stMonthAtt.filter(a => a.status === 'present').length;
    const monthAbsents = stMonthAtt.filter(a => a.status === 'absent').length;
    const monthLates = stMonthAtt.filter(a => a.status === 'late').length;
    const monthExcused = stMonthAtt.filter(a => a.status === 'excused').length;

    const totalMonthRecords = stMonthAtt.length;
    const effectivePresent = monthPresents + monthExcused + (monthLates * 0.5);
    const monthAttendancePct = totalMonthRecords > 0
      ? Math.min(100, Math.max(0, Math.round((effectivePresent / totalMonthRecords) * 100)))
      : (monthSessions === 0 ? 100 : 0);

    // Asistencia global
    const stGlobalAtt = calculateStudentAttendance(st.id!, attendance);

    // Calificaciones
    const gradeSummary = calculateStudentAverage(st.id!, evaluations, grades);
    const evaluationScores: Record<number, number | null> = {};
    evaluations.forEach(ev => {
      const match = grades.find(g => g.studentId === st.id && g.evaluationId === ev.id);
      evaluationScores[ev.id!] = (match !== undefined && match.score !== null) ? match.score : null;
    });

    totalAttSum += monthAttendancePct;

    // Estado institucional
    let status: MonthlyStudentRow['status'] = 'Sin Datos';
    if (gradeSummary.average !== null) {
      const isGradeApproved = gradeSummary.average >= 10.5 || (gradeSummary.average <= 10 && gradeSummary.average >= 5.5);
      if (monthAttendancePct < 75 || stGlobalAtt.percentage < 75) {
        status = 'Riesgo Asistencia';
        atRiskCount++;
      } else if (isGradeApproved) {
        status = 'Aprobado';
        approvedCount++;
      } else {
        status = 'Desaprobado';
        atRiskCount++;
      }
    } else {
      if (monthAttendancePct < 75) {
        status = 'Riesgo Asistencia';
        atRiskCount++;
      } else {
        status = 'Regular';
      }
    }

    return {
      index: idx + 1,
      code: st.code || `EST-${String(st.id).padStart(4, '0')}`,
      name: st.name,
      monthSessions: totalMonthRecords,
      monthPresents,
      monthAbsents,
      monthLates,
      monthAttendancePct,
      generalAttendancePct: stGlobalAtt.percentage,
      evaluationScores,
      average: gradeSummary.average,
      status
    };
  });

  const averageAttendancePct = students.length > 0 ? Math.round(totalAttSum / students.length) : 100;

  return {
    monthLabel,
    monthSessions,
    totalStudents: students.length,
    averageAttendancePct,
    approvedCount,
    atRiskCount,
    rows
  };
}

export function generateMonthlyConsolidatedPDF(options: MonthlyReportOptions): jsPDF {
  const {
    course,
    semester,
    students,
    attendance,
    evaluations,
    grades,
    targetMonth,
    professorName = 'Catedrático Titular',
    institutionName = 'UNIVERSIDAD NACIONAL • CONTROL ACADÉMICO'
  } = options;

  const reportData = computeMonthlyReportData({
    students,
    attendance,
    evaluations,
    grades,
    targetMonth
  });

  // Modo horizontal (landscape) para formato de acta tabular oficial completa
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // --- 1. MEMBRETE INSTITUCIONAL ---
  // Franja decorativa superior institucional
  doc.setFillColor(15, 39, 94); // Azul marino académico #0f275e
  doc.rect(0, 0, pageWidth, 5, 'F');

  doc.setFillColor(180, 142, 60); // Dorado académico #b48e3c
  doc.rect(0, 5, pageWidth, 1.2, 'F');

  // Encabezados oficiales
  doc.setTextColor(15, 39, 94);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(institutionName.toUpperCase(), margin, 14);

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('DIRECCIÓN DE ASUNTOS ACADÉMICOS Y SECRETARÍA DOCENTE', margin, 18);

  // Título del Acta
  doc.setTextColor(15, 31, 75);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('INFORME MENSUAL CONSOLIDADO DE ASISTENCIA Y CALIFICACIONES', margin, 25);

  // Fecha y Folio en esquina superior derecha
  const now = new Date();
  const emissionDateStr = format(now, 'dd/MM/yyyy HH:mm');
  const folioCode = `ACT-${course.modality}-${(course.id || 1).toString().padStart(3, '0')}-${format(now, 'yyyyMM')}`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Folio Oficial: ${folioCode}`, pageWidth - margin, 14, { align: 'right' });
  doc.text(`Expedición: ${emissionDateStr}`, pageWidth - margin, 18, { align: 'right' });
  doc.text(`Página Oficial de Archivo`, pageWidth - margin, 22, { align: 'right' });

  // Línea divisoria
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, 28, pageWidth - margin, 28);

  // --- 2. METADATOS DE LA CÁTEDRA Y PERÍODO ---
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, 31, pageWidth - (margin * 2), 16, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, 31, pageWidth - (margin * 2), 16, 2, 2, 'S');

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  // Columna 1: Asignatura y Modalidad
  doc.setFont('helvetica', 'bold');
  doc.text('Asignatura:', margin + 4, 36);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${course.name} (${course.modality === 'CD' ? 'Curso Diurno' : 'Curso por Encuentro'})`, margin + 25, 36);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Período:', margin + 4, 42);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(semester?.name || '2026-I', margin + 25, 42);

  // Columna 2: Mes Evaluado & Sesiones
  const col2X = margin + 105;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Mes Consultado:', col2X, 36);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 39, 94);
  doc.text(reportData.monthLabel, col2X + 27, 36);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Sesiones del Mes:', col2X, 42);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${reportData.monthSessions} impartidas`, col2X + 27, 42);

  // Columna 3: Indicadores Clave (KPIs)
  const col3X = margin + 185;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Matrícula Activa:', col3X, 36);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${reportData.totalStudents} estudiantes`, col3X + 26, 36);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('% Asist. Global:', col3X, 42);
  doc.setFont('helvetica', 'bold');
  const attColor = reportData.averageAttendancePct >= 80 ? [16, 120, 60] : [180, 40, 40];
  doc.setTextColor(attColor[0], attColor[1], attColor[2]);
  doc.text(`${reportData.averageAttendancePct}%`, col3X + 26, 42);

  // --- 3. TABLA CONSOLIDADA (AUTOTABLE) ---
  const evalHeaders = evaluations.map(ev => ({
    title: ev.name.length > 12 ? ev.name.substring(0, 11) + '.' : ev.name,
    dataKey: `eval_${ev.id}`
  }));

  const tableColumns = [
    { header: 'N°', dataKey: 'index' },
    { header: 'No. Carnet', dataKey: 'code' },
    { header: 'Apellidos y Nombres', dataKey: 'name' },
    { header: 'Ses.', dataKey: 'sessions' },
    { header: 'P', dataKey: 'presents' },
    { header: 'A', dataKey: 'absents' },
    { header: 'T', dataKey: 'lates' },
    { header: '% Mes', dataKey: 'monthAtt' },
    { header: '% Glob.', dataKey: 'globAtt' },
    ...evalHeaders.map(e => ({ header: e.title, dataKey: e.dataKey })),
    { header: 'Promedio', dataKey: 'average' },
    { header: 'Condición', dataKey: 'status' }
  ];

  const tableBody = reportData.rows.map(r => {
    const rowObj: Record<string, string | number> = {
      index: r.index,
      code: r.code,
      name: r.name,
      sessions: r.monthSessions,
      presents: r.monthPresents,
      absents: r.monthAbsents,
      lates: r.monthLates,
      monthAtt: `${r.monthAttendancePct}%`,
      globAtt: `${r.generalAttendancePct}%`,
      average: r.average !== null ? r.average.toFixed(1) : '-',
      status: r.status
    };

    evaluations.forEach(ev => {
      const score = r.evaluationScores[ev.id!];
      rowObj[`eval_${ev.id}`] = score !== null && score !== undefined ? score.toString() : '-';
    });

    return rowObj;
  });

  autoTable(doc, {
    startY: 50,
    margin: { left: margin, right: margin, bottom: 35 },
    columns: tableColumns,
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    headStyles: {
      fillColor: [15, 39, 94], // Navy oficial #0f275e
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 8
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      index: { halign: 'center', cellWidth: 8 },
      code: { halign: 'center', cellWidth: 20 },
      name: { halign: 'left', cellWidth: 55 },
      sessions: { halign: 'center', cellWidth: 10 },
      presents: { halign: 'center', cellWidth: 8 },
      absents: { halign: 'center', cellWidth: 8 },
      lates: { halign: 'center', cellWidth: 8 },
      monthAtt: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
      globAtt: { halign: 'center', cellWidth: 14 },
      average: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
      status: { halign: 'center', cellWidth: 24, fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      // Estilizar estados y porcentajes
      if (data.section === 'body') {
        if (data.column.dataKey === 'status') {
          const val = data.cell.raw as string;
          if (val === 'Aprobado') {
            data.cell.styles.textColor = [16, 120, 60];
          } else if (val === 'Riesgo Asistencia' || val === 'Desaprobado') {
            data.cell.styles.textColor = [190, 30, 30];
          }
        }
        if (data.column.dataKey === 'monthAtt') {
          const rawText = data.cell.raw as string;
          const num = parseInt(rawText, 10);
          if (num < 75) {
            data.cell.styles.textColor = [190, 30, 30];
          }
        }
      }
    }
  });

  // --- 4. BLOQUE DE FIRMAS Y PIE DE PÁGINA INSTITUCIONAL ---
  const totalPages = doc.internal.pages.length - 1;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Firmas en la última página
    if (i === totalPages) {
      const finalY = (doc as any).lastAutoTable?.finalY || 140;
      const signatureY = Math.min(pageHeight - 20, Math.max(finalY + 12, pageHeight - 32));

      // Línea 1: Profesor
      const sig1X = margin + 30;
      doc.setDrawColor(100, 116, 139);
      doc.setLineWidth(0.3);
      doc.line(sig1X, signatureY, sig1X + 70, signatureY);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(professorName, sig1X + 35, signatureY + 4, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Docente / Catedrático Titular', sig1X + 35, signatureY + 8, { align: 'center' });

      // Línea 2: Secretaría Docente
      const sig2X = pageWidth - margin - 100;
      doc.line(sig2X, signatureY, sig2X + 70, signatureY);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Dirección / Secretaría Académica', sig2X + 35, signatureY + 4, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Sello y V°B° Institucional', sig2X + 35, signatureY + 8, { align: 'center' });
    }

    // Pie de página en todas las páginas
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Docencia al Día • Registro y Control Académico Institucional', margin, pageHeight - 6);
    doc.text(
      `Página ${i} de ${totalPages} • Documento oficial generado digitalmente`,
      pageWidth - margin,
      pageHeight - 6,
      { align: 'right' }
    );
  }

  return doc;
}
