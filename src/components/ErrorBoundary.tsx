import {Component, type ErrorInfo, type ReactNode} from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Límite de errores de React. Clase y no función porque React todavía no
 * expone error boundaries como hook: `getDerivedStateFromError` solo existe
 * en componentes de clase (única excepción al estilo de flecha del proyecto).
 *
 * Sin esto, cualquier render que falle deja la pantalla en blanco y en el APK
 * no hay consola del usuario final para diagnosticarlo.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = {error: null};

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Error no controlado en la UI:', error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({error: null});
  };

  private reload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const {error} = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-50 px-6 text-center text-slate-800 transition-colors duration-300 dark:bg-[#080d1a] dark:text-slate-100">
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-6xl text-rose-500"
        >
          error
        </span>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Algo salió mal</h1>
          <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
            La aplicación encontró un error inesperado. Tus datos están
            guardados en este dispositivo y no se han perdido.
          </p>
          <p className="break-words font-mono text-xs text-slate-400 dark:text-slate-500">
            {error.message}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={this.reload}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Recargar la aplicación
          </button>
          <button
            type="button"
            onClick={this.reset}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }
}
