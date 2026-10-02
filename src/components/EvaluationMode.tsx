import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  ChevronRight, 
  Trash2, 
  Award,
  Edit2,
  Check,
  X
} from 'lucide-react';
import { db, type Course, type Evaluation, type Grade, type Semester, type Student } from '../db';
import { Modal } from './Modal';

interface EvaluationModeProps {
  course: Course;
  semester?: Semester;
  evaluations: Evaluation[];
  students: Student[];
  grades: Grade[];
  onClose: () => void;
  onRefresh?: () => void;
}

export const EvaluationMode: React.FC<EvaluationModeProps> = ({
  course,
  semester,
  evaluations,
  students,
  grades,
  onClose
}) => {
  const [selectedEvalId, setSelectedEvalId] = useState<number | null>(
    evaluations.length > 0 ? evaluations[0].id! : null
  );
  const [viewStyle, setViewStyle] = useState<'list' | 'single'>('list');
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [isStepDrawerOpen, setIsStepDrawerOpen] = useState(false);
  const [keypadBuffer, setKeypadBuffer] = useState('');

  const [isNewEvalModalOpen, setIsNewEvalModalOpen] = useState(false);
  const [newEvalName, setNewEvalName] = useState('');
  const [newEvalMaxScore, setNewEvalMaxScore] = useState('20');

  const [isEditingEvalName, setIsEditingEvalName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');

  const currentEval = evaluations.find(e => e.id === selectedEvalId);
  const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name));

  // Current evaluation grade stats
  const currentEvalGrades = selectedEvalId
    ? grades.filter(g => g.evaluationId === selectedEvalId)
    : [];
  const gradedCount = currentEvalGrades.length;
  const gradedPct = students.length > 0 ? Math.round((gradedCount / students.length) * 100) : 0;
  
  const average = gradedCount > 0
    ? (currentEvalGrades.reduce((acc, g) => acc + g.score, 0) / gradedCount).toFixed(1)
    : '-';
  const highest = gradedCount > 0
    ? Math.max(...currentEvalGrades.map(g => g.score))
    : '-';
  const lowest = gradedCount > 0
    ? Math.min(...currentEvalGrades.map(g => g.score))
    : '-';

  const handleCreateEval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvalName.trim()) return;
    const maxScore = parseFloat(newEvalMaxScore) || 20;
    const id = await db.evaluations.add({
      courseId: course.id!,
      name: newEvalName.trim(),
      maxScore
    }) as number;
    setSelectedEvalId(id);
    setNewEvalName('');
    setIsNewEvalModalOpen(false);
  };

  const handleSaveEditedName = async () => {
    if (!currentEval || !editNameValue.trim()) {
      setIsEditingEvalName(false);
      return;
    }
    await db.evaluations.update(currentEval.id!, { name: editNameValue.trim() });
    setIsEditingEvalName(false);
  };

  const handleUpdateGrade = async (studentId: number, scoreVal: number | string, noteVal?: string) => {
    if (!selectedEvalId) return;

    if (scoreVal === '' || scoreVal === null || scoreVal === undefined) {
      const existing = await db.grades.where({ studentId, evaluationId: selectedEvalId }).first();
      if (existing) {
        if (noteVal !== undefined) {
          await db.grades.update(existing.id!, { notes: noteVal });
        } else {
          await db.grades.delete(existing.id!);
        }
      }
      return;
    }

    const numScore = typeof scoreVal === 'number' ? scoreVal : parseFloat(scoreVal);
    if (isNaN(numScore)) return;

    const max = currentEval?.maxScore || 20;
    const boundedScore = Math.min(Math.max(0, numScore), max);

    const existing = await db.grades.where({ studentId, evaluationId: selectedEvalId }).first();
    if (existing) {
      await db.grades.update(existing.id!, {
        score: boundedScore,
        notes: noteVal !== undefined ? noteVal : existing.notes
      });
    } else {
      await db.grades.add({
        studentId,
        evaluationId: selectedEvalId,
        score: boundedScore,
        notes: noteVal || ''
      });
    }
  };

  const handleUpdateNote = async (studentId: number, notes: string) => {
    if (!selectedEvalId) return;
    const existing = await db.grades.where({ studentId, evaluationId: selectedEvalId }).first();
    if (existing) {
      await db.grades.update(existing.id!, { notes });
    } else {
      await db.grades.add({
        studentId,
        evaluationId: selectedEvalId,
        score: 0,
        notes
      });
    }
  };

  const handleDeleteEvaluation = async (evalId: number) => {
    if (confirm(`¿Eliminar esta evaluación y todas sus calificaciones?`)) {
      await db.deleteEvaluationCascade(evalId);
      const remaining = evaluations.filter(e => e.id !== evalId);
      if (remaining.length > 0) {
        setSelectedEvalId(remaining[0].id!);
      } else {
        setSelectedEvalId(null);
      }
    }
  };

  const handleKeypadPress = (char: string) => {
    if (navigator.vibrate) navigator.vibrate(10);
    const activeStudent = sortedStudents[currentStudentIndex];
    if (!activeStudent) return;

    let nextBuffer = keypadBuffer;
    if (char === 'DEL') {
      nextBuffer = nextBuffer.slice(0, -1);
    } else {
      if (nextBuffer.length >= 2) nextBuffer = '';
      nextBuffer += char;
    }
    setKeypadBuffer(nextBuffer);

    let num = parseInt(nextBuffer, 10);
    if (isNaN(num)) num = 0;
    const max = currentEval?.maxScore || 20;
    if (num > max) num = max;

    handleUpdateGrade(activeStudent.id!, num);
  };

  const handleKeypadNext = () => {
    if (navigator.vibrate) navigator.vibrate(20);
    setKeypadBuffer('');
    if (currentStudentIndex < sortedStudents.length - 1) {
      setCurrentStudentIndex(prev => prev + 1);
    } else {
      setIsStepDrawerOpen(false);
    }
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in">
      {!currentEval ? (
        <div className="bg-white dark:bg-[#0f172a] rounded-xl p-8 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
          <div className="w-14 h-14 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 flex items-center justify-center mx-auto mb-3">
            <Award className="w-7 h-7" />
          </div>
          <h3 className="font-serif text-lg font-bold text-slate-900 dark:text-white mb-1">
            Sin evaluaciones registradas
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-5">
            Crea columnas para asentar calificaciones como <strong>"Evaluación 1"</strong>, <strong>"Prueba Parcial"</strong> o <strong>"Taller"</strong>.
          </p>
          <button
            onClick={() => setIsNewEvalModalOpen(true)}
            className="min-h-[48px] px-6 bg-blue-900 hover:bg-blue-800 dark:bg-blue-700 text-white rounded-xl text-xs font-bold active:scale-95 shadow-md transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Primera Evaluación</span>
          </button>
        </div>
      ) : (
        <>
          {/* Header Contextual de la Asignatura y Selector de Columna */}
          <section className="bg-white dark:bg-[#0f172a] rounded-xl p-4 academic-border border border-slate-200/70 dark:border-slate-800/80 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="material-symbols-outlined text-blue-700 dark:text-blue-400 text-[20px]">account_tree</span>
                <span className="font-serif font-bold text-sm text-slate-900 dark:text-white truncate">{course.name}</span>
              </div>
              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {course.modality}
              </span>
            </div>

            {/* Selector de Columna Activa (Excel) */}
            <div className="bg-slate-50 dark:bg-[#080d1a] rounded-lg p-2.5 flex items-center justify-between gap-2 border border-slate-200 dark:border-slate-800">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[10px] font-mono uppercase font-semibold">
                  <span>COLUMNA ACTIVA (ACTA EXCEL)</span>
                  <span className="material-symbols-outlined text-[13px] text-emerald-600 dark:text-emerald-400">file_download_done</span>
                </div>

                {isEditingEvalName ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      type="text"
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      className="flex-1 px-2 py-1 bg-white dark:bg-[#0f172a] text-xs font-bold text-blue-900 dark:text-blue-300 rounded border border-blue-600 focus:outline-hidden"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveEditedName}
                      className="p-1 rounded bg-emerald-600 text-white"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setIsEditingEvalName(false)}
                      className="p-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative flex items-center mt-0.5">
                    <select
                      value={selectedEvalId || ''}
                      onChange={(e) => {
                        if (e.target.value === 'new') {
                          setIsNewEvalModalOpen(true);
                        } else {
                          setSelectedEvalId(Number(e.target.value));
                        }
                      }}
                      className="w-full bg-transparent font-serif font-bold text-sm sm:text-base text-blue-900 dark:text-amber-300 appearance-none pr-6 focus:outline-hidden cursor-pointer truncate"
                    >
                      {evaluations.map(ev => (
                        <option key={ev.id} value={ev.id} className="bg-white dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 font-sans">
                          {ev.name} (Máx: {ev.maxScore || 20})
                        </option>
                      ))}
                      <option value="new" className="bg-white dark:bg-[#0f172a] text-blue-700 dark:text-blue-400 font-sans font-bold">
                        + Crear Nueva Evaluación...
                      </option>
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-0 text-slate-400 text-[18px]">
                      expand_more
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditNameValue(currentEval.name);
                    setIsEditingEvalName(true);
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-700 active:scale-95 transition-transform"
                  title="Editar nombre para exportación Excel"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteEvaluation(currentEval.id!)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 active:scale-95 transition-transform"
                  title="Eliminar evaluación"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Escala y Criterio */}
            <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <span className="flex items-center gap-1 font-mono">
                <span className="material-symbols-outlined text-[14px] text-emerald-600 dark:text-emerald-400">verified</span>
                <span>Escala: <strong>00 – {currentEval.maxScore || 20}</strong> (Mín. Aprobatorio: <strong>11</strong>)</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                2026-I Ordinario
              </span>
            </div>
          </section>

          {/* Tarjeta Ejecutiva de Desempeño (Navy & Gold Gradient) */}
          <section className="rounded-xl overflow-hidden bg-gradient-to-br from-[#0c1f4a] via-[#0f275e] to-[#071330] text-white p-4 academic-border shadow-md border-t border-blue-400/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-300 text-[18px]">monitoring</span>
                <span className="font-mono text-xs uppercase tracking-wider text-amber-300 font-bold">
                  Métricas del Grupo
                </span>
              </div>
              <span className="font-mono text-xs text-amber-200 font-bold">
                Calificados: {gradedCount} / {students.length} ({gradedPct}%)
              </span>
            </div>

            {/* Barra de Progreso */}
            <div className="w-full h-1.5 rounded-full bg-blue-950 overflow-hidden mb-3">
              <div
                className="h-full bg-amber-400 transition-all duration-300 rounded-full"
                style={{ width: `${gradedPct}%` }}
              />
            </div>

            {/* KPI Mini Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/[0.06] rounded-lg p-2 flex flex-col border border-white/10">
                <span className="text-[10px] uppercase font-mono text-slate-300">Promedio</span>
                <span className="font-serif font-bold text-xl text-amber-300 leading-tight">{average}</span>
              </div>
              <div className="bg-white/[0.06] rounded-lg p-2 flex flex-col border border-white/10">
                <span className="text-[10px] uppercase font-mono text-slate-300">Nota Máx.</span>
                <span className="font-serif font-bold text-xl text-emerald-300 leading-tight">{highest}</span>
              </div>
              <div className="bg-white/[0.06] rounded-lg p-2 flex flex-col border border-white/10">
                <span className="text-[10px] uppercase font-mono text-slate-300">Nota Mín.</span>
                <span className="font-serif font-bold text-xl text-rose-300 leading-tight">{lowest}</span>
              </div>
            </div>
          </section>

          {/* Conmutador de Modo de Vista */}
          <div className="flex p-1 bg-white dark:bg-[#0f172a] rounded-xl academic-border border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setViewStyle('list')}
              className={`flex-1 min-h-[44px] rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition-all ${
                viewStyle === 'list'
                  ? 'bg-blue-900 dark:bg-blue-700 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">view_list</span>
              <span>Lista Táctil</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewStyle('single');
                setIsStepDrawerOpen(true);
              }}
              className={`flex-1 min-h-[44px] rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition-all ${
                viewStyle === 'single'
                  ? 'bg-blue-900 dark:bg-blue-700 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">id_card</span>
              <span>Tarjeta x Alumno</span>
            </button>
          </div>

          {/* Lista de Estudiantes Roster */}
          <div className="space-y-2.5">
            {sortedStudents.map(student => {
              const gradeRecord = grades.find(
                g => g.studentId === student.id && g.evaluationId === currentEval.id
              );
              const score = gradeRecord !== undefined ? gradeRecord.score : null;
              const note = gradeRecord?.notes || '';
              const isPassed = score !== null && score >= 11;
              const isFailed = score !== null && score < 11;

              return (
                <article
                  key={student.id}
                  className="bg-white dark:bg-[#0f172a] rounded-xl p-3.5 academic-border border border-slate-200/80 dark:border-slate-800 flex flex-col gap-2.5 transition-all hover:border-blue-400/40"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-blue-900 dark:text-amber-400 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-serif font-bold text-sm shrink-0">
                        {student.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-serif font-bold text-sm text-slate-900 dark:text-white truncate">
                          {student.name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          <span>{student.code || `#${student.id}`}</span>
                          <span>•</span>
                          <span className={isFailed ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-emerald-700 dark:text-emerald-400 font-semibold'}>
                            {isFailed ? 'Riesgo académico' : 'Regular'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Grade Display Badge */}
                    <div
                      className={`min-w-[50px] h-10 rounded-lg flex items-center justify-center font-mono font-bold text-base shadow-xs ${
                        score === null
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                          : isPassed
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                      }`}
                    >
                      {score === null ? '—' : score < 10 ? `0${score}` : score}
                    </div>
                  </div>

                  {/* Botones de Ajuste Rápido (1-Touch, min-h-[48px]) */}
                  <div className="grid grid-cols-5 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleUpdateGrade(student.id!, (score || 0) - 1)}
                      className="min-h-[48px] rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono font-bold text-sm active:scale-95 transition-all flex items-center justify-center border border-slate-200 dark:border-slate-700"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateGrade(student.id!, (score || 0) + 1)}
                      className="min-h-[48px] rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono font-bold text-sm active:scale-95 transition-all flex items-center justify-center border border-slate-200 dark:border-slate-700"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateGrade(student.id!, 0)}
                      className="min-h-[48px] rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900 font-mono font-bold text-xs active:scale-95 transition-all flex items-center justify-center"
                    >
                      00
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateGrade(student.id!, 11)}
                      className="min-h-[48px] rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-900 font-mono font-bold text-xs active:scale-95 transition-all flex items-center justify-center"
                    >
                      11
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateGrade(student.id!, currentEval.maxScore || 20)}
                      className="min-h-[48px] rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 font-mono font-bold text-xs active:scale-95 transition-all flex items-center justify-center"
                    >
                      {currentEval.maxScore || 20}
                    </button>
                  </div>

                  {/* Quick Note Field */}
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#080d1a] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">note_alt</span>
                    <input
                      type="text"
                      defaultValue={note}
                      onBlur={(e) => handleUpdateNote(student.id!, e.target.value)}
                      placeholder="Añadir nota u observación..."
                      className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden placeholder:text-slate-400"
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {/* Floating Action Button: Modo Tarjeta Alumno */}
      {currentEval && sortedStudents.length > 0 && !isStepDrawerOpen && (
        <div className="fixed bottom-20 inset-x-0 px-4 flex justify-center z-30 pointer-events-none">
          <button
            type="button"
            onClick={() => {
              setViewStyle('single');
              setIsStepDrawerOpen(true);
            }}
            className="pointer-events-auto min-h-[48px] px-6 rounded-full bg-blue-900 hover:bg-blue-800 dark:bg-blue-700 text-white shadow-xl flex items-center gap-2 text-xs font-bold active:scale-95 transition-transform border border-amber-400/30"
          >
            <span className="material-symbols-outlined text-[19px] text-amber-300">record_voice_over</span>
            <span>Modo Tarjeta Oral x Alumno</span>
          </button>
        </div>
      )}

      {/* Step-by-Step Card Mode Drawer (Oral Keypad) */}
      {isStepDrawerOpen && currentEval && sortedStudents.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in">
          <div className="w-full max-w-lg mx-auto bg-white dark:bg-[#0f172a] rounded-t-3xl shadow-2xl p-5 flex flex-col gap-4 max-h-[85vh] overflow-y-auto border-t border-slate-200 dark:border-slate-800">
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto" />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-900 dark:bg-blue-700 text-white font-mono text-xs font-bold">
                  Alumno {currentStudentIndex + 1}/{sortedStudents.length}
                </span>
                <span className="font-serif font-bold text-sm text-slate-900 dark:text-white">Modo Oral / Paso a Paso</span>
              </div>
              <button
                type="button"
                onClick={() => setIsStepDrawerOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tarjeta del Alumno Activo */}
            {(() => {
              const activeStudent = sortedStudents[currentStudentIndex];
              const gradeRecord = grades.find(
                g => g.studentId === activeStudent.id && g.evaluationId === currentEval.id
              );
              const score = gradeRecord?.score ?? 0;
              const isPassed = score >= 11;

              return (
                <div className="bg-slate-50 dark:bg-[#080d1a] rounded-2xl p-4 flex flex-col items-center text-center gap-1.5 border border-slate-200 dark:border-slate-800">
                  <div className="w-16 h-16 rounded-full bg-blue-950 border border-amber-400/40 text-amber-300 flex items-center justify-center font-serif text-xl font-bold mb-1 shadow-sm">
                    {activeStudent.name.substring(0, 2).toUpperCase()}
                  </div>
                  <h3 className="font-serif font-bold text-base text-slate-900 dark:text-white leading-snug">
                    {activeStudent.name}
                  </h3>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {activeStudent.code || `ID: ${activeStudent.id}`} • {course.modality}
                  </span>

                  {/* Número Gigante */}
                  <div className={`mt-2 text-6xl font-mono font-bold tracking-tight ${
                    isPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {score < 10 ? `0${score}` : score}
                  </div>
                  <span className={`font-mono text-xs font-bold ${
                    isPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    Condición: {isPassed ? 'Aprobado' : 'Desaprobado'}
                  </span>
                </div>
              );
            })()}

            {/* Teclado Numérico Ergonómico */}
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0'].map(key => (
                <button
                  type="button"
                  key={key}
                  onClick={() => handleKeypadPress(key)}
                  className={`min-h-[52px] rounded-xl font-mono text-lg font-bold active:scale-95 transition-all flex items-center justify-center shadow-2xs border ${
                    key === 'DEL'
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {key}
                </button>
              ))}
              <button
                type="button"
                onClick={handleKeypadNext}
                className="min-h-[52px] rounded-xl bg-blue-900 dark:bg-blue-700 text-white font-mono text-base font-bold flex items-center justify-center gap-1 active:scale-95 shadow-md"
              >
                <span>OK</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Crear Nueva Evaluación */}
      <Modal
        isOpen={isNewEvalModalOpen}
        onClose={() => setIsNewEvalModalOpen(false)}
        title="Crear Nueva Evaluación"
      >
        <form onSubmit={handleCreateEval} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase mb-1">
              Nombre de la Evaluación
            </label>
            <input
              type="text"
              value={newEvalName}
              onChange={(e) => setNewEvalName(e.target.value)}
              placeholder="Ej: Evaluación 1: Árboles Binarios, Examen Parcial"
              className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-[#0f172a] focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase mb-1">
              Nota Máxima
            </label>
            <input
              type="number"
              value={newEvalMaxScore}
              onChange={(e) => setNewEvalMaxScore(e.target.value)}
              min="1"
              max="100"
              className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-mono text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-[#0f172a] focus:outline-hidden"
              required
            />
          </div>

          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Sugerencias
            </span>
            <div className="flex flex-wrap gap-1.5">
              {['Evaluación 1', 'Evaluación 2', 'Prueba Parcial', 'Prueba Final', 'Taller Práctico'].map(sugg => (
                <button
                  type="button"
                  key={sugg}
                  onClick={() => setNewEvalName(sugg)}
                  className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                >
                  {sugg}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsNewEvalModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 dark:bg-blue-700 rounded-xl shadow-xs"
            >
              Crear Evaluación
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
