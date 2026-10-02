import React, { useState, useEffect, useRef } from 'react';
import type { Student } from '../db';

interface StudentAttendanceCardProps {
  student: Student;
  status: 'present' | 'absent' | 'late' | 'excused';
  note?: string;
  modality: string;
  totalAbsences: number;
  hasExcessiveAbsences: boolean;
  onStatusChange: (status: 'present' | 'absent' | 'late' | 'excused') => void;
  onNoteChange: (note: string) => void;
  index?: number;
  animationKey?: string;
}

export const StudentAttendanceCard: React.FC<StudentAttendanceCardProps> = ({
  student,
  status,
  note = '',
  modality,
  totalAbsences,
  hasExcessiveAbsences,
  onStatusChange,
  onNoteChange,
  index = 0,
  animationKey
}) => {
  const [localNote, setLocalNote] = useState<string>(note);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isAnimating, setIsAnimating] = useState<boolean>(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reiniciar animación cuando cambie animationKey (filtro o fecha)
  useEffect(() => {
    setIsAnimating(false);
    const frame = requestAnimationFrame(() => {
      setIsAnimating(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [animationKey]);

  // Sincronizar estado local cuando cambia el estudiante, fecha o nota externa
  useEffect(() => {
    setLocalNote(note);
  }, [note, student.id]);

  // Manejar cambio en el campo de texto con guardado diferido (debounce)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalNote(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      onNoteChange(val);
      triggerSavedFeedback();
    }, 500);
  };

  // Guardar inmediatamente al perder el foco (blur)
  const handleInputBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (localNote !== note) {
      onNoteChange(localNote);
      triggerSavedFeedback();
    }
  };

  // Guardar al presionar Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      onNoteChange(localNote);
      triggerSavedFeedback();
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleClearNote = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setLocalNote('');
    onNoteChange('');
    triggerSavedFeedback();
  };

  const triggerSavedFeedback = () => {
    setIsSaved(true);
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
    }
    savedTimerRef.current = setTimeout(() => {
      setIsSaved(false);
    }, 1800);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  return (
    <article
      style={{
        animationDelay: `${Math.min(index * 30, 240)}ms`
      }}
      className={`bg-white dark:bg-[#0f172a] rounded-xl p-3.5 academic-border border flex flex-col gap-2.5 transition-all ${
        isAnimating ? 'animate-slide-up-fade' : ''
      } ${
        hasExcessiveAbsences 
          ? 'border-rose-300/80 dark:border-rose-900/60 shadow-xs' 
          : 'border-slate-200/80 dark:border-slate-800 hover:border-blue-400/40'
      }`}
    >
      {/* Cabecera del Estudiante */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-10 h-10 rounded-lg text-xs font-serif font-bold flex items-center justify-center shrink-0 border ${
              hasExcessiveAbsences
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                : 'bg-slate-100 dark:bg-slate-800 text-blue-900 dark:text-amber-400 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {student.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="font-serif font-bold text-xs text-slate-900 dark:text-white truncate">
                {student.name}
              </h4>
              {hasExcessiveAbsences && (
                <span className="text-[9.5px] font-mono font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/60 flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[11px]">warning</span>
                  <span>{totalAbsences} faltas</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              <span>ID: {student.code || student.id}</span>
              <span className="px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {modality}
              </span>
              {localNote.trim() && (
                <span className="inline-flex items-center gap-0.5 text-blue-700 dark:text-blue-400 font-medium">
                  • con observación
                </span>
              )}
            </div>
          </div>
        </div>

        <span
          title={`Estado: ${
            status === 'present' ? 'Presente' :
            status === 'absent' ? 'Ausente' :
            status === 'late' ? 'Tardanza' : 'Justificado'
          }`}
          className={`w-3 h-3 rounded-full shrink-0 ${
            status === 'present' ? 'bg-emerald-500' :
            status === 'absent' ? 'bg-rose-500' :
            status === 'late' ? 'bg-amber-500' : 'bg-purple-500'
          }`}
        />
      </div>

      {/* Botones de Asistencia de 4 Estados (Touch Targets min-h-[48px]) */}
      <div className="grid grid-cols-4 gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => onStatusChange('present')}
          className={`min-h-[48px] rounded-lg font-bold font-mono text-sm flex items-center justify-center active:scale-95 transition-all ${
            status === 'present'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
          title="Marcar Presente"
        >
          P
        </button>
        <button
          type="button"
          onClick={() => onStatusChange('absent')}
          className={`min-h-[48px] rounded-lg font-bold font-mono text-sm flex items-center justify-center active:scale-95 transition-all ${
            status === 'absent'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
          title="Marcar Ausente"
        >
          A
        </button>
        <button
          type="button"
          onClick={() => onStatusChange('late')}
          className={`min-h-[48px] rounded-lg font-bold font-mono text-sm flex items-center justify-center active:scale-95 transition-all ${
            status === 'late'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
          title="Marcar Tardanza"
        >
          T
        </button>
        <button
          type="button"
          onClick={() => onStatusChange('excused')}
          className={`min-h-[48px] rounded-lg font-bold font-mono text-sm flex items-center justify-center active:scale-95 transition-all ${
            status === 'excused'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
          title="Marcar Justificado"
        >
          J
        </button>
      </div>

      {/* Campo de Texto Simple para Observaciones o Notas de la Sesión */}
      <div className="pt-0.5">
        <div className="relative flex items-center">
          <span className="absolute left-2.5 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center">
            <span className="material-symbols-outlined text-[15px]">edit_note</span>
          </span>
          <input
            type="text"
            value={localNote}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            placeholder="Nota u observación de la sesión (ej. 'participación destacada', 'olvidó materiales')"
            aria-label={`Observaciones de la sesión para ${student.name}`}
            className="w-full pl-8 pr-16 py-1.5 text-xs bg-slate-50 dark:bg-slate-900/70 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 transition-all font-sans"
          />
          <div className="absolute right-2 flex items-center gap-1">
            {isSaved && (
              <span 
                className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 animate-fade-in"
                title="Nota guardada"
              >
                <span className="material-symbols-outlined text-[12px]">check</span>
              </span>
            )}
            {localNote.length > 0 && (
              <button
                type="button"
                onClick={handleClearNote}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 rounded transition-colors"
                title="Limpiar observación"
              >
                <span className="material-symbols-outlined text-[13px]">close</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};
