import React, { useState, useRef, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  FileText,
  Upload, 
  Check, 
  Copy, 
  Share2, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  UserPlus, 
  Download,
  Users,
  Eye,
  Calendar,
  Award
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Course, Semester, Student, Attendance, Evaluation, Grade } from '../db';
import { parseStudentFile, type ParsedStudentItem } from '../lib/studentFileParser';
import { exportCourseDataToExcel } from '../lib/excelExporter';
import { generateMonthlyConsolidatedPDF, computeMonthlyReportData } from '../lib/pdfMonthlyReportGenerator';
import { MonthlyReportPdfModal } from './MonthlyReportPdfModal';
import { StudentAttendanceCalendarHistory } from './StudentAttendanceCalendarHistory';
import { safeVibrate } from '../lib/utils';

interface ArchivosScreenProps {
  course: Course;
  semester?: Semester;
  students: Student[];
  attendanceRecords: Attendance[];
  evaluations: Evaluation[];
  grades: Grade[];
  courses: Course[];
  onSelectCourse: (courseId: number) => void;
  onImportStudents: (students: ParsedStudentItem[]) => Promise<void>;
  onExportNotice?: (msg: string) => void;
  onNavigateToAttendanceDate?: (date: string) => void;
  initialSelectedStudentId?: number;
}

