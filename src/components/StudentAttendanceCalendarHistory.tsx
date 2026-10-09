import React, { useState, useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths, 
  parseISO 
} from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  UserX, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  ArrowRight,
  Filter,
  Users
} from 'lucide-react';
import type { Course, Student, Attendance } from '../db';

interface StudentAttendanceCalendarHistoryProps {
  course: Course;
  students: Student[];
  attendanceRecords: Attendance[];
  initialSelectedStudentId?: number;
  onNavigateToAttendanceDate?: (date: string) => void;
}

export const StudentAttendanceCalendarHistory: React.FC<StudentAttendanceCalendarHistoryProps> = ({
  course,
  students,
  attendanceRecords,
  initialSelectedStudentId,
  onNavigateToAttendanceDate
}) => {
  // Búsqueda y filtrado de estudiantes
  const [searchTerm, setSearchTerm] = useState('');
  const [studentRosterFilter, setStudentRosterFilter] = useState<'all' | 'absences' | 'critical' | 'excused'>('all');

  // Mapa de inasistencias por estudiante
  const studentMetricsMap = useMemo(() => {
    const map = new Map<number, {
      absences: number;
      excused: number;
      late: number;
      present: number;
      total: number;
      notesCount: number;
    }>();

    students.forEach(st => {
      map.set(st.id!, { absences: 0, excused: 0, late: 0, present: 0, total: 0, notesCount: 0 });
    });

    attendanceRecords.forEach(rec => {
      const current = map.get(rec.studentId);
      if (current) {
        current.total += 1;
        if (rec.status === 'absent') current.absences += 1;
        else if (rec.status === 'excused') current.excused += 1;
        else if (rec.status === 'late') current.late += 1;
        else if (rec.status === 'present') current.present += 1;

        if (rec.note && rec.note.trim().length > 0) {
          current.notesCount += 1;
        }
      }
    });

    return map;
  }, [students, attendanceRecords]);

  // Filtrado de lista de estudiantes
  const filteredStudents = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return students.filter(st => {
      const matchesSearch = 
        st.name.toLowerCase().includes(term) || 
        (st.code && st.code.toLowerCase().includes(term));
      if (!matchesSearch) return false;

      const metrics = studentMetricsMap.get(st.id!) || { absences: 0, excused: 0, late: 0, present: 0, total: 0, notesCount: 0 };
      if (studentRosterFilter === 'absences') return metrics.absences > 0;
      if (studentRosterFilter === 'critical') return metrics.absences > 3;
      if (studentRosterFilter === 'excused') return metrics.excused > 0;
      return true;
    });
  }, [students, searchTerm, studentRosterFilter, studentMetricsMap]);

  // Estudiante seleccionado actualmente
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(() => {
    if (initialSelectedStudentId && students.some(s => s.id === initialSelectedStudentId)) {
      return initialSelectedStudentId;
    }
    // Preferir seleccionar inicialmente a un alumno con faltas o justificaciones para visualizar datos de inmediato
    const studentWithAbsence = students.find(s => {
      const m = studentMetricsMap.get(s.id!);
      return m && (m.absences > 0 || m.excused > 0);
    });
    return studentWithAbsence?.id ?? students[0]?.id ?? null;
  });

  const selectedStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  // Registros del estudiante seleccionado
  const studentRecords = useMemo(() => {
    if (!selectedStudentId) return [];
    return attendanceRecords.filter(a => a.studentId === selectedStudentId);
  }, [attendanceRecords, selectedStudentId]);

  // Mapa de fechas a registro para acceso O(1)
  const dateRecordMap = useMemo(() => {
    const map = new Map<string, Attendance>();
    studentRecords.forEach(rec => {
      map.set(rec.date, rec);
    });
    return map;
  }, [studentRecords]);

  // Meses disponibles con clases para salto rápido
  const availableRecordMonths = useMemo(() => {
    const set = new Set<string>();
    studentRecords.forEach(r => {
      if (r.date && r.date.length >= 7) {
        set.add(r.date.substring(0, 7));
      }
    });
    const currentMonth = format(new Date(), 'yyyy-MM');
    set.add(currentMonth);
    return Array.from(set).sort().reverse();
  }, [studentRecords]);

  // Estado del calendario mensual
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    // Si el alumno tiene inasistencias pasadas, situar el calendario en la fecha de la inasistencia más reciente
    const mostRecentAbsence = studentRecords
      .filter(r => r.status === 'absent' || r.status === 'excused')
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    if (mostRecentAbsence?.date) {
      try {
        return parseISO(mostRecentAbsence.date);
      } catch {
        return new Date();
      }
    }
    return new Date();
  });

  // Día inspeccionado en el calendario (por defecto el día de la última falta o hoy)
  const [inspectedDate, setInspectedDate] = useState<string>(() => {
    const mostRecentAbsence = studentRecords
      .filter(r => r.status === 'absent' || r.status === 'excused')
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return mostRecentAbsence?.date || format(new Date(), 'yyyy-MM-dd');
  });

  // Días que se renderizan en el mes del calendario
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonthDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Empieza el lunes
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonthDate]);

  // Historial cronológico de incidencias (Faltas y Justificaciones)
  const [incidentFilter, setIncidentFilter] = useState<'all' | 'absences' | 'excused'>('all');
  const pastIncidents = useMemo(() => {
    return studentRecords
      .filter(r => {
        if (incidentFilter === 'absences') return r.status === 'absent';
        if (incidentFilter === 'excused') return r.status === 'excused';
        return r.status === 'absent' || r.status === 'excused' || r.status === 'late';
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [studentRecords, incidentFilter]);

  // Métricas del estudiante activo
  const currentMetrics = useMemo(() => {
    if (!selectedStudentId) {
      return { absences: 0, excused: 0, late: 0, present: 0, total: 0, notesCount: 0 };
    }
    return studentMetricsMap.get(selectedStudentId) || {
      absences: 0,
      excused: 0,
      late: 0,
      present: 0,
      total: 0,
      notesCount: 0
    };
  }, [selectedStudentId, studentMetricsMap]);

  const attendancePercentage = currentMetrics.total > 0
    ? Math.round(((currentMetrics.present + currentMetrics.excused + (currentMetrics.late * 0.5)) / currentMetrics.total) * 100)
    : 100;

  // Manejo de navegación del mes
  const handlePrevMonth = () => setCurrentMonthDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonthDate(prev => addMonths(prev, 1));
  const handleTodayMonth = () => {
    const now = new Date();
    setCurrentMonthDate(now);
    setInspectedDate(format(now, 'yyyy-MM-dd'));
  };

  const handleJumpToMonth = (monthStr: string) => {
    try {
      const [year, mon] = monthStr.split('-');
      setCurrentMonthDate(new Date(parseInt(year, 10), parseInt(mon, 10) - 1, 1));
    } catch {
      // Ignored
    }
  };

  const inspectedRecord = dateRecordMap.get(inspectedDate);

  if (students.length === 0) {
    return (
      <div className="bg-white dark:bg-[#0f172a] rounded-xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
        <Users className="w-12 h-12 text-slate-400 mx-auto stroke-1" />
        <h3 className="font-serif font-bold text-lg text-slate-800 dark:text-slate-200">
          Nómina de Estudiantes Vacía
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          Para ver el historial de asistencia y calendario interactivo, primero importa o añade estudiantes a esta cátedra en la pestaña <span className="font-semibold text-blue-900 dark:text-amber-400">2. Importar Nómina</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      
      {/* ======================================================== */}
      {/* 1. SELECCIÓN RÁPIDA DE ESTUDIANTE DE LA NÓMINA            */}
      {/* ======================================================== */}
      <section className="bg-white dark:bg-[#0f172a] rounded-xl p-4 academic-border border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Auditoría Individual de Asistencia</span>
            </div>
            <h2 className="font-serif font-bold text-base text-slate-900 dark:text-white leading-tight">
              Historial y Calendario por Estudiante
            </h2>
          </div>

          {/* Filtros rápidos de nómina */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-[11px] font-mono font-semibold">
            <button
              type="button"
              onClick={() => setStudentRosterFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 ${
                studentRosterFilter === 'all'
                  ? 'bg-blue-900 dark:bg-blue-700 text-white font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Todos ({students.length})
            </button>
            <button
              type="button"
              onClick={() => setStudentRosterFilter('absences')}
              className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 flex items-center gap-1 ${
                studentRosterFilter === 'absences'
                  ? 'bg-rose-700 dark:bg-rose-800 text-white font-bold'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
              }`}
            >
              Con Faltas
            </button>
            <button
              type="button"
              onClick={() => setStudentRosterFilter('critical')}
              className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 flex items-center gap-1 ${
                studentRosterFilter === 'critical'
                  ? 'bg-amber-600 dark:bg-amber-700 text-white font-bold'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-100'
              }`}
            >
              Críticos &gt; 3
            </button>
            <button
              type="button"
              onClick={() => setStudentRosterFilter('excused')}
              className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 flex items-center gap-1 ${
                studentRosterFilter === 'excused'
                  ? 'bg-purple-700 dark:bg-purple-800 text-white font-bold'
                  : 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 hover:bg-purple-100'
              }`}
            >
              Justificados
            </button>
          </div>
        </div>

        {/* Buscador de estudiante */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre o matrícula de estudiante..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-[#080d1a] border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 font-sans"
          />
        </div>

        {/* Selector de estudiante con scroll horizontal o lista desplegable */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-bold uppercase text-slate-400">
            Selecciona un estudiante ({filteredStudents.length} resultados):
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            {filteredStudents.map(st => {
              const metrics = studentMetricsMap.get(st.id!) || { absences: 0, excused: 0, late: 0, present: 0, total: 0, notesCount: 0 };
              const isSelected = st.id === selectedStudentId;
              const isCritical = metrics.absences > 3;

              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setSelectedStudentId(st.id!);
                    // Si el estudiante seleccionado tiene registros, situar el calendario en su fecha más reciente
                    const studentRecent = attendanceRecords
                      .filter(a => a.studentId === st.id! && (a.status === 'absent' || a.status === 'excused'))
                      .sort((a, b) => b.date.localeCompare(a.date))[0];
                    if (studentRecent?.date) {
                      try {
                        setCurrentMonthDate(parseISO(studentRecent.date));
                        setInspectedDate(studentRecent.date);
                      } catch {
                        // Ignored
                      }
                    }
                  }}
                  className={`text-left p-2.5 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-blue-50/90 dark:bg-blue-950/80 border-blue-600 dark:border-blue-500 shadow-xs ring-1 ring-blue-500'
                      : isCritical
                        ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 hover:border-rose-400'
                        : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold whitespace-normal break-words ${isSelected ? 'text-blue-900 dark:text-blue-200 font-bold' : 'text-slate-900 dark:text-slate-100'}`}>
                      {st.name}
                    </p>
                    <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      {st.code || 'Matrícula S/N'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {metrics.absences > 0 && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                        isCritical
                          ? 'bg-rose-600 text-white'
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                      }`}>
                        {metrics.absences} {metrics.absences === 1 ? 'falta' : 'faltas'}
                      </span>
                    )}
                    {metrics.excused > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                        {metrics.excused} J
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {filteredStudents.length === 0 && (
              <div className="col-span-full py-4 text-center text-xs text-slate-400 font-mono">
                No se encontraron estudiantes con los criterios indicados.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 2. FICHA Y RESUMEN ACADÉMICO DEL ESTUDIANTE SELECCIONADO */}
      {/* ======================================================== */}
      {selectedStudent && (
        <section className="bg-white dark:bg-[#0f172a] rounded-xl p-4 academic-border border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-serif text-lg font-bold shrink-0 border ${
                currentMetrics.absences > 3
                  ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                  : 'bg-blue-100 dark:bg-blue-950/80 text-blue-900 dark:text-amber-400 border-blue-200 dark:border-blue-900'
              }`}>
                {selectedStudent.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white leading-tight">
                    {selectedStudent.name}
                  </h3>
                  {currentMetrics.absences > 3 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 text-[10px] font-mono font-bold border border-rose-300 dark:border-rose-800">
                      <AlertTriangle className="w-3 h-3" />
                      Riesgo Crítico (&gt;3 inasistencias)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  Matrícula: {selectedStudent.code || 'S/N'} • Cátedra: {course.name} ({course.modality})
                </p>
              </div>
            </div>

            {/* Porcentaje General */}
            <div className="flex sm:flex-col items-center sm:items-end justify-between bg-slate-50 dark:bg-[#080d1a] p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shrink-0">
              <span className="text-[10px] font-mono uppercase text-slate-400">
                Asistencia Ponderada
              </span>
              <span className={`text-xl font-serif font-bold ${
                attendancePercentage < 75 
                  ? 'text-rose-700 dark:text-rose-400' 
                  : attendancePercentage < 85 
                    ? 'text-amber-700 dark:text-amber-400' 
                    : 'text-emerald-700 dark:text-emerald-400'
              }`}>
                {attendancePercentage}%
              </span>
            </div>
          </div>

          {/* Tarjetas de Métricas de Asistencia */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-lg bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60">
              <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 mb-1">
                <span className="text-[10px] font-mono uppercase font-bold">Faltas (A)</span>
                <UserX className="w-4 h-4" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-serif font-bold text-rose-900 dark:text-rose-200">
                  {currentMetrics.absences}
                </span>
                <span className="text-[10.5px] font-mono text-rose-600 dark:text-rose-400">
                  {currentMetrics.absences === 1 ? 'sesión' : 'sesiones'}
                </span>
              </div>
              <p className="text-[9.5px] font-sans text-rose-700/80 dark:text-rose-400/80 mt-1">
                Inasistencias injustificadas
              </p>
            </div>

            <div className="p-3 rounded-lg bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60">
              <div className="flex items-center justify-between text-purple-700 dark:text-purple-400 mb-1">
                <span className="text-[10px] font-mono uppercase font-bold">Justificadas (J)</span>
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-serif font-bold text-purple-900 dark:text-purple-200">
                  {currentMetrics.excused}
                </span>
                <span className="text-[10.5px] font-mono text-purple-600 dark:text-purple-400">
                  {currentMetrics.excused === 1 ? 'sesión' : 'sesiones'}
                </span>
              </div>
              <p className="text-[9.5px] font-sans text-purple-700/80 dark:text-purple-400/80 mt-1">
                Permisos o justificaciones
              </p>
            </div>

            <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-1">
                <span className="text-[10px] font-mono uppercase font-bold">Tardanzas (T)</span>
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-serif font-bold text-amber-900 dark:text-amber-200">
                  {currentMetrics.late}
                </span>
                <span className="text-[10.5px] font-mono text-amber-600 dark:text-amber-400">
                  {currentMetrics.late === 1 ? 'sesión' : 'sesiones'}
                </span>
              </div>
              <p className="text-[9.5px] font-sans text-amber-700/80 dark:text-amber-400/80 mt-1">
                Llegadas fuera de hora
              </p>
            </div>

            <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1">
                <span className="text-[10px] font-mono uppercase font-bold">Presentes (P)</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-serif font-bold text-emerald-900 dark:text-emerald-200">
                  {currentMetrics.present}
                </span>
                <span className="text-[10.5px] font-mono text-emerald-600 dark:text-emerald-400">
                  / {currentMetrics.total} tot.
                </span>
              </div>
              <p className="text-[9.5px] font-sans text-emerald-700/80 dark:text-emerald-400/80 mt-1">
                Asistencia puntual
              </p>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 3. CALENDARIO INTERACTIVO DE ASISTENCIA                  */}
          {/* ======================================================== */}
          <div className="pt-2">
            <div className="bg-slate-50/80 dark:bg-[#080d1a] rounded-xl p-4 border border-slate-200 dark:border-slate-800">
              
              {/* Cabecera del Calendario: Navegación de Mes */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                      title="Mes anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                      title="Mes siguiente"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <h4 className="font-serif font-bold text-base text-slate-900 dark:text-white capitalize">
                    {format(currentMonthDate, 'MMMM yyyy', { locale: es })}
                  </h4>

                  <button
                    type="button"
                    onClick={handleTodayMonth}
                    className="px-2 py-0.5 rounded text-[10.5px] font-mono font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-900"
                  >
                    Hoy
                  </button>
                </div>

                {/* Salto directo de mes */}
                {availableRecordMonths.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                      Ir a mes con datos:
                    </span>
                    <select
                      value={format(currentMonthDate, 'yyyy-MM')}
                      onChange={(e) => handleJumpToMonth(e.target.value)}
                      className="text-xs font-mono font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-slate-800 dark:text-slate-200"
                    >
                      {availableRecordMonths.map(m => {
                        try {
                          const [y, mon] = m.split('-');
                          const d = new Date(parseInt(y, 10), parseInt(mon, 10) - 1, 1);
                          return (
                            <option key={m} value={m}>
                              {format(d, 'MMM yyyy', { locale: es })}
                            </option>
                          );
                        } catch {
                          return <option key={m} value={m}>{m}</option>;
                        }
                      })}
                    </select>
                  </div>
                )}
              </div>

              {/* Días de la semana */}
              <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11px] font-bold text-slate-400 pb-2 border-b border-slate-200/60 dark:border-slate-800">
                <span>Lun</span>
                <span>Mar</span>
                <span>Mié</span>
                <span>Jue</span>
                <span>Vie</span>
                <span>Sáb</span>
                <span>Dom</span>
              </div>

              {/* Matriz del Calendario */}
              <div className="grid grid-cols-7 gap-1.5 pt-2">
                {calendarDays.map((day) => {
                  const dayKey = format(day, 'yyyy-MM-dd');
                  const isCurrentMonth = isSameMonth(day, currentMonthDate);
                  const isToday = isSameDay(day, new Date());
                  const record = dateRecordMap.get(dayKey);
                  const isInspected = inspectedDate === dayKey;

                  let statusBg = 'bg-white dark:bg-[#0f172a] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800';
                  let statusTag = '';

                  if (record) {
                    if (record.status === 'absent') {
                      statusBg = 'bg-rose-100 dark:bg-rose-950/90 text-rose-900 dark:text-rose-200 border-rose-400 dark:border-rose-700 font-bold shadow-xs';
                      statusTag = 'A';
                    } else if (record.status === 'excused') {
                      statusBg = 'bg-purple-100 dark:bg-purple-950/90 text-purple-900 dark:text-purple-200 border-purple-400 dark:border-purple-700 font-bold shadow-xs';
                      statusTag = 'J';
                    } else if (record.status === 'late') {
                      statusBg = 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-400 dark:border-amber-700 font-semibold';
                      statusTag = 'T';
                    } else if (record.status === 'present') {
                      statusBg = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60';
                      statusTag = 'P';
                    }
                  }

                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => setInspectedDate(dayKey)}
                      className={`relative min-h-[50px] sm:min-h-[58px] p-1 rounded-lg border flex flex-col justify-between items-center transition-all ${statusBg} ${
                        !isCurrentMonth ? 'opacity-35' : ''
                      } ${
                        isInspected
                          ? 'ring-2 ring-blue-600 dark:ring-blue-400 scale-[1.03] z-10'
                          : 'hover:border-blue-400'
                      }`}
                    >
                      <div className="w-full flex items-center justify-between text-[11px] font-mono leading-none">
                        <span className={`${isToday ? 'font-bold underline text-blue-800 dark:text-amber-400' : ''}`}>
                          {format(day, 'd')}
                        </span>
                        {record?.note && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-amber-400" title="Tiene nota registrada" />
                        )}
                      </div>

                      {/* Indicador de Asistencia */}
                      {statusTag && (
                        <div className="w-full flex items-center justify-center">
                          <span className={`text-[10px] sm:text-[11px] font-mono font-bold px-1.5 py-0.2 rounded ${
                            statusTag === 'A'
                              ? 'bg-rose-600 text-white'
                              : statusTag === 'J'
                                ? 'bg-purple-600 text-white'
                                : statusTag === 'T'
                                  ? 'bg-amber-500 text-white'
                                  : 'text-emerald-700 dark:text-emerald-300 font-bold'
                          }`}>
                            {statusTag}
                          </span>
                        </div>
                      )}

                      {!statusTag && (
                        <span className="text-[9px] text-slate-300 dark:text-slate-700 font-mono">
                          -
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Leyenda del Calendario */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-200/60 dark:border-slate-800 text-[10.5px] font-mono">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-rose-600 text-white flex items-center justify-center font-bold text-[9px]">A</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Falta (Inasistencia)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-purple-600 text-white flex items-center justify-center font-bold text-[9px]">J</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Justificada</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-amber-500 text-white flex items-center justify-center font-bold text-[9px]">T</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Tardanza</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-emerald-600 text-white flex items-center justify-center font-bold text-[9px]">P</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Presente</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-amber-400 inline-block" />
                  <span>Punto azul = Tiene observación de sesión</span>
                </div>
              </div>

              {/* ======================================================== */}
              {/* DETALLE DE LA FECHA INSPECCIONADA EN EL CALENDARIO       */}
              {/* ======================================================== */}
              <div className="mt-3 p-3.5 bg-white dark:bg-[#0f172a] rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-[9.5px] font-mono uppercase font-bold text-slate-400 block">
                      Sesión Inspeccionada:
                    </span>
                    <h5 className="font-serif font-bold text-sm text-slate-900 dark:text-white capitalize">
                      {(() => {
                        try {
                          return format(parseISO(inspectedDate), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
                        } catch {
                          return inspectedDate;
                        }
                      })()}
                    </h5>
                  </div>

                  {inspectedRecord ? (
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 ${
                        inspectedRecord.status === 'absent'
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                          : inspectedRecord.status === 'excused'
                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-800'
                            : inspectedRecord.status === 'late'
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                      }`}>
                        {inspectedRecord.status === 'absent' && 'Falta / Inasistencia (A)'}
                        {inspectedRecord.status === 'excused' && 'Inasistencia Justificada (J)'}
                        {inspectedRecord.status === 'late' && 'Tardanza Registrada (T)'}
                        {inspectedRecord.status === 'present' && 'Asistencia Presente (P)'}
                      </span>

                      {onNavigateToAttendanceDate && (
                        <button
                          type="button"
                          onClick={() => onNavigateToAttendanceDate(inspectedDate)}
                          className="px-2 py-1 rounded text-[11px] font-mono font-bold bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-900 flex items-center gap-1 transition-colors"
                          title="Abrir esta sesión en la pestaña Asistencia para editar"
                        >
                          <span>Ver en Asistencia</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400 italic">
                        No hay sesión tomada en esta fecha
                      </span>
                      {onNavigateToAttendanceDate && (
                        <button
                          type="button"
                          onClick={() => onNavigateToAttendanceDate(inspectedDate)}
                          className="px-2 py-1 rounded text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-center"
                        >
                          Tomar asistencia
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Nota / Justificación registrada */}
                <div className="pt-2">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block mb-1">
                    Observación o Motivo de Justificación:
                  </span>
                  {inspectedRecord?.note && inspectedRecord.note.trim().length > 0 ? (
                    <div className="p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/60 text-xs font-sans text-slate-800 dark:text-slate-200 flex items-start gap-2">
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <p className="italic leading-relaxed">
                        &ldquo;{inspectedRecord.note}&rdquo;
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 font-sans italic">
                      Sin observaciones ni notas adjuntas para esta sesión.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 4. HISTORIAL CRONOLÓGICO DE FALTAS Y JUSTIFICACIONES     */}
          {/* ======================================================== */}
          <div className="pt-2 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <h4 className="font-serif font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                  Bitácora de Inasistencias y Justificaciones Pasadas
                </h4>
                <span className="px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold">
                  {pastIncidents.length} registros
                </span>
              </div>

              {/* Filtro de la bitácora */}
              <div className="flex items-center gap-1 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setIncidentFilter('all')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    incidentFilter === 'all'
                      ? 'bg-blue-900 dark:bg-blue-700 text-white font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Todas ({currentMetrics.absences + currentMetrics.excused + currentMetrics.late})
                </button>
                <button
                  type="button"
                  onClick={() => setIncidentFilter('absences')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    incidentFilter === 'absences'
                      ? 'bg-rose-700 dark:bg-rose-800 text-white font-bold'
                      : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  Solo Faltas ({currentMetrics.absences})
                </button>
                <button
                  type="button"
                  onClick={() => setIncidentFilter('excused')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    incidentFilter === 'excused'
                      ? 'bg-purple-700 dark:bg-purple-800 text-white font-bold'
                      : 'bg-purple-50 dark:bg-purple-950 text-purple-800 dark:text-purple-300'
                  }`}
                >
                  Justificadas ({currentMetrics.excused})
                </button>
              </div>
            </div>

            {/* Lista cronológica */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {pastIncidents.map((inc) => {
                const isSelected = inspectedDate === inc.date;
                let dayLabel = inc.date;
                try {
                  dayLabel = format(parseISO(inc.date), "EEEE d 'de' MMMM, yyyy", { locale: es });
                } catch {
                  // Fallback
                }

                return (
                  <div
                    key={`${inc.studentId}-${inc.date}`}
                    onClick={() => {
                      setInspectedDate(inc.date);
                      try {
                        setCurrentMonthDate(parseISO(inc.date));
                      } catch {
                        // Ignored
                      }
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-blue-950/70 border-blue-500 shadow-xs'
                        : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="shrink-0 mt-0.5">
                        {inc.status === 'absent' && (
                          <span className="w-6 h-6 rounded-md bg-rose-600 text-white font-mono font-bold text-xs flex items-center justify-center">
                            A
                          </span>
                        )}
                        {inc.status === 'excused' && (
                          <span className="w-6 h-6 rounded-md bg-purple-600 text-white font-mono font-bold text-xs flex items-center justify-center">
                            J
                          </span>
                        )}
                        {inc.status === 'late' && (
                          <span className="w-6 h-6 rounded-md bg-amber-500 text-white font-mono font-bold text-xs flex items-center justify-center">
                            T
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-serif font-bold text-xs text-slate-900 dark:text-white capitalize">
                            {dayLabel}
                          </span>
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                            inc.status === 'absent'
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                              : inc.status === 'excused'
                                ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300'
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                          }`}>
                            {inc.status === 'absent' ? 'Inasistencia' : inc.status === 'excused' ? 'Justificada' : 'Tardanza'}
                          </span>
                        </div>

                        {inc.note && inc.note.trim().length > 0 ? (
                          <p className="text-xs text-slate-600 dark:text-slate-300 font-sans mt-0.5 italic line-clamp-2">
                            &ldquo;{inc.note}&rdquo;
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            Sin notas u observaciones
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 sm:self-center">
                      <span className="text-[10.5px] font-mono text-blue-800 dark:text-amber-400 font-semibold flex items-center gap-1">
                        Ver en calendario
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}

              {pastIncidents.length === 0 && (
                <div className="p-6 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-center space-y-1.5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  <p className="font-serif font-bold text-sm text-emerald-900 dark:text-emerald-200">
                    Sin inasistencias en este filtro
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-sans">
                    El alumno {selectedStudent.name} cuenta con un historial limpio en el período analizado.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
