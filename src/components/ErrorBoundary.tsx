import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-[2rem] shadow-xl border border-red-100 p-8 text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-600">
                            <AlertCircle className="w-10 h-10" />
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 mb-2">Ops! Algo correu mal.</h1>
                        <p className="text-slate-600 mb-8 font-medium">
                            Ocorreu um erro inesperado ao carregar esta página. Pode tentar recarregar o sistema.
                        </p>

                        <button
                            onClick={() => window.location.assign('/')}
                            className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-200"
                        >
                            <RefreshCw className="w-5 h-5" />
                            Recarregar Painel
                        </button>

                        {process.env.NODE_ENV === 'development' && (
                            <div className="mt-8 p-4 bg-slate-900 rounded-xl text-left overflow-auto max-h-40">
                                <p className="text-red-400 font-mono text-xs whitespace-pre-wrap">
                                    {this.state.error?.toString()}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
