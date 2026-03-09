import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Download, Upload, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function AdminBackup() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const handleExport = async () => {
        setLoading(true);
        setStatus(null);
        try {
            // Fetch all core content
            const { data: areas } = await supabase.from('areas').select('*');
            const { data: topics } = await supabase.from('topics').select('*');
            const { data: questions } = await supabase.from('questions').select('*');
            const { data: alternatives } = await supabase.from('alternatives').select('*');
            const { data: explanations } = await supabase.from('question_explanations').select('*');

            const backupData = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                data: {
                    areas,
                    topics,
                    questions,
                    alternatives,
                    explanations
                }
            };

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `minsa_prep_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setStatus({ type: 'success', message: 'Exportação concluída com sucesso!' });
        } catch (err: any) {
            console.error(err);
            setStatus({ type: 'error', message: `Erro na exportação: ${err.message}` });
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!window.confirm('Atenção: A importação pode duplicar registros se os IDs não coincidirem ou sobrescrever dados existentes. Deseja continuar?')) {
            return;
        }

        setLoading(true);
        setStatus(null);
        try {
            const text = await file.text();
            const backup = JSON.parse(text);

            if (!backup.data) throw new Error('Formato de backup inválido.');

            const { areas, topics, questions, alternatives, explanations } = backup.data;

            // Import sequence (respecting foreign keys)
            if (areas?.length) await supabase.from('areas').upsert(areas);
            if (topics?.length) await supabase.from('topics').upsert(topics);
            if (questions?.length) await supabase.from('questions').upsert(questions);
            if (alternatives?.length) await supabase.from('alternatives').upsert(alternatives);
            if (explanations?.length) await supabase.from('question_explanations').upsert(explanations);

            setStatus({ type: 'success', message: 'Importação concluída com sucesso!' });
        } catch (err: any) {
            console.error(err);
            setStatus({ type: 'error', message: `Erro na importação: ${err.message}` });
        } finally {
            setLoading(false);
            // Reset input
            e.target.value = '';
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
                {/* Export Card */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                            <Download className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Exportar Dados</h3>
                            <p className="text-sm text-slate-500">Baixe todo o catálogo de questões (JSON)</p>
                        </div>
                    </div>
                    <button
                        onClick={handleExport}
                        disabled={loading}
                        className="w-full py-3 px-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Gerar Backup JSON
                    </button>
                </div>

                {/* Import Card */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                            <Upload className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Importar Dados</h3>
                            <p className="text-sm text-slate-500">Suba um arquivo de backup para o banco</p>
                        </div>
                    </div>
                    <label className="block w-full">
                        <span className="sr-only">Escolher arquivo</span>
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleImport}
                            disabled={loading}
                            className="block w-full text-sm text-slate-500
                file:mr-4 file:py-3 file:px-4
                file:rounded-xl file:border-0
                file:text-sm file:font-bold
                file:bg-amber-50 file:text-amber-700
                hover:file:bg-amber-100
                cursor-pointer disabled:opacity-50"
                        />
                    </label>
                </div>
            </div>

            {status && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="text-sm font-medium">{status.message}</span>
                </div>
            )}

            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                <p className="text-xs text-blue-700 leading-relaxed">
                    <strong>Nota Pro:</strong> O recurso de Backup & Upload permite migrar questões entre ambientes de desenvolvimento e produção.
                    Certifique-se de validar o arquivo JSON antes de importar em grande escala.
                </p>
            </div>
        </div>
    );
}
