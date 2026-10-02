import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  X, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  Check
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Attendance, Course, Evaluation, Grade, Semester, Student } from '../db';
import { 
  computeMonthlyReportData, 
  generateMonthlyConsolidatedPDF 
} from '../lib/pdfMonthlyReportGenerator';
import { safeVibrate } from '../lib/utils';

interface MonthlyReportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  semester?: Semester;
  students: Student[];
  attendanceRecords: Attendance[];
  evaluations: Evaluation[];
  grades: Grade[];
  onNotice?: (msg: string) => void;
}

export const MonthlyReportPdfModal: React.FC<MonthlyReportPdfModalProps> = ({
  isOpen,
  onClose,
  course,
  semester,
  students,
  attendanceRecords,
  evaluations,
  grades,
  onNotice
}) => {
  // Extraer meses disponibles a partir de los registros de asistencia
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    attendanceRecords.forEach(a => {
      if (a.date && a.date.length >= 7) {
        monthsSet.add(a.date.substring(0, 7)); // 'YYYY-MM'
      }
    });

    // Si no hay meses o faltan, agregamos el mes actual
    const currentMonthKey = format(new Date(), 'yyyy-MM');
    monthsSet.add(currentMonthKey);

    const sorted = Array.from(monthsSet).sort().reverse();
    return sorted.map(m => {
      try {
        const [y, mon] = m.split('-');
        const dateObj = new Date(parseInt(y, 10), parseInt(mon, 10) - 1, 1);
        const label = format(dateObj, "MMMM yyyy", { locale: es });
        return {
          key: m,
          label: label.charAt(0).toUpperCase() + label.slice(1)
        };
      } catch {
        return { key: m, label: m };
      }
    });
  }, [attendanceRecords]);

  const [selectedMonth, setSelectedMonth] = useState<string>(
    availableMonths[0]?.key || format(new Date(), 'yyyy-MM')
  );
  const [professorName, setProfessorName] = useState('Prof. Catedrático Titular');
  const [institutionName, setInstitutionName] = useState('UNIVERSIDAD NACIONAL • CONTROL ACADÉMICO');
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Calcular datos calculados para vista previa interactiva
  const reportData = useMemo(() => {
    return computeMonthlyReportData({
      students,
      attendance: attendanceRecords,
      evaluations,
      grades,
      targetMonth: selectedMonth
    });
  }, [students, attendanceRecords, evaluations, grades, selectedMonth]);

  if (!isOpen) return null;

  const handleDownloadPdf = () => {
    safeVibrate(20);
    setIsGenerating(true);

    try {
      const doc = generateMonthlyConsolidatedPDF({
        course,
        semester,
        students,
        attendance: attendanceRecords,
        evaluations,
        grades,
        targetMonth: selectedMonth,
        professorName,
        institutionName
      });

      const cleanCourse = course.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Informe_Mensual_${selectedMonth}_${course.modality}_${cleanCourse}.pdf`;
      doc.save(filename);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);

      if (onNotice) {
        onNotice('¡Informe oficial descargado en formato PDF!');
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      if (onNotice) {
        onNotice('Error al generar el documento PDF.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintDocument = () => {
    safeVibrate(15);
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0b1329] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Cabecera del Modal */}
        <header className="px-5 py-4 bg-gradient-to-r from-[#0c1f4a] via-[#0f275e] to-[#071330] text-white flex items-center justify-between shrink-0 border-b border-blue-400/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300 font-bold">
                  Documento Oficial A4
                </span>
                <span className="text-[10px] text-blue-200">·</span>
                <span className="text-[10px] font-mono text-blue-200">
                  {course.modality === 'CD' ? 'Curso Diurno (CD)' : 'Curso por Encuentro (CPE)'}
                </span>
              </div>
              <h2 className="font-serif font-bold text-base text-white leading-tight">
                Informe Mensual Consolidado
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
            title="Cerrar vista previa"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Panel de Controles y Parámetros */}
        <div className="p-4 bg-slate-50 dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            {/* Selector de Mes */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase block mb-1">
                Mes del Informe
              </label>
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full h-10 px-3 pr-8 rounded-lg bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden appearance-none cursor-pointer"
                >
                  {availableMonths.map(m => (
                    <option key={m.key} value={m.key}>
                      {m.label} ({m.key})
                    </option>
                  ))}
                  <option value="all">Consolidado Total del Semestre</option>
                </select>
                <div className="absolute right-3 top-2.5 pointer-events-none text-slate-400">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Docente / Catedrático */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase block mb-1">
                Profesor(a) Titular
              </label>
              <input
                type="text"
                value={professorName}
                onChange={(e) => setProfessorName(e.target.value)}
                placeholder="Nombre para el pie de firma"
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>

            {/* Institución / Encabezado */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase block mb-1">
                Encabezado Institucional
              </label>
              <input
                type="text"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="Nombre de la institución"
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>

          </div>

          {/* Resumen rápido de métricas del mes */}
          <div className="flex flex-wrap items-center gap-3 pt-3 mt-3 border-t border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1 font-mono">
              <span className="font-bold text-slate-900 dark:text-white">{reportData.monthSessions}</span> sesiones en el mes
            </span>
            <span>·</span>
            <span className="flex items-center gap-1 font-mono">
              <span className="font-bold text-slate-900 dark:text-white">{reportData.totalStudents}</span> alumnos evaluados
            </span>
            <span>·</span>
            <span className="flex items-center gap-1 font-mono">
              Asistencia media: <strong className={reportData.averageAttendancePct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}>{reportData.averageAttendancePct}%</strong>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1 font-mono">
              Aprobados: <strong className="text-emerald-600 dark:text-emerald-400">{reportData.approvedCount}</strong>
            </span>
            {reportData.atRiskCount > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 font-mono text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5 inline" />
                  <strong>{reportData.atRiskCount}</strong> en riesgo o desaprobados
                </span>
              </>
            )}
          </div>
        </div>

        {/* Vista Previa del Documento Institucional (Hoja A4 estilo papel) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-[#070b14]">
          <div 
            id="printable-report"
            className="max-w-3xl mx-auto bg-white text-slate-900 p-6 sm:p-8 rounded-xl shadow-md border border-slate-200 font-sans print:shadow-none print:border-none print:p-0 print:m-0"
          >
            {/* Franja y Membrete Superior */}
            <div className="border-b-2 border-[#0f275e] pb-3 mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-mono text-[10px] tracking-widest text-[#0f275e] font-extrabold uppercase">
                    {institutionName}
                  </h4>
                  <p className="text-[9.5px] text-slate-500 uppercase tracking-wide">
                    Dirección de Asuntos Académicos y Secretaría Docente
                  </p>
                  <h3 className="font-serif font-bold text-lg text-[#0f275e] mt-1 leading-snug">
                    INFORME MENSUAL CONSOLIDADO DE ASISTENCIA Y CALIFICACIONES
                  </h3>
                </div>
                <div className="text-right text-[10px] font-mono text-slate-500">
                  <div>Folio: <strong>ACT-{course.modality}-{(course.id || 1).toString().padStart(3, '0')}</strong></div>
                  <div>Fecha: {format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
                  <div className="text-emerald-700 font-bold mt-0.5">DOCUMENTO OFICIAL</div>
                </div>
              </div>

              {/* Ficha técnica de la asignatura */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Asignatura:</span>
                  <strong className="text-slate-800 text-[11.5px] truncate block">{course.name}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Modalidad:</span>
                  <span className="font-mono font-bold text-slate-800 text-[11.5px]">
                    {course.modality === 'CD' ? 'CD (Diurno)' : 'CPE (Por Encuentro)'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Período / Mes:</span>
                  <span className="font-bold text-[#0f275e] text-[11.5px]">{reportData.monthLabel}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Sesiones:</span>
                  <span className="font-mono font-bold text-slate-800 text-[11.5px]">{reportData.monthSessions} impartidas</span>
                </div>
              </div>
            </div>

            {/* Tabla Tabular Institucional */}
            <div className="overflow-x-auto my-3">
              <table className="w-full text-left border-collapse text-[10.5px]">
                <thead>
                  <tr className="bg-[#0f275e] text-white">
                    <th className="py-2 px-2 text-center w-8 font-bold border border-[#0f275e]">N°</th>
                    <th className="py-2 px-2 text-center font-bold border border-[#0f275e]">No. Carnet</th>
                    <th className="py-2 px-2 font-bold border border-[#0f275e]">Apellidos y Nombres</th>
                    <th className="py-2 px-1 text-center font-bold border border-[#0f275e]" title="Sesiones">Ses.</th>
                    <th className="py-2 px-1 text-center font-bold border border-[#0f275e]" title="Presentes">P</th>
                    <th className="py-2 px-1 text-center font-bold border border-[#0f275e]" title="Ausentes">A</th>
                    <th className="py-2 px-2 text-center font-bold border border-[#0f275e]">% Mes</th>
                    {evaluations.slice(0, 3).map(ev => (
                      <th key={ev.id} className="py-2 px-2 text-center font-bold border border-[#0f275e] truncate max-w-[60px]" title={ev.name}>
                        {ev.name.length > 8 ? ev.name.substring(0, 7) + '.' : ev.name}
                      </th>
                    ))}
                    <th className="py-2 px-2 text-center font-bold border border-[#0f275e]">Prom.</th>
                    <th className="py-2 px-2 text-center font-bold border border-[#0f275e]">Condición</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {reportData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-6 text-center text-slate-400 font-mono text-xs">
                        No hay estudiantes registrados en esta cátedra
                      </td>
                    </tr>
                  ) : (
                    reportData.rows.map((row, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                        <td className="py-1.5 px-2 text-center font-mono text-slate-500 border border-slate-200">{row.index}</td>
                        <td className="py-1.5 px-2 text-center font-mono text-slate-600 border border-slate-200">{row.code}</td>
                        <td className="py-1.5 px-2 font-semibold text-slate-800 border border-slate-200">{row.name}</td>
                        <td className="py-1.5 px-1 text-center font-mono text-slate-600 border border-slate-200">{row.monthSessions}</td>
                        <td className="py-1.5 px-1 text-center font-mono text-emerald-700 font-bold border border-slate-200">{row.monthPresents}</td>
                        <td className="py-1.5 px-1 text-center font-mono text-rose-600 font-bold border border-slate-200">{row.monthAbsents}</td>
                        <td className="py-1.5 px-2 text-center font-mono font-bold border border-slate-200">
                          <span className={row.monthAttendancePct < 75 ? 'text-rose-600 font-bold' : 'text-slate-800'}>
                            {row.monthAttendancePct}%
                          </span>
                        </td>
                        {evaluations.slice(0, 3).map(ev => {
                          const sc = row.evaluationScores[ev.id!];
                          return (
                            <td key={ev.id} className="py-1.5 px-2 text-center font-mono border border-slate-200">
                              {sc !== null && sc !== undefined ? sc : '-'}
                            </td>
                          );
                        })}
                        <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-900 border border-slate-200">
                          {row.average !== null ? row.average.toFixed(1) : '-'}
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold text-[9.5px] border border-slate-200">
                          <span className={
                            row.status === 'Aprobado' ? 'text-emerald-700' :
                            row.status === 'Riesgo Asistencia' || row.status === 'Desaprobado' ? 'text-rose-600' : 'text-slate-600'
                          }>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Firmas Institucionales */}
            <div className="mt-8 pt-4 border-t border-slate-200 grid grid-cols-2 gap-8 text-center">
              <div>
                <div className="border-b border-slate-400 w-44 mx-auto mb-2" />
                <p className="font-bold text-xs text-slate-800">{professorName}</p>
                <p className="text-[10px] text-slate-500">Catedrático Titular / Docente</p>
              </div>
              <div>
                <div className="border-b border-slate-400 w-44 mx-auto mb-2" />
                <p className="font-bold text-xs text-slate-800">Secretaría Docente / Decanato</p>
                <p className="text-[10px] text-slate-500">Sello Oficial y Conformidad</p>
              </div>
            </div>

            {/* Pie de página institucional */}
            <div className="mt-6 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] font-mono text-slate-400">
              <span>Docencia al Día · Sistema de Control Académico</span>
              <span>Página 1 de 1 · Documento oficial con validez institucional</span>
            </div>
          </div>
        </div>

        {/* Barra de Acciones del Modal */}
        <footer className="px-5 py-3.5 bg-white dark:bg-[#0f172a] border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Formato horizontal A4 con diseño vectorial institucional listo para secretaría.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handlePrintDocument}
              className="flex-1 sm:flex-initial min-h-[44px] px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-xs flex items-center justify-center gap-2 active:scale-95 border border-slate-200 dark:border-slate-700 transition-all"
            >
              <Printer className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <span>Imprimir / Diálogo</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className="flex-1 sm:flex-initial min-h-[44px] px-5 rounded-xl bg-blue-900 hover:bg-blue-800 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium text-xs flex items-center justify-center gap-2 active:scale-95 shadow-md transition-all disabled:opacity-50"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>¡Descargado!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>{isGenerating ? 'Generando PDF...' : 'Descargar Informe PDF (.pdf)'}</span>
                </>
              )}
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
};