export const ArchivosScreen: React.FC<ArchivosScreenProps> = ({
  course,
  semester,
  students,
  attendanceRecords,
  evaluations,
  grades,
  courses,
  onSelectCourse,
  onImportStudents,
  onExportNotice,
  onNavigateToAttendanceDate,
  initialSelectedStudentId
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'history'>('export');
  const [openAccordion, setOpenAccordion] = useState<'mass' | 'manual' | null>(null);

  // File Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [detectedStudents, setDetectedStudents] = useState<ParsedStudentItem[]>([]);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // Mass paste text
  const [massPasteText, setMassPasteText] = useState('');

  // Manual student form
  const [manualName, setManualName] = useState('');
  const [manualCode, setManualCode] = useState('');

  // Official filename preview
  const cleanCourseName = course.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const semesterTag = semester?.name ? `_${semester.name.replace(/[^a-zA-Z0-9_\-]/g, '_')}` : '';
  const dateTag = format(new Date(), 'yyyyMMdd');
  const generatedFilename = `DocenciaAlDia_${course.modality}_${cleanCourseName}${semesterTag}_${dateTag}.xlsx`;

  const [copiedFilename, setCopiedFilename] = useState(false);

  // PDF Monthly Report State
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    attendanceRecords.forEach(a => {
      if (a.date && a.date.length >= 7) {
        monthsSet.add(a.date.substring(0, 7)); // 'YYYY-MM'
      }
    });

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

  const [selectedPdfMonth, setSelectedPdfMonth] = useState<string>(
    availableMonths[0]?.key || format(new Date(), 'yyyy-MM')
  );
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfSuccessNotice, setPdfSuccessNotice] = useState(false);

  // Resumen del mes seleccionado para indicadores en vivo
  const selectedMonthReportData = useMemo(() => {
    return computeMonthlyReportData({
      students,
      attendance: attendanceRecords,
      evaluations,
      grades,
      targetMonth: selectedPdfMonth
    });
  }, [students, attendanceRecords, evaluations, grades, selectedPdfMonth]);

  // Handlers
  const handleCopyFilename = () => {
    navigator.clipboard?.writeText(generatedFilename);
    setCopiedFilename(true);
    setTimeout(() => setCopiedFilename(false), 2000);
  };

  const handleDownloadMonthlyPdf = () => {
    safeVibrate(20);
    setIsDownloadingPdf(true);

    try {
      const doc = generateMonthlyConsolidatedPDF({
        course,
        semester,
        students,
        attendance: attendanceRecords,
        evaluations,
        grades,
        targetMonth: selectedPdfMonth,
        professorName: 'Catedrático Titular',
        institutionName: 'UNIVERSIDAD NACIONAL • CONTROL ACADÉMICO'
      });

      const cleanCourse = course.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Informe_Mensual_${selectedPdfMonth}_${course.modality}_${cleanCourse}.pdf`;
      doc.save(filename);

      setPdfSuccessNotice(true);
      setTimeout(() => setPdfSuccessNotice(false), 3000);

      if (onExportNotice) {
        onExportNotice('¡Informe mensual consolidado descargado en PDF!');
      }
    } catch (err) {
      console.error('Error generating PDF report:', err);
      if (onExportNotice) {
        onExportNotice('Error al generar el PDF del informe.');
      }
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleTriggerExcelDownload = () => {
    if (navigator.vibrate) navigator.vibrate(20);
    exportCourseDataToExcel({
      course,
      semester,
      students,
      attendance: attendanceRecords,
      evaluations,
      grades
    });
    if (onExportNotice) {
      onExportNotice('¡Libro oficial descargado en tu dispositivo!');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Acta Oficial: ${course.name}`,
          text: `Resumen de notas y asistencia de ${course.name} (${course.modality}). Generado en Docencia al Día.`
        });
      } catch {
        // Ignored or cancelled
      }
    } else {
      handleCopyFilename();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setIsParsing(true);
    setParseError(null);
    setImportSuccessMessage(null);

    try {
      const items = await parseStudentFile(selected);
      const existingNames = new Set(students.map(s => s.name.toLowerCase().trim()));
      const filtered = items.filter(it => !existingNames.has(it.name.toLowerCase().trim()));
      setDetectedStudents(filtered.length > 0 ? filtered : items);
    } catch (err: any) {
      setParseError(err.message || 'Error al procesar el archivo. Verifica el formato .xlsx o .csv');
    } finally {
      setIsParsing(false);
    }
  };

  const handleProcessMassPaste = () => {
    const lines = massPasteText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    const parsed: ParsedStudentItem[] = lines.map(line => {
      const match = line.match(/^([A-Za-z0-9\-]+)\s+(.+)$/);
      if (match) {
        return { code: match[1], name: match[2].trim() };
      }
      return { name: line };
    });

    setDetectedStudents(parsed);
  };

  const handleAddManualStudent = () => {
    if (!manualName.trim()) return;
    setDetectedStudents(prev => [
      ...prev,
      { name: manualName.trim(), code: manualCode.trim() || undefined }
    ]);
    setManualName('');
    setManualCode('');
  };

  const handleCommitImport = async () => {
    if (detectedStudents.length === 0) return;
    if (navigator.vibrate) navigator.vibrate(25);
    await onImportStudents(detectedStudents);
    setImportSuccessMessage(`¡${detectedStudents.length} estudiantes incorporados a la asignatura!`);
    setDetectedStudents([]);
    setMassPasteText('');
    setTimeout(() => setImportSuccessMessage(null), 3000);
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in">
      {/* Target Subject Card & Academic Metadata */}
      <section className="bg-white dark:bg-[#0f172a] rounded-xl p-4 academic-border border border-slate-200/80 dark:border-slate-800 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase font-bold text-slate-500 dark:text-slate-400">
            <span className="material-symbols-outlined text-[16px] text-blue-700 dark:text-blue-400">dataset</span>
            <span>Cátedra en Foco</span>
          </div>
          <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            {course.modality === 'CD' ? 'CD • Diurno' : 'CPE • Por Encuentro'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <h2 className="font-serif font-bold text-base text-slate-900 dark:text-white truncate">
              {course.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <strong className="text-slate-800 dark:text-slate-200">{students.length}</strong> matriculados
              </span>
              <span>•</span>
              <span className="font-mono">{semester?.name || '2026-I'}</span>
            </div>
          </div>

          {/* Quick Subject Switcher */}
          {courses.length > 1 && (
            <div className="relative">
              <select
                value={course.id}
                onChange={(e) => onSelectCourse(Number(e.target.value))}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id} className="bg-white dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 font-sans">
                    {c.name} ({c.modality})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 border border-slate-200 dark:border-slate-700 flex items-center justify-center active:scale-95 transition-transform"
                title="Cambiar asignatura"
              >
                <span className="material-symbols-outlined text-[19px]">swap_horiz</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Segmented Tab Navigation */}
      <div className="bg-white dark:bg-[#0f172a] p-1 rounded-xl flex items-center gap-1 academic-border border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('export')}
          className={`flex-1 min-h-[44px] rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'export'
              ? 'bg-blue-900 dark:bg-blue-700 text-white font-bold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">table_view</span>
          <span className="hidden sm:inline">1. Exportar Actas</span>
          <span className="sm:hidden">1. Actas</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('import')}
          className={`flex-1 min-h-[44px] rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'import'
              ? 'bg-blue-900 dark:bg-blue-700 text-white font-bold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">upload_file</span>
          <span className="hidden sm:inline">2. Importar Nómina</span>
          <span className="sm:hidden">2. Nómina</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 min-h-[44px] rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'history'
              ? 'bg-blue-900 dark:bg-blue-700 text-white font-bold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">calendar_month</span>
          <span className="hidden sm:inline">3. Historial y Calendario</span>
          <span className="sm:hidden">3. Calendario</span>
        </button>
      </div>

      {/* Feedback Mensaje de Éxito */}
      {importSuccessMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 p-3 rounded-xl text-xs font-mono font-bold flex items-center gap-2 border border-emerald-300 dark:border-emerald-800 animate-in fade-in">
          <Check className="w-4 h-4" />
          <span>{importSuccessMessage}</span>
        </div>
      )}

      {/* ========================================== */}
      {/* BLOQUE 1: EXPORTACIÓN OFICIAL (PDF & XLSX) */}
      {/* ========================================== */}
      {activeTab === 'export' && (
        <div className="space-y-4">
          
          {/* ======================================================== */}
          {/* SECCIÓN 1: INFORME MENSUAL CONSOLIDADO (PDF INSTITUCIONAL) */}
          {/* ======================================================== */}
          <section className="bg-white dark:bg-[#0f172a] rounded-xl p-4 academic-border border border-blue-900/30 dark:border-blue-700/40 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">
                <FileText className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                <span>Formato Institucional Oficial (PDF)</span>
              </div>
              <span className="px-2 py-0.5 rounded font-mono font-bold text-[9.5px] bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                A4 Horizontal · Vectorial
              </span>
            </div>

            <div>
              <h3 className="font-serif font-bold text-base text-slate-900 dark:text-white leading-tight">
                Informe Mensual Consolidado de Asistencia y Calificaciones
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Acta mensual canónica con membrete de educación superior, detalle cronológico del mes, indicadores de aprobación y bloque de firmas para secretaría docente.
              </p>
            </div>

            {/* Selector de Mes para el Informe */}
            <div className="bg-slate-50 dark:bg-[#080d1a] p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mes a certificar:
                </span>
              </div>

              <select
                value={selectedPdfMonth}
                onChange={(e) => setSelectedPdfMonth(e.target.value)}
                className="h-9 px-3 rounded-lg bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
              >
                {availableMonths.map(m => (
                  <option key={m.key} value={m.key}>
                    {m.label} ({m.key})
                  </option>
                ))}
                <option value="all">Consolidado Total del Semestre</option>
              </select>
            </div>

            {/* Resumen de Datos del Mes Seleccionado */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 font-mono py-0.5">
              <span className="flex items-center gap-1">
                <span className="font-bold text-slate-900 dark:text-white">{selectedMonthReportData.monthSessions}</span> sesiones registradas
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <span className="font-bold text-slate-900 dark:text-white">{selectedMonthReportData.totalStudents}</span> alumnos
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                Asistencia media: <strong className={selectedMonthReportData.averageAttendancePct >= 80 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>{selectedMonthReportData.averageAttendancePct}%</strong>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                Aprobados: <strong className="text-emerald-700 dark:text-emerald-400">{selectedMonthReportData.approvedCount}</strong>
              </span>
            </div>

            {/* Botones de Acción PDF */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownloadMonthlyPdf}
                disabled={isDownloadingPdf}
                className="w-full min-h-[48px] rounded-xl bg-blue-900 hover:bg-blue-800 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium text-xs flex items-center justify-center gap-2 active:scale-95 shadow-md transition-all disabled:opacity-50"
              >
                {pdfSuccessNotice ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>¡PDF Descargado con Éxito!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>{isDownloadingPdf ? 'Generando PDF...' : 'Descargar Informe PDF (.pdf)'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  safeVibrate(15);
                  setIsPdfModalOpen(true);
                }}
                className="w-full min-h-[48px] rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-xs flex items-center justify-center gap-2 active:scale-95 border border-slate-200 dark:border-slate-700 transition-all"
              >
                <Eye className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                <span>Vista Previa e Impresión</span>
              </button>
            </div>
          </section>

          {/* ======================================================== */}
          {/* SECCIÓN 2: LIBRO OFICIAL A EXCEL XLSX DE 2 HOJAS         */}
          {/* ======================================================== */}
          {/* Official Normative Banner (Editorial Gradient) */}
          <section className="rounded-xl overflow-hidden bg-gradient-to-br from-[#0c1f4a] via-[#0f275e] to-[#071330] text-white p-4 academic-border shadow-md border-t border-blue-400/20">
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider mb-1">
              <span className="material-symbols-outlined text-[16px] text-amber-300">verified_user</span>
              <span>Normativa Universitaria Vigente</span>
            </div>
            <h3 className="font-serif font-bold text-base text-white leading-tight">
              Libro Excel Canónico de 2 Hojas (.xlsx)
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Estructurado para entrega directa a Secretaría Docente sin requerir formateo manual ni conversiones intermedias.
            </p>
          </section>

          {/* Visual Structure Breakdown (2 Sheets Preview) */}
          <div className="space-y-2.5">
            {/* Hoja 1 Card */}
            <div className="bg-white dark:bg-[#0f172a] rounded-xl p-3.5 academic-border border border-slate-200/80 dark:border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center justify-center font-mono font-bold text-xs">
                    1
                  </span>
                  <h4 className="font-serif font-bold text-xs text-slate-900 dark:text-white">
                    Hoja 1: Calificaciones y Asistencia Consolidada
                  </h4>
                </div>
                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[18px]">check_circle</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Matriz principal con ponderaciones automáticas y cálculo exacto de promedio y porcentaje de asistencia.
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[9.5px]">No. Carnet</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[9.5px]">Apellidos y Nombres</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono text-[9.5px] font-bold border border-emerald-200 dark:border-emerald-800">Evaluaciones (CP1..CP4)</span>
                <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-mono text-[9.5px] font-bold border border-blue-200 dark:border-blue-800">Promedio Final</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[9.5px]">% Asistencia</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-mono text-[9.5px] font-bold border border-amber-200 dark:border-amber-800">Estado (Aprobado/Des.)</span>
              </div>
            </div>

            {/* Hoja 2 Card */}
            <div className="bg-white dark:bg-[#0f172a] rounded-xl p-3.5 academic-border border border-slate-200/80 dark:border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center justify-center font-mono font-bold text-xs">
                    2
                  </span>
                  <h4 className="font-serif font-bold text-xs text-slate-900 dark:text-white">
                    Hoja 2: Detalle Cronológico de Sesiones
                  </h4>
                </div>
                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[18px]">check_circle</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Matriz día a día con codificación estándar ministerial e institucional.
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[9.5px] text-slate-400 font-mono">Códigos:</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono text-[9.5px] font-bold">P (Presente)</span>
                <span className="px-1.5 py-0.2 rounded bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-mono text-[9.5px] font-bold">A (Ausente)</span>
                <span className="px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-mono text-[9.5px] font-bold">T (Tardanza)</span>
                <span className="px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-mono text-[9.5px] font-bold">J (Justif.)</span>
              </div>
            </div>
          </div>

          {/* Automatic Filename Generator Box */}
          <section className="bg-white dark:bg-[#0f172a] rounded-xl p-3.5 flex flex-col gap-1.5 academic-border border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-blue-700 dark:text-blue-400">label</span>
                Nomenclatura Oficial Generada
              </span>
              <button
                type="button"
                onClick={handleCopyFilename}
                className="text-blue-700 dark:text-amber-400 text-xs font-mono font-bold flex items-center gap-1 hover:underline"
              >
                {copiedFilename ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-600 dark:text-emerald-400">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-[#080d1a] p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
              <p className="text-xs font-mono font-bold text-blue-900 dark:text-slate-200 whitespace-nowrap">
                {generatedFilename}
              </p>
            </div>
          </section>

          {/* Botones de Descarga y Compartir */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleTriggerExcelDownload}
              className="w-full min-h-[52px] rounded-xl bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-serif font-bold text-sm flex items-center justify-center gap-2 active:scale-95 shadow-md transition-all"
            >
              <Download className="w-5 h-5" />
              <span>Descargar Archivo Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="w-full min-h-[48px] rounded-xl bg-white dark:bg-[#0f172a] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium text-xs flex items-center justify-center gap-2 active:scale-95 border border-slate-200 dark:border-slate-800 transition-all"
            >
              <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Compartir Vía Correo / WhatsApp</span>
            </button>
          </div>

          {/* Garantía de Confidencialidad */}
          <div className="bg-white dark:bg-[#0f172a] rounded-xl p-3 flex items-center gap-3 border border-slate-200/80 dark:border-slate-800 academic-border">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            </div>
            <div className="flex flex-col">
              <h5 className="font-serif font-bold text-xs text-slate-900 dark:text-white">Confidencialidad Académica</h5>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Gestión local autónoma. Las calificaciones y nóminas se procesan con total reserva y sin dependencias externas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* BLOQUE 2: IMPORTACIÓN INTELIGENTE 3-VÍAS  */}
      {/* ========================================== */}
      {activeTab === 'import' && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">
              Carga de Nómina Oficial
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold border border-slate-200 dark:border-slate-700">
              Formatos .xlsx / .csv
            </span>
          </div>

          {/* VÍA 1: Carga de Archivo */}
          <div className="bg-white dark:bg-[#0f172a] rounded-xl p-5 academic-border border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px]">cloud_upload</span>
            </div>

            <div>
              <h3 className="font-serif font-bold text-sm text-slate-900 dark:text-white">
                Cargar Archivo .xlsx / .csv
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Arrastra aquí o pulsa para explorar el explorador de archivos
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelected}
              className="hidden"
              id="file-input"
            />

            <label
              htmlFor="file-input"
              className="w-full min-h-[48px] cursor-pointer bg-blue-900 hover:bg-blue-800 dark:bg-blue-700 text-white rounded-xl font-medium text-xs flex items-center justify-center gap-2 active:scale-95 shadow-xs transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>{isParsing ? 'Procesando nómina...' : 'Seleccionar Archivo de Estudiantes'}</span>
            </label>

            <span className="text-[10px] text-slate-400 font-mono">
              Plantillas oficiales, Excel (.xlsx, .xls) o CSV delimitado por comas
            </span>

            {parseError && (
              <div className="w-full p-2.5 bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 rounded-lg text-xs flex items-center gap-2 text-left border border-rose-200 dark:border-rose-900">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </div>

          {/* Accordion Vía 2 & Vía 3 */}
          <div className="space-y-2">
            {/* VÍA 2: Pegado Masivo */}
            <div className="bg-white dark:bg-[#0f172a] rounded-xl academic-border border border-slate-200 dark:border-slate-800 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenAccordion(openAccordion === 'mass' ? null : 'mass')}
                className="w-full min-h-[48px] px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">content_paste_go</span>
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-xs text-slate-900 dark:text-white">Vía 2: Pegado Masivo de Lista</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Copia y pega desde WhatsApp, correo o PDF</p>
                  </div>
                </div>
                {openAccordion === 'mass' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {openAccordion === 'mass' && (
                <div className="p-4 pt-1 flex flex-col gap-2.5 border-t border-slate-200 dark:border-slate-800">
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Formato libre: [Carnet/ID] [Apellidos y Nombres] (una línea por alumno)
                  </label>
                  <textarea
                    rows={4}
                    value={massPasteText}
                    onChange={(e) => setMassPasteText(e.target.value)}
                    placeholder={`01041267890 Peña Álvarez, Lisandra\n02031599812 Quintero Morales, David\n01102945671 Núñez Cárdenas, Íñigo`}
                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#080d1a] text-xs font-mono text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleProcessMassPaste}
                    className="min-h-[44px] w-full rounded-lg bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-600 text-white font-medium text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
                    <span>Analizar y Procesar Lista</span>
                  </button>
                </div>
              )}
            </div>

            {/* VÍA 3: Añadir Alumno Manual */}
            <div className="bg-white dark:bg-[#0f172a] rounded-xl academic-border border border-slate-200 dark:border-slate-800 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenAccordion(openAccordion === 'manual' ? null : 'manual')}
                className="w-full min-h-[48px] px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-xs text-slate-900 dark:text-white">Vía 3: Añadir Alumno Manual</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Alta directa para incorporaciones tardías</p>
                  </div>
                </div>
                {openAccordion === 'manual' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {openAccordion === 'manual' && (
                <div className="p-4 pt-1 flex flex-col gap-2.5 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase block mb-1">
                      Apellidos y Nombres
                    </label>
                    <input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="Ej. Valdés Menéndez, Camila"
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#080d1a] text-xs font-semibold text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase block mb-1">
                      No. de Carnet / Matrícula
                    </label>
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="Carnet o código estudiantil"
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#080d1a] text-xs font-mono text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 focus:outline-hidden"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddManualStudent}
                    className="min-h-[44px] w-full rounded-lg bg-blue-900 hover:bg-blue-800 dark:bg-blue-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Agregar a la Vista Previa</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tarjeta de Validación de Detección */}
          {detectedStudents.length > 0 && (
            <div className="bg-white dark:bg-[#0f172a] rounded-xl p-4 academic-border border border-emerald-300 dark:border-emerald-800 flex flex-col gap-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[19px] text-emerald-600 dark:text-emerald-400">verified</span>
                  <span className="font-serif font-bold text-xs text-slate-900 dark:text-white">Validación de Detección</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono text-[10px] font-bold border border-emerald-300 dark:border-emerald-800">
                  {detectedStudents.length} Detectados
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800">
                {detectedStudents.map((st, idx) => (
                  <div key={idx} className="flex items-center justify-between pt-1.5 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 dark:text-white truncate block">{st.name}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">ID: {st.code || 'Auto-ID'}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900">
                      Listo
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCommitImport}
                className="w-full min-h-[48px] rounded-xl bg-blue-900 hover:bg-blue-800 dark:bg-blue-700 text-white font-medium text-xs flex items-center justify-center gap-2 active:scale-95 shadow-md transition-all mt-1"
              >
                <span className="material-symbols-outlined text-[18px]">save_alt</span>
                <span>Confirmar e Incorporar a la Lista ({detectedStudents.length})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* BLOQUE 3: HISTORIAL Y CALENDARIO INTERACTIVO POR ALUMNO   */}
      {/* ======================================================== */}
      {activeTab === 'history' && (
        <StudentAttendanceCalendarHistory
          course={course}
          students={students}
          attendanceRecords={attendanceRecords}
          initialSelectedStudentId={initialSelectedStudentId}
          onNavigateToAttendanceDate={onNavigateToAttendanceDate}
        />
      )}

      {/* Modal de Vista Previa y Descarga de Informe Mensual Institucional */}
      <MonthlyReportPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        course={course}
        semester={semester}
        students={students}
        attendanceRecords={attendanceRecords}
        evaluations={evaluations}
        grades={grades}
        onNotice={onExportNotice}
      />
    </div>
  );
};
