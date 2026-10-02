import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Sparkles, 
  Users,
  Check
} from 'lucide-react';
import { 
  db, 
  type ClassModality, 
  MAX_COURSES_PER_MODALITY
} from './db';
import { format, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Modal } from './components/Modal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { EvaluationMode } from './components/EvaluationMode';
import { ArchivosScreen } from './components/ArchivosScreen';
import { AttendanceTrendChart } from './components/AttendanceTrendChart';
import { StudentAttendanceCard } from './components/StudentAttendanceCard';
import type { ParsedStudentItem } from './lib/studentFileParser';
import { safeVibrate } from './lib/utils';

export default function App() {
  // Theme state: Default to DARK mode as requested by user
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('theme');
        if (saved === 'light') return 'light';
      } catch {
        // Ignored
      }
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
      if (body) {
        body.classList.add('dark');
        body.classList.remove('light');
      }
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
      if (body) {
        body.classList.remove('dark');
        body.classList.add('light');
      }
    }
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // Ignored
    }
  }, [theme]);

  const toggleTheme = () => {
    safeVibrate(15);
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Navigation tabs: Cátedras | Asistencia | Evaluador | Actas
  const [navTab, setNavTab] = useState<'asignaturas' | 'asistencia' | 'evaluador' | 'archivos'>('asignaturas');

  // Semester & Course state
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  // Date selection for attendance
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'P' | 'A' | 'T' | 'J' | 'critical'>('all');

  // Toast feedback
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Modals
  const [isSemesterModalOpen, setIsSemesterModalOpen] = useState(false);
  const [semesterName, setSemesterName] = useState('');

  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseModality, setCourseModality] = useState<ClassModality>('CD');

  // Live queries to Dexie
  const semesters = useLiveQuery(() => db.semesters.toArray()) || [];
  const courses = useLiveQuery(
    () => selectedSemesterId ? db.courses.where('semesterId').equals(selectedSemesterId).toArray() : [],
    [selectedSemesterId]
  ) || [];
  const allStudents = useLiveQuery(() => db.students.toArray()) || [];
  const students = useLiveQuery(
    () => selectedCourseId ? db.students.where('courseId').equals(selectedCourseId).toArray() : [],
    [selectedCourseId]
  ) || [];
  const evaluations = useLiveQuery(
    () => selectedCourseId ? db.evaluations.where('courseId').equals(selectedCourseId).toArray() : [],
    [selectedCourseId]
  ) || [];
  const attendanceRecords = useLiveQuery(
    () => selectedCourseId ? db.attendance.where('courseId').equals(selectedCourseId).toArray() : [],
    [selectedCourseId]
  ) || [];
  const allAttendance = useLiveQuery(() => db.attendance.toArray()) || [];
  const grades = useLiveQuery(() => db.grades.toArray()) || [];

  // Current selected entities
  const currentSemester = semesters.find(s => s.id === selectedSemesterId) || semesters[0];
  const currentCourse = courses.find(c => c.id === selectedCourseId) || courses[0];

  // Auto-select first semester and course if available
  useEffect(() => {
    if (!selectedSemesterId && semesters.length > 0) {
      setSelectedSemesterId(semesters[0].id!);
    }
  }, [semesters, selectedSemesterId]);

  useEffect(() => {
    if (courses.length > 0 && (!selectedCourseId || !courses.some(c => c.id === selectedCourseId))) {
      setSelectedCourseId(courses[0].id!);
    }
  }, [courses, selectedCourseId]);

  // CD and CPE breakdown
  const cdCourses = courses.filter(c => c.modality === 'CD');
  const cpeCourses = courses.filter(c => c.modality === 'CPE');
  const cdCount = cdCourses.length;
  const cpeCount = cpeCourses.length;

  // Global KPIs across current semester
  const totalStudentsInSemester = allStudents.filter(st => 
    courses.some(c => c.id === st.courseId)
  ).length;

  const semesterAttendanceRecords = allAttendance.filter(a => 
    courses.some(c => c.id === a.courseId)
  );
  const globalAttendanceRate = semesterAttendanceRecords.length > 0
    ? Math.round(
        (semesterAttendanceRecords.filter(a => a.status === 'present' || a.status === 'excused').length /
          semesterAttendanceRecords.length) *
          100
      )
    : 91.4;

  // Semesters creation and deletion
  const handleCreateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!semesterName.trim()) return;
    const id = await db.semesters.add({
      name: semesterName.trim(),
      createdAt: new Date()
    }) as number;
    setSelectedSemesterId(id);
    setSemesterName('');
    setIsSemesterModalOpen(false);
  };

  const handleDeleteSemester = async (semesterId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('¿Eliminar este semestre y todas sus cátedras asociadas?')) {
      await db.deleteSemesterCascade(semesterId);
      if (selectedSemesterId === semesterId) {
        const remaining = semesters.filter(s => s.id !== semesterId);
        setSelectedSemesterId(remaining[0]?.id || null);
      }
    }
  };

  // Courses creation and deletion
  const handleOpenCourseModal = (modality: ClassModality = 'CD') => {
    setCourseModality(modality);
    setIsCourseModalOpen(true);
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName.trim() || !selectedSemesterId) return;

    const countInModality = courses.filter(c => c.modality === courseModality).length;
    if (countInModality >= MAX_COURSES_PER_MODALITY) {
      alert(`Has alcanzado el límite máximo de ${MAX_COURSES_PER_MODALITY} cátedras permitidas en ${courseModality === 'CD' ? 'Curso Diurno (CD)' : 'Curso por Encuentro (CPE)'}.`);
      return;
    }

    const id = await db.courses.add({
      name: courseName.trim(),
      code: courseCode.trim() || (courseModality === 'CD' ? `INF-${300 + cdCount * 10}` : `ADM-${500 + cpeCount * 10}`),
      semesterId: selectedSemesterId,
      modality: courseModality
    }) as number;

    setSelectedCourseId(id);
    setCourseName('');
    setCourseCode('');
    setIsCourseModalOpen(false);
  };

  // Seed demo data
  const handleLoadDemo = async () => {
    await db.seedDemoData();
    const all = await db.semesters.toArray();
    if (all.length > 0) {
      setSelectedSemesterId(all[0].id!);
    }
  };

  // Import students
  const handleImportStudents = async (items: ParsedStudentItem[]) => {
    if (!selectedCourseId) return;
    for (const item of items) {
      await db.students.add({
        name: item.name,
        code: item.code,
        courseId: selectedCourseId
      });
    }
  };

  // Attendance manipulation
  const markAttendance = async (studentId: number, status: 'present' | 'absent' | 'late' | 'excused') => {
    if (!selectedCourseId) return;
    safeVibrate(10);
    const existing = await db.attendance.where({ studentId, date: selectedDate }).first();
    if (existing) {
      await db.attendance.update(existing.id!, { status });
    } else {
      await db.attendance.add({
        studentId,
        courseId: selectedCourseId,
        date: selectedDate,
        status
      });
    }
  };

  const handleUpdateStudentNote = async (studentId: number, note: string) => {
    if (!selectedCourseId) return;
    const existing = await db.attendance.where({ studentId, date: selectedDate }).first();
    if (existing) {
      await db.attendance.update(existing.id!, { note });
    } else {
      await db.attendance.add({
        studentId,
        courseId: selectedCourseId,
        date: selectedDate,
        status: 'present',
        note
      });
    }
  };

  const markAllPresent = async () => {
    if (!selectedCourseId || students.length === 0) return;
    safeVibrate([20, 40, 20]);
    for (const student of students) {
      const existing = await db.attendance.where({ studentId: student.id!, date: selectedDate }).first();
      if (existing) {
        await db.attendance.update(existing.id!, { status: 'present' });
      } else {
        await db.attendance.add({
          studentId: student.id!,
          courseId: selectedCourseId,
          date: selectedDate,
          status: 'present'
        });
      }
    }
    showToast('¡Todos los estudiantes marcados como Presente!');
  };

  const handleSaveAttendanceSnapshot = () => {
    safeVibrate(25);
    showToast('¡Registro de asistencia guardado con éxito!');
  };

  const showToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(null), 2800);
  };

  // Date navigation handlers
  const handlePrevDay = () => {
    try {
      const prev = addDays(parseISO(selectedDate), -1);
      setSelectedDate(format(prev, 'yyyy-MM-dd'));
    } catch {
      // Ignored
    }
  };

  const handleNextDay = () => {
    try {
      const next = addDays(parseISO(selectedDate), 1);
      setSelectedDate(format(next, 'yyyy-MM-dd'));
    } catch {
      // Ignored
    }
  };

  // Students on date
  const studentsOnDate = students.map(student => {
    const record = attendanceRecords.find(a => a.studentId === student.id && a.date === selectedDate);
    return {
      student,
      status: record ? record.status : ('present' as const),
      note: record?.note || ''
    };
  });

  // Mapa de inasistencias acumuladas en la cátedra seleccionada
  const studentAbsenceMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const record of attendanceRecords) {
      if (record.status === 'absent') {
        map.set(record.studentId, (map.get(record.studentId) || 0) + 1);
      }
    }
    return map;
  }, [attendanceRecords]);

  // Estudiantes que acumulan más de 3 inasistencias en la cátedra
  const studentsWithExcessiveAbsences = useMemo(() => {
    return students
      .map(st => ({
        student: st,
        absentCount: studentAbsenceMap.get(st.id!) || 0
      }))
      .filter(item => item.absentCount > 3)
      .sort((a, b) => b.absentCount - a.absentCount);
  }, [students, studentAbsenceMap]);

  const [isAbsenceAlertExpanded, setIsAbsenceAlertExpanded] = useState(false);
  const [isAbsenceAlertDismissed, setIsAbsenceAlertDismissed] = useState(false);

  // Reiniciar estado de alerta al cambiar de cátedra
  useEffect(() => {
    setIsAbsenceAlertDismissed(false);
    setIsAbsenceAlertExpanded(false);
  }, [selectedCourseId]);

  const countP = studentsOnDate.filter(s => s.status === 'present').length;
  const countA = studentsOnDate.filter(s => s.status === 'absent').length;
  const countT = studentsOnDate.filter(s => s.status === 'late').length;
  const countJ = studentsOnDate.filter(s => s.status === 'excused').length;
  const totalCount = students.length;
  const attendancePct = totalCount > 0 ? ((countP / totalCount) * 100).toFixed(1) : '100.0';

  const filteredRoster = studentsOnDate.filter(item => {
    if (attendanceFilter === 'all') return true;
    if (attendanceFilter === 'critical') return (studentAbsenceMap.get(item.student.id!) || 0) > 3;
    if (attendanceFilter === 'P') return item.status === 'present';
    if (attendanceFilter === 'A') return item.status === 'absent';
    if (attendanceFilter === 'T') return item.status === 'late';
    if (attendanceFilter === 'J') return item.status === 'excused';
    return true;
  });

  // Display human date
  let displayHumanDate = selectedDate;
  try {
    const parsed = parseISO(selectedDate);
    const today = format(new Date(), 'yyyy-MM-dd');
    const isToday = selectedDate === today;
    displayHumanDate = isToday 
      ? `Hoy, ${format(parsed, "d 'de' MMMM yyyy", { locale: es })}`
      : format(parsed, "EEEE, d 'de' MMMM", { locale: es });
  } catch {
    displayHumanDate = selectedDate;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080d1a] font-sans text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-300 antialiased selection:bg-amber-100 selection:text-amber-900 overflow-x-hidden">
      {/* ========================================================= */}
      {/* HEADER SUPERIOR INSTITUCIONAL                             */}
      {/* ========================================================= */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/95 dark:bg-[#0d1527]/95 backdrop-blur-md pt-safe border-b border-slate-200/80 dark:border-slate-800/80 shadow-[0_1px_4px_rgba(0,0,0,0.03)] transition-colors duration-300">
        {/* Membrete Institucional */}
        <div className="px-4 pt-2.5 pb-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 max-w-md mx-auto w-full">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-blue-900 dark:bg-blue-600 flex items-center justify-center text-amber-300 shadow-xs shrink-0">
              <span className="material-symbols-outlined text-[17px]">school</span>
            </span>
            <div className="flex flex-col">
              <span className="font-serif text-[13px] font-bold text-slate-900 dark:text-white leading-tight">
                Docencia al Día
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans leading-tight">
                Gestión Académica Universitaria
              </span>
            </div>
          </div>

          {/* Controles de estado y Switch Modo Oscuro / Claro */}
          <div className="flex items-center gap-1.5">
            {/* PWA Install Button */}
            <PWAInstallButton />

            {/* Botón Interactivo Modo Claro / Oscuro */}
            <button
              type="button"
              id="themeToggleBtn"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="h-8 px-2.5 rounded-lg flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-amber-400 hover:border-slate-300 dark:hover:border-slate-600 active:scale-95 transition-all shadow-2xs cursor-pointer"
              title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            >
              <span className="material-symbols-outlined text-[17px]">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
              <span className="text-[11px] font-semibold">
                {theme === 'dark' ? 'Claro' : 'Oscuro'}
              </span>
            </button>
          </div>
        </div>

        {/* Título y Semestre Oficial */}
        <div className="px-4 py-2.5 flex items-center justify-between max-w-md mx-auto w-full">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <h1 className="text-[20px] font-serif font-bold text-slate-900 dark:text-white tracking-tight truncate">
              {navTab === 'asignaturas' ? 'Cátedras Asignadas' :
               navTab === 'asistencia' ? 'Control de Asistencia' :
               navTab === 'evaluador' ? 'Calificaciones' : 'Actas y Archivos'}
            </h1>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
              Período Activo
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsSemesterModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 font-mono text-[11px] font-semibold tracking-wide hover:border-blue-400 shrink-0 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[13px] text-blue-700 dark:text-blue-400">calendar_month</span>
            <span>{currentSemester?.name || '2026-I'}</span>
          </button>
        </div>
      </header>

      {/* Floating Toast Notice */}
      {toastNotice && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-50 bg-[#0c1f4a] dark:bg-[#071330] text-amber-300 px-4 py-2.5 rounded-xl text-xs font-mono font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200 border border-amber-400/40">
          <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
          <span>{toastNotice}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* CONTENEDOR PRINCIPAL SCROLLABLE                           */}
      {/* ========================================================= */}
      <main className="flex-1 flex flex-col w-full px-4 pt-[114px] pb-24 bg-slate-50 dark:bg-[#080d1a] transition-colors duration-300">
        <div className="flex flex-col w-full gap-4 max-w-md mx-auto">
          {/* ===================================================== */}
          {/* PESTAÑA 1: CÁTEDRAS ASIGNADAS (DASHBOARD RECTORAL)    */}
          {/* ===================================================== */}
          {navTab === 'asignaturas' && (
            <div className="space-y-4">
              {semesters.length === 0 ? (
                <div className="bg-white dark:bg-[#0f172a] rounded-xl p-8 academic-border border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                  <span className="text-3xl block mb-2">🏛️</span>
                  <h3 className="font-serif font-bold text-base text-slate-900 dark:text-white">
                    Sin períodos académicos registrados
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto mb-4 font-mono">
                    Registra tu primer semestre o carga la estructura de cátedras canónicas.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSemesterModalOpen(true)}
                      className="min-h-[48px] w-full bg-blue-900 hover:bg-blue-800 dark:bg-blue-700 text-white rounded-xl text-xs font-medium active:scale-95 shadow-sm transition"
                    >
                      Aperturar Semestre Académico
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadDemo}
                      className="min-h-[48px] w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-medium active:scale-95 border border-slate-200 dark:border-slate-700 transition flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>Cargar Cátedras de Demostración</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* TARJETA EJECUTIVA DE CATEDRÁTICO (EDITORIAL NAVY & GOLD) */}
                  <section className="relative rounded-xl overflow-hidden bg-gradient-to-br from-[#0c1f4a] via-[#0f275e] to-[#071330] text-white p-4 academic-border shadow-md border-t border-blue-400/20">
                    {/* Ornamento académico en filigrana de fondo */}
                    <div className="absolute -right-4 -bottom-6 opacity-10 pointer-events-none select-none font-serif text-[110px] leading-none text-amber-200">
                      §
                    </div>

                    <div className="relative z-10 flex items-start justify-between pb-3 border-b border-white/10 gap-3">
                      <div className="flex items-center gap-3">
                        {/* Avatar académico sobrio con reborde dorado */}
                        <div className="relative w-12 h-12 rounded-lg bg-blue-950 border border-amber-400/40 p-0.5 shadow-inner flex items-center justify-center">
                          <span className="font-serif font-bold text-amber-300 text-[18px] tracking-wider">AM</span>
                          <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#0c1f4a]" title="Activo" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-amber-300/90 font-medium">
                            Catedrático Titular
                          </span>
                          <h2 className="font-serif text-[18px] font-semibold text-white tracking-tight leading-snug">
                            Dr. Alejandro Morales
                          </h2>
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded bg-blue-900/60 border border-blue-400/30 text-blue-200">
                        ID: DOC-7140
                      </span>
                    </div>

                    {/* Indicadores Clave de Desempeño Docente */}
                    <div className="relative z-10 grid grid-cols-3 gap-2 pt-3">
                      <div className="bg-white/[0.06] hover:bg-white/[0.09] transition-colors rounded-lg p-2.5 border border-white/10 flex flex-col justify-between">
                        <span className="text-[10.5px] font-sans text-slate-300 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-blue-300">group</span> Alumnos
                        </span>
                        <div className="mt-1">
                          <span className="text-[21px] font-serif font-bold text-white tracking-tight leading-none">
                            {totalStudentsInSemester || 118}
                          </span>
                          <span className="text-[9.5px] font-mono block text-emerald-300 mt-0.5">Matrícula Total</span>
                        </div>
                      </div>
                      <div className="bg-white/[0.06] hover:bg-white/[0.09] transition-colors rounded-lg p-2.5 border border-white/10 flex flex-col justify-between">
                        <span className="text-[10.5px] font-sans text-slate-300 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-amber-300">verified</span> Asistencia
                        </span>
                        <div className="mt-1">
                          <span className="text-[21px] font-serif font-bold text-white tracking-tight leading-none">
                            {globalAttendanceRate}%
                          </span>
                          <span className="text-[9.5px] font-mono block text-blue-200 mt-0.5">Media Global</span>
                        </div>
                      </div>
                      <div className="bg-white/[0.06] hover:bg-white/[0.09] transition-colors rounded-lg p-2.5 border border-white/10 flex flex-col justify-between">
                        <span className="text-[10.5px] font-sans text-slate-300 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-rose-300">timer</span> Actas
                        </span>
                        <div className="mt-1">
                          <span className="text-[21px] font-serif font-bold text-amber-300 tracking-tight leading-none">
                            02
                          </span>
                          <span className="text-[9.5px] font-mono block text-amber-200/80 mt-0.5">Por Asentar</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* BARRA DE OPERACIONES RÁPIDAS DE SECRETARÍA ACADÉMICA */}
                  <section className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
                    <button
                      type="button"
                      onClick={() => setNavTab('archivos')}
                      className="h-11 px-3.5 rounded-lg bg-white dark:bg-[#111a30] text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 flex items-center gap-2 shrink-0 academic-border active:scale-[0.98] transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px] text-blue-800 dark:text-blue-400">picture_as_pdf</span>
                      <span className="text-[12.5px] font-medium tracking-tight">Descargar Actas (Excel / PDF)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNavTab('evaluador')}
                      className="h-11 px-3.5 rounded-lg bg-white dark:bg-[#111a30] text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 flex items-center gap-2 shrink-0 academic-border active:scale-[0.98] transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px] text-amber-700 dark:text-amber-400">query_stats</span>
                      <span className="text-[12.5px] font-medium tracking-tight">Régimen Calificativo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSemesterModalOpen(true)}
                      className="h-11 px-3.5 rounded-lg bg-white dark:bg-[#111a30] text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 flex items-center gap-2 shrink-0 academic-border active:scale-[0.98] transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">history_edu</span>
                      <span className="text-[12.5px] font-medium tracking-tight">Gestión Semestral</span>
                    </button>
                  </section>

                  {/* SECCIÓN 1: MODALIDAD CURSO DIURNO (CD) */}
                  <section className="flex flex-col gap-3 pt-1">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-700 dark:bg-blue-400" />
                        <h2 className="text-[15px] font-serif font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          Curso Diurno <span className="text-blue-700 dark:text-blue-400 font-mono text-[13px] font-semibold">(CD)</span>
                        </h2>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-semibold">
                        <span>Docencia:</span>
                        <span className="text-blue-800 dark:text-blue-300 font-bold">{cdCount} / 5 Cátedras</span>
                      </div>
                    </div>

                    {cdCourses.map(course => (
                      <article
                        key={course.id}
                        className="bg-white dark:bg-[#0f172a] rounded-xl p-3.5 academic-border border border-slate-200/70 dark:border-slate-800/80 flex flex-col gap-3 hover:border-blue-400/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60 rounded font-mono text-[11px] font-semibold">
                                {course.code || 'INF-301'}
                              </span>
                              <span className="flex items-center gap-0.5 text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                                <span className="material-symbols-outlined text-[13px]">room</span> Aula Magna 302
                              </span>
                            </div>
                            <h3 className="text-[15.5px] font-serif font-bold text-slate-900 dark:text-white leading-snug truncate">
                              {course.name}
                            </h3>
                            <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <span className="material-symbols-outlined text-[14px] text-blue-700 dark:text-blue-400">calendar_today</span>
                              <span>Lun & Mié • 08:00 – 10:00 hrs</span>
                            </p>
                          </div>
                          <div className="flex flex-col items-end shrink-0 pl-2">
                            <span className="text-[20px] font-serif font-bold text-emerald-700 dark:text-emerald-400 leading-none">94%</span>
                            <span className="text-[9.5px] font-mono uppercase text-slate-400 dark:text-slate-500 mt-0.5">Asistencia</span>
                          </div>
                        </div>

                        {/* Barra de Precisión y Metadatos */}
                        <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-emerald-600 dark:bg-emerald-500 h-1.5 rounded-full" style={{ width: '94%' }} />
                          </div>
                          <div className="flex justify-between items-center text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px] text-slate-400">badge</span>
                              {students.length > 0 && selectedCourseId === course.id ? students.length : 34} Alumnos Regulares
                            </span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px]">check_circle</span> Acta al día
                            </span>
                          </div>
                        </div>

                        {/* Botones de Acción Ergonómica (48px Touch Target) */}
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCourseId(course.id!);
                              setNavTab('asistencia');
                            }}
                            className="min-h-[48px] px-3 rounded-lg bg-blue-900 hover:bg-blue-800 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium text-[12.5px] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all shadow-xs"
                          >
                            <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                            <span>Control Asistencia</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCourseId(course.id!);
                              setNavTab('evaluador');
                            }}
                            className="min-h-[48px] px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-[12.5px] border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
                          >
                            <span className="material-symbols-outlined text-[18px] text-blue-700 dark:text-blue-400">edit_note</span>
                            <span>Calificar Acta</span>
                          </button>
                        </div>
                      </article>
                    ))}

                    {/* Botón Añadir Asignatura CD */}
                    {cdCount < 5 && (
                      <button
                        type="button"
                        onClick={() => handleOpenCourseModal('CD')}
                        className="min-h-[48px] w-full rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 bg-white/70 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 text-[13px] font-medium flex items-center justify-center gap-2 active:scale-[0.99] transition-all"
                      >
                        <span className="material-symbols-outlined text-[18px] text-blue-800 dark:text-blue-400">add_circle_outline</span>
                        <span>Inscribir Cátedra Curso Diurno</span>
                        <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-300 text-[10.5px] font-mono font-semibold">
                          {5 - cdCount} cupos disponibles
                        </span>
                      </button>
                    )}
                  </section>

                  {/* SECCIÓN 2: MODALIDAD CURSO POR ENCUENTRO (CPE) */}
                  <section className="flex flex-col gap-3 pt-2">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-600 dark:bg-amber-400" />
                        <h2 className="text-[15px] font-serif font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          Curso por Encuentro <span className="text-amber-700 dark:text-amber-400 font-mono text-[13px] font-semibold">(CPE)</span>
                        </h2>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-900/50 text-amber-900 dark:text-amber-300 font-mono text-[11px] font-semibold">
                        <span>Docencia:</span>
                        <span className="font-bold">{cpeCount} / 5 Cátedras</span>
                      </div>
                    </div>

                    {cpeCourses.map(course => (
                      <article
                        key={course.id}
                        className="bg-white dark:bg-[#0f172a] rounded-xl p-3.5 academic-border border border-slate-200/70 dark:border-slate-800/80 flex flex-col gap-3 hover:border-amber-400/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className="px-1.5 py-0.5 bg-amber-100/70 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/60 rounded font-mono text-[11px] font-semibold">
                                {course.code || 'ADM-502'}
                              </span>
                              <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-[10.5px] font-mono font-medium">
                                <span className="material-symbols-outlined text-[13px]">date_range</span> Módulo Sabatino
                              </span>
                            </div>
                            <h3 className="text-[15.5px] font-serif font-bold text-slate-900 dark:text-white leading-snug truncate">
                              {course.name}
                            </h3>
                            <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <span className="material-symbols-outlined text-[14px] text-amber-700 dark:text-amber-400">schedule</span>
                              <span>Sábados Intensivos • 08:00 – 12:00 hrs</span>
                            </p>
                          </div>
                          <div className="flex flex-col items-end shrink-0 pl-2">
                            <span className="text-[20px] font-serif font-bold text-emerald-700 dark:text-emerald-400 leading-none">96%</span>
                            <span className="text-[9.5px] font-mono uppercase text-slate-400 dark:text-slate-500 mt-0.5">Asistencia</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-emerald-600 dark:bg-emerald-500 h-1.5 rounded-full" style={{ width: '96%' }} />
                          </div>
                          <div className="flex justify-between items-center text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px] text-slate-400">badge</span>
                              24 Profesionales Matriculados
                            </span>
                            <span className="text-amber-800 dark:text-amber-400 font-semibold flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[13px]">assignment</span> 1 Hito pendiente
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCourseId(course.id!);
                              setNavTab('asistencia');
                            }}
                            className="min-h-[48px] px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-[12.5px] border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
                          >
                            <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                            <span>Control Asistencia</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCourseId(course.id!);
                              setNavTab('evaluador');
                            }}
                            className="min-h-[48px] px-3 rounded-lg bg-blue-900 hover:bg-blue-800 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium text-[12.5px] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all shadow-xs"
                          >
                            <span className="material-symbols-outlined text-[18px]">grade</span>
                            <span>Calificar Hito</span>
                          </button>
                        </div>
                      </article>
                    ))}

                    {cpeCount < 5 && (
                      <button
                        type="button"
                        onClick={() => handleOpenCourseModal('CPE')}
                        className="min-h-[48px] w-full rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 bg-white/70 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 text-[13px] font-medium flex items-center justify-center gap-2 active:scale-[0.99] transition-all"
                      >
                        <span className="material-symbols-outlined text-[18px] text-amber-700 dark:text-amber-400">add_circle_outline</span>
                        <span>Inscribir Cátedra Curso por Encuentro</span>
                        <span className="px-2 py-0.5 rounded bg-amber-100/80 dark:bg-amber-950 text-amber-900 dark:text-amber-300 text-[10.5px] font-mono font-semibold">
                          {5 - cpeCount} cupos disponibles
                        </span>
                      </button>
                    )}
                  </section>
                </>
              )}
            </div>
          )}

          {/* ===================================================== */}
          {/* PESTAÑA 2: ASISTENCIA (CONTROL DIARIO CANÓNICO)       */}
          {/* ===================================================== */}
          {navTab === 'asistencia' && (
            <div className="space-y-3.5">
              {!currentCourse ? (
                <div className="bg-white dark:bg-[#0f172a] p-6 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Selecciona o crea una cátedra primero.</p>
                  <button
                    type="button"
                    onClick={() => setNavTab('asignaturas')}
                    className="mt-3 px-4 py-2 bg-blue-900 dark:bg-blue-700 text-white rounded-xl text-xs font-bold"
                  >
                    Ir a Cátedras
                  </button>
                </div>
              ) : (
                <>
                  {/* Selector Contextual Superior */}
                  <section className="bg-white dark:bg-[#0f172a] rounded-xl p-3.5 academic-border border border-slate-200/80 dark:border-slate-800 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="material-symbols-outlined text-blue-700 dark:text-blue-400 text-[20px]">terminal</span>
                        <span className="font-serif font-bold text-sm text-slate-900 dark:text-white truncate">
                          {currentCourse.name}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {currentCourse.modality}
                      </span>
                    </div>

                    {/* Navegación de Sesión / Fecha */}
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-[#080d1a] rounded-lg p-1 border border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={handlePrevDay}
                        aria-label="Sesión anterior"
                        className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 active:scale-95 transition-all"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-blue-700 dark:text-blue-400 text-[18px]">event_available</span>
                        <span className="font-sans font-bold text-xs text-slate-900 dark:text-white capitalize">{displayHumanDate}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleNextDay}
                        aria-label="Sesión siguiente"
                        className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 active:scale-95 transition-all"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </section>

                  {/* Métricas en Vivo (Bento Grid) */}
                  <section className="grid grid-cols-4 gap-2 bg-white dark:bg-[#0f172a] p-2.5 rounded-xl academic-border border border-slate-200/80 dark:border-slate-800 text-center">
                    <div className="bg-slate-50 dark:bg-[#080d1a] rounded-lg py-2 px-1 flex flex-col items-center border border-slate-200 dark:border-slate-800">
                      <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400 uppercase">Total</span>
                      <span className="font-serif font-bold text-base text-slate-900 dark:text-white">{totalCount}</span>
                      <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{attendancePct}%</span>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-lg py-2 px-1 flex flex-col items-center border border-emerald-200/60 dark:border-emerald-800/40">
                      <span className="font-mono text-[9px] text-emerald-800 dark:text-emerald-300 uppercase font-bold">Pres.</span>
                      <span className="font-serif font-bold text-base text-emerald-800 dark:text-emerald-300">{countP}</span>
                      <span className="text-[9px] text-emerald-700 dark:text-emerald-400">alumnos</span>
                    </div>
                    <div className="bg-rose-50 dark:bg-rose-950/40 rounded-lg py-2 px-1 flex flex-col items-center border border-rose-200/60 dark:border-rose-800/40">
                      <span className="font-mono text-[9px] text-rose-800 dark:text-rose-300 uppercase font-bold">Aus.</span>
                      <span className="font-serif font-bold text-base text-rose-800 dark:text-rose-300">{countA}</span>
                      <span className="text-[9px] text-rose-700 dark:text-rose-400">alumnos</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#080d1a] rounded-lg py-2 px-1 flex flex-col items-center border border-slate-200 dark:border-slate-800">
                      <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold">T / J</span>
                      <span className="font-serif font-bold text-base text-blue-900 dark:text-amber-400">{countT} / {countJ}</span>
                      <span className="text-[9px] text-slate-400">demoras</span>
                    </div>
                  </section>

                  {/* Alerta Visual: Banner Discreto para estudiantes con >3 inasistencias */}
                  {studentsWithExcessiveAbsences.length > 0 && !isAbsenceAlertDismissed && (
                    <aside
                      role="alert"
                      className="bg-amber-50/95 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-800/60 rounded-xl p-3.5 text-slate-800 dark:text-slate-200 text-xs transition-all shadow-xs animate-in fade-in"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[20px] shrink-0 mt-0.5">
                            warning
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-serif font-bold text-xs text-amber-950 dark:text-amber-200">
                                Alerta de Inasistencias Críticas
                              </h4>
                              <span className="text-[10px] font-mono font-bold text-rose-700 dark:text-rose-400 bg-rose-100/80 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/60">
                                {studentsWithExcessiveAbsences.length} {studentsWithExcessiveAbsences.length === 1 ? 'estudiante (>3 faltas)' : 'estudiantes (>3 faltas)'}
                              </span>
                            </div>
                            <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 mt-1 leading-relaxed">
                              Alumnos que han superado el umbral preventivo de 3 inasistencias acumuladas en {currentCourse.name}.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setIsAbsenceAlertExpanded(!isAbsenceAlertExpanded)}
                            className="px-2 py-1 rounded text-[11px] font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors flex items-center gap-0.5"
                            aria-expanded={isAbsenceAlertExpanded}
                          >
                            <span>{isAbsenceAlertExpanded ? 'Ocultar' : 'Ver detalle'}</span>
                            <span className="material-symbols-outlined text-[16px]">
                              {isAbsenceAlertExpanded ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsAbsenceAlertDismissed(true)}
                            className="w-7 h-7 rounded flex items-center justify-center text-amber-700/70 hover:text-amber-900 dark:text-amber-400/70 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                            title="Minimizar aviso"
                            aria-label="Cerrar aviso temporalmente"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        </div>
                      </div>

                      {/* Detalle expandible con listado de estudiantes y sus inasistencias */}
                      {isAbsenceAlertExpanded && (
                        <div className="mt-2.5 pt-2.5 border-t border-amber-200 dark:border-amber-800/60 space-y-1.5 animate-in fade-in">
                          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                            {studentsWithExcessiveAbsences.map(({ student, absentCount }) => (
                              <div 
                                key={student.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-white/90 dark:bg-amber-950/50 text-[11px] border border-amber-200/60 dark:border-amber-900/50"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                  <div className="min-w-0">
                                    <span className="font-semibold text-slate-900 dark:text-white truncate block">
                                      {student.name}
                                    </span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                      {student.code || `ID-${student.id}`}
                                    </span>
                                  </div>
                                </div>
                                <span className="font-mono font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/60 shrink-0 ml-2">
                                  {absentCount} inasistencias
                                </span>
                              </div>
                            ))}
                          </div>
                          
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-amber-800/80 dark:text-amber-400 font-mono">
                              Normativa institucional: más de 3 faltas amerita reporte a jefatura docente.
                            </span>
                            <button
                              type="button"
                              onClick={() => setAttendanceFilter('critical')}
                              className="text-[10.5px] font-mono font-bold text-amber-900 dark:text-amber-200 hover:underline flex items-center gap-1"
                            >
                              <span>Filtrar estos estudiantes en la lista</span>
                              <span className="material-symbols-outlined text-[13px]">filter_list</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </aside>
                  )}

                  {/* Acción Rápida Ergonómica: Todos Presentes */}
                  <button
                    type="button"
                    onClick={markAllPresent}
                    className="w-full min-h-[48px] bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-xl flex items-center justify-center gap-2 font-serif font-bold text-xs shadow-sm active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[20px]">done_all</span>
                    <span>Todos Presentes (1-Tap Canónico)</span>
                  </button>

                  {/* Gráfico de Tendencia */}
                  <AttendanceTrendChart attendanceRecords={attendanceRecords} />

                  {/* Filtros Rápidos por Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setAttendanceFilter('all')}
                      className={`min-h-[42px] px-3.5 py-1 rounded-full font-mono text-xs font-bold whitespace-nowrap active:scale-95 transition-all ${
                        attendanceFilter === 'all'
                          ? 'bg-blue-900 dark:bg-blue-700 text-white shadow-xs'
                          : 'bg-white dark:bg-[#0f172a] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      Todos ({totalCount})
                    </button>
                    {studentsWithExcessiveAbsences.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAttendanceFilter(attendanceFilter === 'critical' ? 'all' : 'critical')}
                        className={`min-h-[42px] px-3 py-1 rounded-full font-mono text-xs whitespace-nowrap active:scale-95 transition-all flex items-center gap-1 ${
                          attendanceFilter === 'critical'
                            ? 'bg-rose-700 text-white font-bold shadow-xs'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 font-semibold'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">warning</span>
                        <span>&gt;3 Faltas ({studentsWithExcessiveAbsences.length})</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAttendanceFilter('A')}
                      className={`min-h-[42px] px-3.5 py-1 rounded-full font-mono text-xs whitespace-nowrap active:scale-95 transition-all ${
                        attendanceFilter === 'A'
                          ? 'bg-rose-700 text-white font-bold shadow-xs'
                          : 'bg-white dark:bg-[#0f172a] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      Ausentes ({countA})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendanceFilter('T')}
                      className={`min-h-[42px] px-3.5 py-1 rounded-full font-mono text-xs whitespace-nowrap active:scale-95 transition-all ${
                        attendanceFilter === 'T'
                          ? 'bg-amber-600 text-white font-bold shadow-xs'
                          : 'bg-white dark:bg-[#0f172a] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      Tardanzas ({countT})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendanceFilter('J')}
                      className={`min-h-[42px] px-3.5 py-1 rounded-full font-mono text-xs whitespace-nowrap active:scale-95 transition-all ${
                        attendanceFilter === 'J'
                          ? 'bg-purple-700 text-white font-bold shadow-xs'
                          : 'bg-white dark:bg-[#0f172a] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      Justificados ({countJ})
                    </button>
                  </div>

                  {/* Lista Roster de Estudiantes */}
                  <div className="space-y-2">
                    {filteredRoster.map(({ student, status, note }, index) => {
                      const totalAbsences = studentAbsenceMap.get(student.id!) || 0;
                      const hasExcessiveAbsences = totalAbsences > 3;

                      return (
                        <StudentAttendanceCard
                          key={`${student.id}-${selectedDate}-${attendanceFilter}`}
                          index={index}
                          animationKey={`${selectedDate}-${attendanceFilter}`}
                          student={student}
                          status={status}
                          note={note}
                          modality={currentCourse.modality}
                          totalAbsences={totalAbsences}
                          hasExcessiveAbsences={hasExcessiveAbsences}
                          onStatusChange={(newStatus) => markAttendance(student.id!, newStatus)}
                          onNoteChange={(newNote) => handleUpdateStudentNote(student.id!, newNote)}
                        />
                      );
                    })}

                    {filteredRoster.length === 0 && (
                      <div className="bg-white dark:bg-[#0f172a] p-6 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 font-mono">
                        No hay alumnos que coincidan con el filtro seleccionado.
                      </div>
                    )}
                  </div>

                  {/* Botón Guardar Sesión con Feedback Inmediato */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSaveAttendanceSnapshot}
                      className="w-full min-h-[50px] bg-blue-900 hover:bg-blue-800 dark:bg-blue-700 text-white rounded-xl flex items-center justify-between px-4 shadow-md active:scale-95 transition-transform border border-blue-400/20"
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[20px] text-amber-300">save</span>
                        <span className="font-serif font-bold text-xs sm:text-sm">Guardar Registro de Asistencia</span>
                      </div>
                      <div className="flex items-center gap-1 bg-blue-950/70 px-2.5 py-1 rounded-md font-mono text-[11px] text-amber-300">
                        <span className="material-symbols-outlined text-[13px]">check</span>
                        <span>Guardar</span>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===================================================== */}
          {/* PESTAÑA 3: EVALUADOR (MODO EVALUACIÓN CANÓNICO)       */}
          {/* ===================================================== */}
          {navTab === 'evaluador' && currentCourse && (
            <EvaluationMode
              course={currentCourse}
              semester={currentSemester}
              evaluations={evaluations}
              students={students}
              grades={grades}
              onClose={() => setNavTab('asignaturas')}
            />
          )}

          {/* ===================================================== */}
          {/* PESTAÑA 4: ACTAS Y ARCHIVOS (IMPORTAR Y EXPORTAR)     */}
          {/* ===================================================== */}
          {navTab === 'archivos' && currentCourse && (
            <ArchivosScreen
              course={currentCourse}
              semester={currentSemester}
              students={students}
              attendanceRecords={attendanceRecords}
              evaluations={evaluations}
              grades={grades}
              courses={courses}
              onSelectCourse={(id) => setSelectedCourseId(id)}
              onImportStudents={handleImportStudents}
              onExportNotice={(msg) => showToast(msg)}
              onNavigateToAttendanceDate={(date) => {
                setSelectedDate(date);
                setNavTab('asistencia');
              }}
            />
          )}
        </div>
      </main>

      {/* ========================================================= */}
      {/* BARRA DE NAVEGACIÓN INFERIOR (SOBRIEDAD Y ERGONOMÍA)      */}
      {/* ========================================================= */}
      <nav className="fixed bottom-0 inset-x-0 z-40 pb-safe bg-white/95 dark:bg-[#0d1527]/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800/90 shadow-[0_-2px_12px_rgba(0,0,0,0.04)] transition-colors duration-300">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
          {/* Cátedras */}
          <button
            type="button"
            onClick={() => setNavTab('asignaturas')}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[48px] active:scale-95 transition-all ${
              navTab === 'asignaturas'
                ? 'text-blue-900 dark:text-amber-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-blue-900 dark:hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[23px]">menu_book</span>
            <span className="text-[11px] font-sans tracking-tight">Cátedras</span>
          </button>

          {/* Asistencia */}
          <button
            type="button"
            onClick={() => setNavTab('asistencia')}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[48px] active:scale-95 transition-all ${
              navTab === 'asistencia'
                ? 'text-blue-900 dark:text-amber-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-blue-900 dark:hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[23px]">how_to_reg</span>
            <span className="text-[11px] font-sans tracking-tight">Asistencia</span>
          </button>

          {/* Evaluador */}
          <button
            type="button"
            onClick={() => setNavTab('evaluador')}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[48px] active:scale-95 transition-all ${
              navTab === 'evaluador'
                ? 'text-blue-900 dark:text-amber-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-blue-900 dark:hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[23px]">grading</span>
            <span className="text-[11px] font-sans tracking-tight">Evaluador</span>
          </button>

          {/* Actas */}
          <button
            type="button"
            onClick={() => setNavTab('archivos')}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[48px] active:scale-95 transition-all ${
              navTab === 'archivos'
                ? 'text-blue-900 dark:text-amber-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-blue-900 dark:hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[23px]">folder_special</span>
            <span className="text-[11px] font-sans tracking-tight">Actas</span>
          </button>
        </div>
      </nav>

      {/* ========================================================= */}
      {/* MODALES: CREAR SEMESTRE Y CREAR CÁTEDRA                  */}
      {/* ========================================================= */}
      <Modal
        isOpen={isSemesterModalOpen}
        onClose={() => setIsSemesterModalOpen(false)}
        title="Aperturar Período Académico"
      >
        <form onSubmit={handleCreateSemester} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase mb-1">
              Denominación del Semestre
            </label>
            <input
              type="text"
              value={semesterName}
              onChange={(e) => setSemesterName(e.target.value)}
              placeholder="Ej: 2026-I, 2026-II"
              className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-[#0f172a] focus:outline-hidden"
              autoFocus
              required
            />
          </div>

          {semesters.length > 0 && (
            <div className="pt-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-2">
                Períodos Registrados
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {semesters.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs">
                    <span className="font-serif font-bold text-slate-900 dark:text-white">{s.name}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSemesterId(s.id!);
                          setIsSemesterModalOpen(false);
                        }}
                        className="px-2 py-0.5 rounded bg-blue-900 dark:bg-blue-700 text-white text-[10px] font-mono font-bold"
                      >
                        Activar
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSemester(s.id!, e)}
                        className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 p-1 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsSemesterModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-blue-900 dark:bg-blue-700 rounded-xl shadow-xs"
            >
              Guardar Período
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        title={`Inscribir Cátedra (${courseModality})`}
      >
        <form onSubmit={handleCreateCourse} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase mb-1">
              Nombre de la Asignatura
            </label>
            <input
              type="text"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="Ej: Algoritmos y Estructuras de Datos"
              className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-[#0f172a] focus:outline-hidden"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase mb-1">
              Código / Aula Canónica
            </label>
            <input
              type="text"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              placeholder="Ej: INF-301 • Aula Magna 302"
              className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-mono text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-[#0f172a] focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase mb-1">
              Modalidad de Cátedra
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCourseModality('CD')}
                className={`py-2.5 rounded-xl font-medium text-xs border transition-all ${
                  courseModality === 'CD'
                    ? 'bg-blue-900 dark:bg-blue-700 text-white border-blue-900 dark:border-blue-700 font-bold shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                Curso Diurno (CD)
              </button>
              <button
                type="button"
                onClick={() => setCourseModality('CPE')}
                className={`py-2.5 rounded-xl font-medium text-xs border transition-all ${
                  courseModality === 'CPE'
                    ? 'bg-amber-600 dark:bg-amber-600 text-white border-amber-600 font-bold shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                Por Encuentro (CPE)
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              Máximo 5 cátedras por modalidad en el semestre seleccionado.
            </p>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCourseModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-blue-900 dark:bg-blue-700 rounded-xl shadow-xs"
            >
              Inscribir Cátedra
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
