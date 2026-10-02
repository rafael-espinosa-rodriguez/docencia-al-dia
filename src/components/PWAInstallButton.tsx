import React, { useState } from 'react';
import { Download, Smartphone, Share2, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Si ya corre en modo standalone (instalada), no mostrar botón
  if (isInstalled) {
    return null;
  }

  // Android / Chrome / Edge flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-semibold text-white bg-blue-900 dark:bg-blue-700 rounded-lg hover:bg-blue-800 active:scale-95 transition-all shadow-xs border border-blue-400/30"
        title="Instalar como app móvil en tu dispositivo"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Instalar App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium text-blue-900 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 transition-colors"
          title="Instalar en iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Instalar en iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#0f172a] p-6 shadow-2xl text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-300 flex items-center justify-center mx-auto mb-4 border border-blue-300 dark:border-blue-800">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-serif font-bold text-center text-slate-900 dark:text-white">Instalar Docencia al Día</h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">
                Disfruta de la app canónica a pantalla completa y 100% offline en tu dispositivo:
              </p>

              <div className="mt-4 space-y-3 bg-slate-50 dark:bg-[#080d1a] p-4 rounded-xl text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                <div className="flex items-start gap-2.5">
                  <Share2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <span>1. Toca el botón <strong>Compartir</strong> en la barra de Safari.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <PlusSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <span>2. Selecciona <strong>Añadir a pantalla de inicio</strong>.</span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-blue-900 hover:bg-blue-800 dark:bg-blue-700 py-2.5 text-xs font-bold text-white transition shadow-sm"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
