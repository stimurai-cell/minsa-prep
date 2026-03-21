import { useState, useEffect, type ChangeEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import { FolderTree, Plus, Trash2, Sparkles, Loader2, Database, Zap, ShieldCheck } from 'lucide-react';
import { getDifficultyLabel } from '../../lib/labels';

type GeneratedQuestion = {
    question: string;
    alternatives: { text: string; isCorrect: boolean }[];
    explanation?: string;
    difficulty?: string;
};

type GenerationSourceMode = 'topic' | 'material_text' | 'material_file';

const SOURCE_FILE_MAX_BYTES = 3.5 * 1024 * 1024;
const ALLOWED_SOURCE_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const getAlternativeBadge = (index: number) => String.fromCharCode(65 + index);

const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            const [, base64 = ''] = result.split(',');
            resolve(base64);
        };
        reader.onerror = () => reject(new Error('Falha ao ler o ficheiro selecionado.'));
        reader.readAsDataURL(file);
    });

export default function AdminContent() {
    const { areas, fetchAreas, topics, fetchTopics } = useAppStore();
    const [managementArea, setManagementArea] = useState<string>('');
    const [managementTopics, setManagementTopics] = useState<any[]>([]);
    const [loadingManagement, setLoadingManagement] = useState(false);
    const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);

    const [newAreaName, setNewAreaName] = useState('');
    const [newAreaDescription, setNewAreaDescription] = useState('');
    const [newTopicName, setNewTopicName] = useState('');
    const [newTopicDescription, setNewTopicDescription] = useState('');
    const [savingContent, setSavingContent] = useState(false);

    const [genArea, setGenArea] = useState('');
    const [genTopic, setGenTopic] = useState('');
    const [isCustomTopic, setIsCustomTopic] = useState(false);
    const [customTopic, setCustomTopic] = useState('');
    const [genContent, setGenContent] = useState('');
    const [genCount, setGenCount] = useState('5');
    const [genDiff, setGenDiff] = useState<string>('easy');
    const [genSourceMode, setGenSourceMode] = useState<GenerationSourceMode>('topic');
    const [genTheme, setGenTheme] = useState('');
    const [genFileName, setGenFileName] = useState('');
    const [genFileMimeType, setGenFileMimeType] = useState('');
    const [genFileBase64, setGenFileBase64] = useState('');
    const [readingSourceFile, setReadingSourceFile] = useState(false);
    const [generating, setGenerating] = useState(false);
    const normalizedGenCount = Math.max(1, Math.min(25, Number(genCount) || 1));
    const [genResult, setGenResult] = useState<any>(null);

    const [geminiModel, setGeminiModel] = useState<string>('Buscando...');
    const [geminiMode, setGeminiMode] = useState<string>('Buscando...');

    useEffect(() => {
        fetchAreas();
        fetchGeminiStatus();
    }, [fetchAreas]);

    useEffect(() => {
        if (managementArea) {
            fetchManagementContent(managementArea);
        } else {
            setManagementTopics([]);
        }
    }, [managementArea]);

    useEffect(() => {
        if (genArea) {
            fetchTopics(genArea);
        }
    }, [genArea, fetchTopics]);

    const safeJson = async (res: Response) => {
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch {
            console.error('Resposta nÃ£o-JSON da API:', text.substring(0, 500));
            throw new Error(`A API retornou uma resposta invÃ¡lida. Verifique o Vercel. (${res.status} ${res.statusText})`);
        }
    };

    const normalizeQuestions = (raw: any[] = []): GeneratedQuestion[] => {
        return raw.map((q) => ({
            question: q.question || q.content || '',
            alternatives: (q.alternatives || []).map((a: any) => ({
                text: a.text || a.content || '',
                isCorrect: typeof a.isCorrect === 'boolean' ? a.isCorrect : Boolean(a.is_correct),
            })),
            explanation: q.explanation || '',
            difficulty: q.difficulty || 'medium',
        }));
    };

    const fetchGeminiStatus = async () => {
        try {
            const res = await fetch('/api/generate-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'status' })
            });
            const data = await safeJson(res);
            if (res.ok && data) {
                setGeminiModel(data.model || 'Desconhecido');
                setGeminiMode(data.mode || 'N/A');
            }
        } catch (e) {
            console.error(e);
            setGeminiModel('Erro ao conectar');
        }
    };

    const fetchManagementContent = async (areaId: string) => {
        setLoadingManagement(true);
        const { data, error } = await supabase
            .from('topics')
            .select(`
                id, name, description,
                questions(id, content, difficulty, exam_year, alternatives(id, content, is_correct), question_explanations(content))
            `)
            .eq('area_id', areaId)
            .order('name');

        if (!error && data) {
            setManagementTopics(data);
        }
        setLoadingManagement(false);
    };

    const handleCreateArea = async () => {
        if (!newAreaName.trim()) return;
        setSavingContent(true);
        const { error } = await supabase.from('areas').insert({
            name: newAreaName.trim(),
            description: newAreaDescription.trim() || null
        });
        if (error) alert(error.message);
        else {
            setNewAreaName('');
            setNewAreaDescription('');
            fetchAreas();
            alert('Area criada com sucesso!');
        }
        setSavingContent(false);
    };

    const handleDeleteArea = async (areaId: string) => {
        if (!window.confirm('Tem certeza? Isso apagarÃ¡ TODOS os tÃ³picos e perguntas desta Ã¡rea para sempre.')) return;
        setSavingContent(true);
        const { error } = await supabase.from('areas').delete().eq('id', areaId);
        if (error) alert(error.message);
        else {
            fetchAreas();
            if (managementArea === areaId) setManagementArea('');
            if (genArea === areaId) setGenArea('');
        }
        setSavingContent(false);
    };

    const handleCreateTopic = async () => {
        if (!managementArea || !newTopicName.trim()) return;
        setSavingContent(true);
        const { error } = await supabase.from('topics').insert({
            area_id: managementArea,
            name: newTopicName.trim(),
            description: newTopicDescription.trim() || null
        });
        if (error) alert(error.message);
        else {
            setNewTopicName('');
            setNewTopicDescription('');
            fetchManagementContent(managementArea);
        }
        setSavingContent(false);
    };

    const handleDeleteTopic = async (topicId: string) => {
        if (!window.confirm('ATENÃ‡ÃƒO: Apagar este tÃ³pico vai APAGAR TODAS as perguntas dentro dele. Tem certeza absoluta?')) return;
        setSavingContent(true);
        const { error } = await supabase.from('topics').delete().eq('id', topicId);
        if (error) alert(error.message);
        else fetchManagementContent(managementArea);
        setSavingContent(false);
    };

    const handleDeleteQuestion = async (questionId: string) => {
        if (!window.confirm('Apagar esta pergunta permanentemente?')) return;
        setSavingContent(true);
        const { error } = await supabase.from('questions').delete().eq('id', questionId);
        if (error) alert(error.message);
        else fetchManagementContent(managementArea);
        setSavingContent(false);
    };

    const clearSelectedSourceFile = () => {
        setGenFileName('');
        setGenFileMimeType('');
        setGenFileBase64('');
    };

    const handleSourceFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            clearSelectedSourceFile();
            return;
        }

        if (!ALLOWED_SOURCE_MIME_TYPES.includes(file.type)) {
            event.target.value = '';
            clearSelectedSourceFile();
            alert('Use apenas ficheiros PDF ou DOCX.');
            return;
        }

        if (file.size > SOURCE_FILE_MAX_BYTES) {
            event.target.value = '';
            clearSelectedSourceFile();
            alert('O ficheiro excede o limite de 3.5 MB para processamento seguro.');
            return;
        }

        setReadingSourceFile(true);
        try {
            const base64 = await fileToBase64(file);
            setGenFileName(file.name);
            setGenFileMimeType(file.type);
            setGenFileBase64(base64);
        } catch (error: any) {
            clearSelectedSourceFile();
            alert(error.message || 'NÃ£o foi possÃ­vel carregar o ficheiro.');
        } finally {
            setReadingSourceFile(false);
        }
    };

    const handleGenerate = async () => {
        if (!genArea) return alert('Selecione uma Ã¡rea');
        const targetTopic = isCustomTopic ? customTopic.trim() : genTopic;
        if (genSourceMode === 'material_text' && !genContent.trim()) {
            return alert('Cole a materia completa para gerar questoes por texto.');
        }
        if (genSourceMode === 'material_file' && !genFileBase64) {
            return alert('Selecione um ficheiro PDF ou DOCX antes de gerar.');
        }
        if (!targetTopic) return alert('Defina um topico (existente ou novo)');
        if (!genCount || normalizedGenCount < 1) return alert('Informe uma quantidade valida de questoes.');

        setGenerating(true);
        setGenResult(null);

        try {
            const areaName = areas.find(a => a.id === genArea)?.name;
            const topicName = !isCustomTopic ? topics.find(t => t.id === targetTopic)?.name : null;
            const resolvedTheme = genTheme.trim() || (isCustomTopic ? targetTopic : (topicName || ''));

            const res = await fetch('/api/generate-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'generate',
                    area_id: genArea,
                    area_name: areaName,
                    topic_id: isCustomTopic ? null : targetTopic,
                    topic_name: topicName,
                    custom_topic_name: isCustomTopic ? targetTopic : null,
                    count: normalizedGenCount,
                    difficulty: genDiff,
                    context: genSourceMode === 'material_text' ? null : (genContent || null),
                    source_mode: genSourceMode,
                    source_theme: resolvedTheme || null,
                    source_text: genSourceMode === 'material_text' ? genContent : null,
                    source_file: genSourceMode === 'material_file'
                        ? {
                            name: genFileName,
                            mime_type: genFileMimeType,
                            data_base64: genFileBase64,
                        }
                        : null,
                    validate_with_web: genSourceMode !== 'topic'
                })
            });

            const data = await safeJson(res);
            if (!res.ok) {
                const detail = Array.isArray(data.validation_errors) ? ` Detalhes: ${data.validation_errors.join('; ')}` : '';
                throw new Error((data.error || 'Erro na API') + detail);
            }

            const normalized = normalizeQuestions(data.questions);
            setGenResult({
                ...data,
                area_id: data.area_id || genArea,
                topic_id: data.topic_id ?? (isCustomTopic ? null : genTopic),
                custom_topic_name: data.custom_topic_name ?? (isCustomTopic ? customTopic.trim() : null),
                questions: normalized,
            });
            alert(`A IA gerou ${data.questions?.length || 0} perguntas com sucesso! Reveja e guarde.`);
        } catch (err: any) {
            alert(`Falha na IA: ${err.message}`);
        } finally {
            setGenerating(false);
        }
    };

    const handleSaveGenerated = async () => {
        if (!genResult || !genResult.questions) return;
        setGenerating(true);
        try {
            const res = await fetch('/api/generate-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save',
                    generated_data: {
                        ...genResult,
                        area_id: genResult.area_id || genArea,
                        topic_id: genResult.topic_id ?? (isCustomTopic ? null : genTopic),
                        custom_topic_name: genResult.custom_topic_name ?? (isCustomTopic ? customTopic.trim() : null),
                    }
                })
            });

            const data = await safeJson(res);
            if (!res.ok) throw new Error(data.error || 'Erro ao guardar');

            alert(`âœ… ${data.saved_count} perguntas guardadas com sucesso no banco de dados!`);
            setGenResult(null);
            setGenContent('');
            setGenTheme('');
            clearSelectedSourceFile();
            if (managementArea === genArea) fetchManagementContent(genArea);
        } catch (err: any) {
            alert(`Erro ao guardar: ${err.message}`);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* SecÃ§Ã£o de Estrutura: Areas e Topicos */}
            <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
                <div className="space-y-6">
                    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600 shadow-sm border border-emerald-100">
                                <FolderTree className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 leading-tight">Criar Area</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Carreiras / Especialidades</p>
                            </div>
                        </div>

                        <div className="mt-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black tracking-widest text-slate-400 uppercase mb-2 ml-1">Nome da Area</label>
                                <input
                                    type="text"
                                    value={newAreaName}
                                    onChange={(e) => setNewAreaName(e.target.value)}
                                    placeholder="Ex: Enfermagem Geral"
                                    className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black tracking-widest text-slate-400 uppercase mb-2 ml-1">DescriÃ§Ã£o (Opcional)</label>
                                <textarea
                                    rows={2}
                                    value={newAreaDescription}
                                    onChange={(e) => setNewAreaDescription(e.target.value)}
                                    placeholder="Uma breve introduÃ§Ã£o..."
                                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 transition-colors shadow-sm resize-none"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleCreateArea}
                                disabled={savingContent || !newAreaName.trim()}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3.5 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-emerald-500 shadow-lg shadow-emerald-200/50 active:scale-95 disabled:opacity-50 disabled:shadow-none"
                            >
                                <Plus className="h-4 w-4" />
                                Adicionar Area
                            </button>
                        </div>
                    </div>

                    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm overflow-hidden flex flex-col max-h-[400px]">
                        <h2 className="text-lg font-black text-slate-900 mb-4">Areas Existentes</h2>
                        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                            {areas.map((area) => (
                                <div key={area.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:border-slate-300 transition-all hover:shadow-sm group">
                                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-3">
                                        <div>
                                            <p className="font-black text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">{area.name}</p>
                                            {area.description && <p className="mt-1 text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed">{area.description}</p>}
                                        </div>
                                        <div className="flex gap-2 isolate mt-2 xl:mt-0">
                                            <button
                                                type="button"
                                                onClick={() => setManagementArea(area.id)}
                                                className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-[10px] uppercase tracking-wider font-black text-slate-700 hover:bg-slate-50 transition-colors"
                                            >
                                                Gerir
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteArea(area.id)}
                                                disabled={savingContent}
                                                className="rounded-xl bg-rose-50 px-3 py-2 text-[10px] uppercase tracking-wider font-black text-rose-600 hover:bg-rose-100 transition-colors disabled:opacity-50"
                                            >
                                                Apagar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm flex flex-col h-[800px]">
                    <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 xl:flex-row xl:items-end xl:justify-between">
                        <div>
                            <h2 className="text-xl font-black text-slate-900">GestÃ£o de Topicos e Perguntas</h2>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Explorador de ConteÃºdo</p>
                        </div>
                        <div className="w-full xl:max-w-xs">
                            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Selecionar Area Alvo</label>
                            <select
                                value={managementArea}
                                onChange={(e) => setManagementArea(e.target.value)}
                                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors cursor-pointer bg-slate-50/50"
                            >
                                <option value="">Escolha uma Ã¡rea...</option>
                                {areas.map((area) => (
                                    <option key={area.id} value={area.id}>
                                        {area.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {managementArea && (
                        <div className="mt-6 rounded-[1.5rem] border border-emerald-100 bg-[linear-gradient(135deg,#f0fdf4_0%,#ecfdf5_100%)] p-5 shadow-inner">
                            <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2 mb-3">
                                <Plus className="w-3.5 h-3.5" /> Adicionar Topico Manualmente
                            </h3>
                            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                                <input
                                    type="text"
                                    value={newTopicName}
                                    onChange={(e) => setNewTopicName(e.target.value)}
                                    placeholder="Nome do tÃ³pico"
                                    className="rounded-xl border border-emerald-200 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-sm bg-white"
                                />
                                <input
                                    type="text"
                                    value={newTopicDescription}
                                    onChange={(e) => setNewTopicDescription(e.target.value)}
                                    placeholder="DescriÃ§Ã£o (Opcional)"
                                    className="rounded-xl border border-emerald-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 shadow-sm bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={handleCreateTopic}
                                    disabled={savingContent || !newTopicName.trim()}
                                    className="rounded-xl bg-emerald-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-all shadow-md shadow-emerald-200/50 hover:bg-emerald-500 disabled:opacity-50 disabled:shadow-none"
                                >
                                    Criar Topico
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                        {!managementArea ? (
                            <div className="h-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-8 text-center opacity-70">
                                <FolderTree className="w-12 h-12 text-slate-300 mb-4" />
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Nenhuma Area Selecionada</p>
                                <p className="text-xs text-slate-400 font-medium mt-2">Escolha uma Ã¡rea no menu acima para gerir o seu conteÃºdo.</p>
                            </div>
                        ) : loadingManagement ? (
                            <div className="h-full rounded-2xl border border-slate-100 bg-slate-50 flex flex-col items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-4" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">A carregar estrutura...</p>
                            </div>
                        ) : managementTopics.length === 0 ? (
                            <div className="h-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center p-8">
                                <Database className="w-12 h-12 text-slate-300 mb-4 opacity-50" />
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Area Vazia</p>
                                <p className="text-xs text-slate-400 font-medium mt-2">Crie o primeiro tÃ³pico manualmente ou use a IA abaixo.</p>
                            </div>
                        ) : (
                            managementTopics.map((topic) => (
                                <div key={topic.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <p className="text-lg font-black text-slate-900 leading-tight">{topic.name}</p>
                                            {topic.description && <p className="mt-1 text-sm font-medium text-slate-500">{topic.description}</p>}
                                            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                <Database className="w-3 h-3" />
                                                {topic.questions.length} perguntas
                                            </p>
                                        </div>

                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setExpandedTopicId(expandedTopicId === topic.id ? null : topic.id)}
                                                className={`rounded-xl border-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${expandedTopicId === topic.id
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                                    }`}
                                            >
                                                {expandedTopicId === topic.id ? 'Esconder Lista' : 'Gerir Perguntas'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteTopic(topic.id)}
                                                disabled={savingContent}
                                                className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors disabled:opacity-50"
                                                title="Apagar Topico"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {expandedTopicId === topic.id && (
                                        <div className="mt-5 space-y-4 pt-5 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                                            {topic.questions.length === 0 ? (
                                                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                    Nenhuma pergunta neste tÃ³pico.
                                                </div>
                                            ) : (
                                                topic.questions.map((question: any, index: number) => (
                                                    <div key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 group hover:border-slate-300 transition-all">
                                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-black text-slate-900 leading-snug">
                                                                    <span className="text-slate-400 mr-2">#{index + 1}</span>
                                                                    {question.content}
                                                                </p>

                                                                <div className="mt-3 flex flex-wrap gap-2">
                                                                    <span className={`rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${question.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                                                                        question.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                                                                            'bg-rose-100 text-rose-700'
                                                                        }`}>
                                                                        {question.difficulty}
                                                                    </span>
                                                                    {question.exam_year && (
                                                                        <span className="rounded-lg bg-slate-200 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-700">
                                                                            Ano: {question.exam_year}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {question.alternatives && question.alternatives.length > 0 && (
                                                                    <div className="mt-4 space-y-2 pl-4 border-l-2 border-slate-200">
                                                                        {question.alternatives.map((alternative: any, altIndex: number) => (
                                                                            <div
                                                                                key={alternative.id}
                                                                                className={`rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${alternative.is_correct
                                                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm'
                                                                                    : 'bg-white text-slate-600 border border-slate-100'
                                                                                    }`}
                                                                            >
                                                                                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[9px] font-black text-white">
                                                                                    {getAlternativeBadge(altIndex)}
                                                                                </span>
                                                                                {alternative.content}
                                                                                {alternative.is_correct && <span className="float-right font-black uppercase tracking-widest text-[9px] text-emerald-600 mt-0.5">Correcta</span>}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {question.question_explanations?.[0]?.content && (
                                                                    <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 p-4 relative overflow-hidden">
                                                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400"></div>
                                                                        <p className="text-xs font-black uppercase tracking-widest text-blue-800 mb-1">ExplicaÃ§Ã£o Oficial</p>
                                                                        <p className="text-xs font-medium leading-relaxed text-blue-900/80">
                                                                            {question.question_explanations[0].content}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex lg:flex-col gap-2 shrink-0">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteQuestion(question.id)}
                                                                    disabled={savingContent}
                                                                    className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-100 transition-colors disabled:opacity-50"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                    Apagar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* SecÃ§Ã£o de GeraÃ§Ã£o por Inteligencia Artificial */}
            <div className="rounded-[2.5rem] border border-blue-100 bg-[linear-gradient(135deg,#f0f9ff_0%,#e0f2fe_100%)] p-8 shadow-xl shadow-blue-900/5 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
                    <Sparkles className="w-48 h-48 text-blue-400" />
                </div>

                <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_1.5fr]">
                    {/* Painel Esquerdo: FormulÃ¡rio IA */}
                    <div>
                        <div className="mb-6">
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-[9px] font-black uppercase tracking-widest border border-blue-200 mb-3 shadow-sm">
                                <Zap className="w-3 h-3" /> Motor IA Ativo
                            </span>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">Editor de Materia IA</h2>
                            <p className="text-sm font-medium text-slate-600">Gere centenas de perguntas realistas para concursos publicos com a ajuda do {geminiModel}.</p>
                        </div>

                        <div className="space-y-4 bg-white/60 p-6 rounded-[2rem] border border-blue-100/50 backdrop-blur-sm shadow-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Area Alvo</label>
                                    <select
                                        value={genArea}
                                        onChange={(e) => { setGenArea(e.target.value); setGenTopic(''); setIsCustomTopic(false); }}
                                        className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 font-bold text-slate-700 text-sm transition-all shadow-sm bg-white"
                                    >
                                        <option value="" disabled>Selecione uma Ã¡rea...</option>
                                        {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Topico</label>
                                    <select
                                        value={isCustomTopic ? 'custom' : genTopic}
                                        onChange={(e) => {
                                            if (e.target.value === 'custom') {
                                                setIsCustomTopic(true);
                                                setGenTopic('');
                                            } else {
                                                setIsCustomTopic(false);
                                                setGenTopic(e.target.value);
                                            }
                                        }}
                                        className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 font-bold text-slate-700 text-sm transition-all shadow-sm bg-white disabled:opacity-50"
                                        disabled={!genArea}
                                    >
                                        <option value="" disabled>Selecione um tÃ³pico...</option>
                                        {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        <option value="custom" className="font-black text-blue-600">âœ¨ Novo Topico (IA Cria)</option>
                                    </select>
                                </div>
                            </div>

                            {isCustomTopic && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2 ml-1">Nome do Novo Topico</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Farmacologia BÃ¡sica"
                                        value={customTopic}
                                        onChange={(e) => setCustomTopic(e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl border-2 border-blue-200 bg-blue-50 outline-none focus:border-blue-500 focus:bg-white font-black text-blue-900 text-sm transition-all shadow-sm"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Tema Central</label>
                                <input
                                    type="text"
                                    value={genTheme}
                                    onChange={(e) => setGenTheme(e.target.value)}
                                placeholder="Opcional: se vazio, o sistema usa o nome do tÃ³pico"
                                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 font-bold text-slate-700 text-sm transition-all shadow-sm bg-white"
                                />
                            </div>

                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                                <div className="flex items-start gap-3">
                                    <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                                    <div className="space-y-1 text-xs text-emerald-900">
                                        <p className="font-black uppercase tracking-widest text-emerald-700">Regras Ativas</p>
                                        <p>Apenas 4 alternativas por questao.</p>
                                        <p>Texto e ficheiro passam por validacao web antes do retorno.</p>
                                        <p>PDF e DOCX ate 3.5 MB.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                                {[
                                    { id: 'topic', title: 'Por topico', description: 'Usa o topico e as instrucoes adicionais.' },
                                    { id: 'material_text', title: 'Por texto colado', description: 'Usa a materia colada e valida na web.' },
                                    { id: 'material_file', title: 'Por ficheiro', description: 'Interpreta PDF ou DOCX com validacao adicional.' }
                                ].map((mode) => (
                                    <button
                                        key={mode.id}
                                        type="button"
                                        onClick={() => setGenSourceMode(mode.id as GenerationSourceMode)}
                                        className={`rounded-2xl border p-4 text-left transition-all ${genSourceMode === mode.id
                                            ? 'border-blue-400 bg-blue-50 shadow-sm'
                                            : 'border-slate-200 bg-white'
                                            }`}
                                    >
                                        <p className="text-sm font-black text-slate-900">{mode.title}</p>
                                        <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">{mode.description}</p>
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">QTD Perguntas</label>
                                    <input
                                        type="number"
                                        min="1" max="25"
                                value={genCount}
                                onChange={(e) => setGenCount(e.target.value.replace(/\\D+/g, ''))}
                                        className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 outline-none focus:border-blue-400 font-bold text-slate-700 text-center text-sm shadow-sm bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Dificuldade</label>
                                    <select
                                        value={genDiff}
                                        onChange={(e) => setGenDiff(e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 outline-none focus:border-blue-400 font-bold text-slate-700 text-center text-sm shadow-sm bg-white"
                                    >
                                        <option value="easy">FÃ¡cil</option>
                                        <option value="medium">MÃ©dia</option>
                                        <option value="hard">DifÃ­cil</option>
                                    </select>
                                </div>
                            </div>

                            {false && <label className="flex items-start gap-4 p-4 rounded-2xl border-2 border-amber-200 bg-amber-50 cursor-pointer hover:bg-amber-100/50 transition-colors shadow-sm group">
                                <div className="pt-1">
                                    <input
                                        type="checkbox"
                                        checked={false}
                                        onChange={() => undefined}
                                        className="w-5 h-5 rounded-lg border-2 border-amber-300 text-amber-500 focus:ring-amber-200 transition-all cursor-pointer"
                                    />
                                </div>
                                <div className="flex flex-col flex-1">
                                    <span className="text-sm font-black text-amber-900 leading-none">Destaque Especial Concurso</span>
                                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mt-2 leading-relaxed opacity-80">Marcar estas questÃµes para o simulado restrito do edital MINSA. Apenas VIPs.</span>
                                </div>
                                <Sparkles className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                            </label>}

                            {genSourceMode === 'material_file' && (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Ficheiro Fonte</label>
                                    <input
                                        type="file"
                                        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                        onChange={handleSourceFileChange}
                                        className="block w-full text-xs font-medium text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:tracking-widest file:text-white"
                                    />
                                    <p className="mt-3 text-xs font-medium text-slate-500">
                                        {readingSourceFile
                                            ? 'A ler e preparar o ficheiro...'
                                            : genFileName
                                                ? `Ficheiro pronto: ${genFileName}`
                                                : 'Nenhum ficheiro selecionado.'}
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">
                                    {genSourceMode === 'material_text'
                                        ? 'Materia de estudo'
                                        : genSourceMode === 'material_file'
                                            ? 'Orientacoes extras para a IA'
                                            : 'Contexto opcional'}
                                </label>
                                <textarea
                                    rows={genSourceMode === 'material_text' ? 8 : 4}
                                    value={genContent}
                                    onChange={(e) => setGenContent(e.target.value)}
                                    placeholder="Ex: Regulamento X, Artigo Y. A IA usarÃ¡ isto como base para formular as perguntas..."
                                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 outline-none focus:border-blue-400 font-medium text-slate-700 text-xs leading-relaxed shadow-sm bg-white resize-none"
                                />
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={generating || readingSourceFile || !genArea || (!genTopic && !isCustomTopic) || (isCustomTopic && !customTopic) || !genCount || normalizedGenCount < 1 || (genSourceMode === 'material_text' && !genContent.trim()) || (genSourceMode === 'material_file' && !genFileBase64)}
                                className="w-full group flex justify-center items-center gap-3 py-4 px-6 rounded-2xl shadow-xl shadow-blue-500/20 text-xs font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/40 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:hover:bg-blue-600 disabled:shadow-none"
                            >
                                {generating && !genResult ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                                {generating && !genResult ? 'Motor IA a Processar...' : 'Gerar Novas Questoes'}
                            </button>
                        </div>
                    </div>

                    {/* Painel Direito: Preview de Resultados */}
                    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col h-full min-h-[600px] overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-900 flex items-center gap-3">
                                Pre-visualizacao
                            </h2>
                            {genResult && (
                                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl font-black uppercase tracking-widest shadow-sm">
                                    {genResult.questions.length} Lidas da IA
                                </span>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 custom-scrollbar relative">
                            {!genResult ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 opacity-40">
                                    <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center mb-6">
                                        <Sparkles className="h-10 w-10 text-slate-400" />
                                    </div>
                                    <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Painel Desocupado</p>
                                    <p className="text-xs text-slate-400 mt-2 font-medium max-w-xs text-center leading-relaxed">As perguntas formuladas pela Inteligencia Artificial surgirÃ£o aqui para revisao antes de entrarem na plataforma.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {(genResult.validation_summary || genResult.coverage_summary?.length) && (
                                        <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50 p-5">
                                            {genResult.validation_summary && (
                                                <div className="mb-4">
                                                    <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-blue-700">Validacao</p>
                                                    <p className="text-sm font-medium text-blue-900/80">{genResult.validation_summary}</p>
                                                </div>
                                            )}
                                            {Array.isArray(genResult.coverage_summary) && genResult.coverage_summary.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {genResult.coverage_summary.map((item: string, index: number) => (
                                                        <span
                                                            key={`${item}-${index}`}
                                                            className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700"
                                                        >
                                                            {item}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {genResult.questions.map((q: any, i: number) => (
                                        <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden group hover:border-blue-200 transition-colors">
                                            <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                                            <div className="flex gap-4">
                                                <div className="shrink-0 font-black text-blue-200 text-3xl leading-none">
                                                    {String(i + 1).padStart(2, '0')}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="mb-3 flex flex-wrap gap-2">
                                                        <span className={`rounded-xl px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                                                            q.difficulty === 'easy'
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : q.difficulty === 'hard'
                                                                    ? 'bg-rose-100 text-rose-700'
                                                                    : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                            {getDifficultyLabel(q.difficulty)}
                                                        </span>
                                                    </div>
                                                    <p className="font-black text-slate-900 mb-5 text-base leading-snug">{q.question}</p>
                                                    <div className="space-y-2.5">
                                                        {q.alternatives.map((a: any, j: number) => (
                                                            <div
                                                                key={j}
                                                                className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${a.isCorrect
                                                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200 shadow-sm'
                                                                    : 'bg-slate-50 text-slate-600 border-slate-100'
                                                                    }`}
                                                            >
                                                                <div className={`shrink-0 w-5 h-5 rounded-full mt-0.5 flex items-center justify-center text-[9px] font-black ${a.isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                                                                    }`}>
                                                                    {getAlternativeBadge(j)}
                                                                </div>
                                                                <span className="text-sm font-bold leading-relaxed">{a.text}</span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="mt-5 pt-5 border-t border-slate-100">
                                                        <div className="flex items-start gap-2 bg-blue-50 p-4 rounded-xl border border-blue-100">
                                                            <Zap className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                                            <div>
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-800 mb-1">Cerebro IA Raciocina</p>
                                                                <p className="text-xs font-medium text-blue-900/80 leading-relaxed italic">
                                                                    {q.explanation}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {genResult && (
                            <div className="p-6 border-t border-slate-100 bg-white">
                                <button
                                    onClick={handleSaveGenerated}
                                    disabled={generating}
                                    className="w-full flex justify-center items-center gap-3 py-5 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white bg-slate-900 hover:bg-slate-800 shadow-xl shadow-slate-900/20 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
                                    Carregar para o Banco de Dados Final
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
