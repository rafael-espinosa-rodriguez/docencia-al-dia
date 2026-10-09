import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Check, AlertCircle, Users, FileText, UserPlus } from 'lucide-react';
import { Modal } from './Modal';
import { parseStudentFile, type ParsedStudentItem } from '../lib/studentFileParser';

interface StudentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (students: ParsedStudentItem[]) => Promise<void>;
}

export const StudentImportModal: React.FC<StudentImportModalProps> = ({
  isOpen,
  onClose,
  onImport
}) => {
  const [tab, setTab] = useState<'file' | 'bulk' | 'single'>('file');
  
  // Tab 1: File
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<ParsedStudentItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab 2: Bulk text
  const [bulkText, setBulkText] = useState('');

  // Tab 3: Single
  const [singleName, setSingleName] = useState('');
  const [singleCode, setSingleCode] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetState = () => {
    setFile(null);
    setParseError(null);
    setParsedPreview([]);
    setBulkText('');
    setSingleName('');
    setSingleCode('');
    setIsSubmitting(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setIsParsing(true);
    setParseError(null);
    setParsedPreview([]);

    try {
      const items = await parseStudentFile(selected);
      setParsedPreview(items);
    } catch (err: any) {
      setParseError(err.message || 'Error al procesar el archivo. Verifica el formato.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmFileImport = async () => {
    if (parsedPreview.length === 0) return;
    setIsSubmitting(true);
    try {
      await onImport(parsedPreview);
      resetState();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmBulkText = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    const items: ParsedStudentItem[] = lines.map(name => ({ name }));
    setIsSubmitting(true);
    try {
      await onImport(items);
      resetState();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleName.trim()) return;

    setIsSubmitting(true);
    try {
      await onImport([{ name: singleName.trim(), code: singleCode.trim() || undefined }]);
      resetState();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agregar Estudiantes a la Asignatura">
      {/* Selector de pestañas */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-4 text-xs font-bold">
        <button
          type="button"
          onClick={() => setTab('file')}
          className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
            tab === 'file' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Excel / CSV</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('bulk')}
          className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
            tab === 'bulk' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Pegar Lista</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('single')}
          className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
            tab === 'single' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Uno a Uno</span>
        </button>
      </div>

      {/* PESTAÑA 1: SUBIR ARCHIVO EXCEL / CSV */}
      {tab === 'file' && (
        <div className="space-y-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-blue-200 hover:border-blue-500 bg-blue-50/40 p-6 rounded-2xl text-center cursor-pointer transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-2">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-slate-800">
              {file ? file.name : 'Toca para seleccionar un archivo .xlsx o .csv'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Compatible con nóminas oficiales de secretaría docente
            </p>
          </div>

          {isParsing && (
            <div className="text-center text-xs text-blue-600 font-bold py-2 animate-pulse">
              Analizando estructura de columnas del archivo...
            </div>
          )}

          {parseError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {parsedPreview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Estudiantes detectados:</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {parsedPreview.length} alumnos
                </span>
              </div>

              <div className="max-h-40 overflow-y-auto bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs divide-y divide-slate-100">
                {parsedPreview.slice(0, 15).map((p, idx) => (
                  <div key={idx} className="py-1 flex items-center justify-between">
                    <span className="font-medium text-slate-800 whitespace-normal break-words min-w-0">{p.name}</span>
                    {p.code && <span className="text-[10px] text-slate-400 font-mono">{p.code}</span>}
                  </div>
                ))}
                {parsedPreview.length > 15 && (
                  <div className="pt-1.5 text-center text-[10px] text-slate-400 font-bold">
                    ... y {parsedPreview.length - 15} estudiantes más
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleConfirmFileImport}
                disabled={isSubmitting}
                className="w-full mt-3 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar e Importar {parsedPreview.length} Estudiantes</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 2: PEGAR LISTA DE TEXTO */}
      {tab === 'bulk' && (
        <form onSubmit={handleConfirmBulkText} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Pega los nombres (un estudiante por línea)
            </label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={7}
              placeholder="Alejandro Martínez Castro&#10;Camila Andrea Rodríguez&#10;Daniel Esteban Gómez&#10;Lucía Valentina Fernández"
              className="w-full p-3 bg-slate-100 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-mono"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Copia directamente una columna de Excel o Word y pégala aquí.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !bulkText.trim()}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs disabled:opacity-50"
            >
              Importar Lista
            </button>
          </div>
        </form>
      )}

      {/* PESTAÑA 3: INDIVIDUAL */}
      {tab === 'single' && (
        <form onSubmit={handleConfirmSingle} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Nombre Completo del Estudiante
            </label>
            <input
              type="text"
              value={singleName}
              onChange={(e) => setSingleName(e.target.value)}
              placeholder="Ej: Gómez Pérez, Mariana"
              className="w-full px-3 py-2.5 bg-slate-100 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Código o Carnet (Opcional)
            </label>
            <input
              type="text"
              value={singleCode}
              onChange={(e) => setSingleCode(e.target.value)}
              placeholder="Ej: 202410293"
              className="w-full px-3 py-2.5 bg-slate-100 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !singleName.trim()}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs disabled:opacity-50"
            >
              Agregar Estudiante
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
