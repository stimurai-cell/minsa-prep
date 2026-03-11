import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import { FolderTree, Plus, Trash2, Sparkles, Loader2, Database, Zap } from 'lucide-react';

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
    const [genCount, setGenCount] = useState<number>(5);
    const [genDiff, setGenDiff] = useState<string>('easy');
    const [genContestHighlight, setGenContestHighlight] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [genResult, setGenResult] = useState<any>(null);

    const [geminiModel, setGeminiModel] = useState<string>('Buscando...');
    const [geminiMode, setGeminiMode] = useState<string>('Buscando...');

    useEffect(() => {
        fetchGeminiStatus();
    }, []);

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

    const fetchGeminiStatus = async () => {
        try {
            const { data, error } = await supabase.functions.invoke('generate-questions', {
                body: { action: 'status' }
            });
            if (!error && data) {
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
                questions(id, content, difficulty, is_contest_highlight, exam_year, alternatives(id, content, is_correct), question_explanations(content))
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
            alert('Área criada com sucesso!');
        }
        setSavingContent(false);
    };

    const handleDeleteArea = async (areaId: string) => {
        if (!window.confirm('Tem certeza? Isso apagará TODOS os tópicos e perguntas desta área para sempre.')) return;
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
        if (!window.confirm('ATENÇÃO: Apagar este tópico vai APAGAR TODAS as perguntas dentro dele. Tem certeza absoluta?')) return;
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

    const handleGenerate = async () => {
        if (!genArea) return alert('Selecione uma área');
        const targetTopic = isCustomTopic ? customTopic : genTopic;
        if (!targetTopic) return alert('Defina um tópico (existente ou novo)');

        setGenerating(true);
        setGenResult(null);

        try {
            const { data, error } = await supabase.functions.invoke('generate-questions', {
                body: {
                    action: 'generate',
                    area_id: genArea,
                    topic_id: isCustomTopic ? null : targetTopic,
                    custom_topic_name: isCustomTopic ? targetTopic : null,
                    count: genCount,
                    difficulty: genDiff,
                    context: genContent || null,
                    is_contest_highlight: genContestHighlight
                }
            });

            if (error) throw new Error(error.message || 'Erro na Edge Function');
            if (data.error) throw new Error(data.error);

            setGenResult(data);
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
            const { data, error } = await supabase.functions.invoke('generate-questions', {
                body: {
                    action: 'save',
                    generated_data: genResult
                }
            });

            if (error) throw new Error(error.message);
            if (data.error) throw new Error(data.error);

            alert(`✅ ${data.saved_count} perguntas guardadas com sucesso no banco de dados!`);
            setGenResult(null);
            setGenContent('');
            if (managementArea === genArea) fetchManagementContent(genArea);
        } catch (err: any) {
            alert(`Erro ao guardar: ${err.message}`);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Secção de Estrutura: Áreas e Tópicos */}
            <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
                <div className="space-y-6">
                    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600 shadow-sm border border-emerald-100">
                                <FolderTree className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 leading-tight">Criar Área</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Carreiras / Especialidades</p>
                            </div>
                        </div>

                        <div className="mt-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black tracking-widest text-slate-400 uppercase mb-2 ml-1">Nome da Área</label>
                                <input
                                    type="text"
                                    value={newAreaName}
                                    onChange={(e) => setNewAreaName(e.target.value)}
                                    placeholder="Ex: Enfermagem Geral"
                                    className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black tracking-widest text-slate-400 uppercase mb-2 ml-1">Descrição (Opcional)</label>
                                <textarea
                                    rows={2}
                                    value={newAreaDescription}
                                    onChange={(e) => setNewAreaDescription(e.target.value)}
                                    placeholder="Uma breve introdução..."
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
                                Adicionar Área
                            </button>
                        </div>
                    </div>

                    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm overflow-hidden flex flex-col max-h-[400px]">
                        <h2 className="text-lg font-black text-slate-900 mb-4">Áreas Existentes</h2>
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
                            <h2 className="text-xl font-black text-slate-900">Gestão de Tópicos e Perguntas</h2>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Explorador de Conteúdo</p>
                        </div>
                        <div className="w-full xl:max-w-xs">
                            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Selecionar Área Alvo</label>
                            <select
                                value={managementArea}
                                onChange={(e) => setManagementArea(e.target.value)}
                                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors cursor-pointer bg-slate-50/50"
                            >
                                <option value="">Escolha uma área...</option>
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
                                <Plus className="w-3.5 h-3.5" /> Adicionar Tópico Manualmente
                            </h3>
                            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                                <input
                                    type="text"
                                    value={newTopicName}
                                    onChange={(e) => setNewTopicName(e.target.value)}
                                    placeholder="Nome do tópico"
                                    className="rounded-xl border border-emerald-200 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-sm bg-white"
                                />
                                <input
                                    type="text"
                                    value={newTopicDescription}
                                    onChange={(e) => setNewTopicDescription(e.target.value)}
                                    placeholder="Descrição (Opcional)"
                                    className="rounded-xl border border-emerald-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 shadow-sm bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={handleCreateTopic}
                                    disabled={savingContent || !newTopicName.trim()}
                                    className="rounded-xl bg-emerald-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-all shadow-md shadow-emerald-200/50 hover:bg-emerald-500 disabled:opacity-50 disabled:shadow-none"
                                >
                                    Criar Tópico
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                        {!managementArea ? (
                            <div className="h-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-8 text-center opacity-70">
                                <FolderTree className="w-12 h-12 text-slate-300 mb-4" />
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Nenhuma Área Selecionada</p>
                                <p className="text-xs text-slate-400 font-medium mt-2">Escolha uma área no menu acima para gerir o seu conteúdo.</p>
                            </div>
                        ) : loadingManagement ? (
                            <div className="h-full rounded-2xl border border-slate-100 bg-slate-50 flex flex-col items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-4" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">A carregar estrutura...</p>
                            </div>
                        ) : managementTopics.length === 0 ? (
                            <div className="h-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center p-8">
                                <Database className="w-12 h-12 text-slate-300 mb-4 opacity-50" />
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Área Vazia</p>
                                <p className="text-xs text-slate-400 font-medium mt-2">Crie o primeiro tópico manualmente ou use a IA abaixo.</p>
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
                                                title="Apagar Tópico"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {expandedTopicId === topic.id && (
                                        <div className="mt-5 space-y-4 pt-5 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                                            {topic.questions.length === 0 ? (
                                                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                    Nenhuma pergunta neste tópico.
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
                                                                        {question.alternatives.map((alternative: any) => (
                                                                            <div
                                                                                key={alternative.id}
                                                                                className={`rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${alternative.is_correct
                                                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm'
                                                                                    : 'bg-white text-slate-600 border border-slate-100'
                                                                                    }`}
                                                                            >
                                                                                {alternative.content}
                                                                                {alternative.is_correct && <span className="float-right font-black uppercase tracking-widest text-[9px] text-emerald-600 mt-0.5">Correcta</span>}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {question.question_explanations?.[0]?.content && (
                                                                    <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 p-4 relative overflow-hidden">
                                                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400"></div>
                                                                        <p className="text-xs font-black uppercase tracking-widest text-blue-800 mb-1">Explicação Oficial</p>
                                                                        <p className="text-xs font-medium leading-relaxed text-blue-900/80">
                                                                            {question.question_explanations[0].content}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex lg:flex-col gap-2 shrink-0">
                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        const { error } = await supabase
                                                                            .from('questions')
                                                                            .update({ is_contest_highlight: !question.is_contest_highlight })
                                                                            .eq('id', question.id);
                                                                        if (error) alert(error.message);
                                                                        else fetchManagementContent(managementArea);
                                                                    }}
                                                                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${question.is_contest_highlight
                                                                        ? 'bg-amber-100 text-amber-700 shadow-sm shadow-amber-200/50'
                                                                        : 'bg-white border-2 border-slate-200 text-slate-500 hover:bg-slate-50'
                                                                        }`}
                                                                >
                                                                    <Sparkles className={`w-3.5 h-3.5 ${question.is_contest_highlight ? 'fill-amber-400 text-amber-500' : ''}`} />
                                                                    Destaque
                                                                </button>
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

            {/* Secção de Geração por Inteligência Artificial */}
            <div className="rounded-[2.5rem] border border-blue-100 bg-[linear-gradient(135deg,#f0f9ff_0%,#e0f2fe_100%)] p-8 shadow-xl shadow-blue-900/5 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
                    <Sparkles className="w-48 h-48 text-blue-400" />
                </div>

                <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_1.5fr]">
                    {/* Painel Esquerdo: Formulário IA */}
                    <div>
                        <div className="mb-6">
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-[9px] font-black uppercase tracking-widest border border-blue-200 mb-3 shadow-sm">
                                <Zap className="w-3 h-3" /> Motor IA Ativo
                            </span>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">Editor de Matéria IA</h2>
                            <p className="text-sm font-medium text-slate-600">Gere centenas de perguntas realistas para concursos públicos com a ajuda do {geminiModel}.</p>
                        </div>

                        <div className="space-y-4 bg-white/60 p-6 rounded-[2rem] border border-blue-100/50 backdrop-blur-sm shadow-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Área Alvo</label>
                                    <select
                                        value={genArea}
                                        onChange={(e) => { setGenArea(e.target.value); setGenTopic(''); setIsCustomTopic(false); }}
                                        className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 font-bold text-slate-700 text-sm transition-all shadow-sm bg-white"
                                    >
                                        <option value="" disabled>Selecione uma área...</option>
                                        {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Tópico</label>
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
                                        <option value="" disabled>Selecione um tópico...</option>
                                        {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        <option value="custom" className="font-black text-blue-600">✨ Novo Tópico (IA Cria)</option>
                                    </select>
                                </div>
                            </div>

                            {isCustomTopic && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2 ml-1">Nome do Novo Tópico</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Farmacologia Básica"
                                        value={customTopic}
                                        onChange={(e) => setCustomTopic(e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl border-2 border-blue-200 bg-blue-50 outline-none focus:border-blue-500 focus:bg-white font-black text-blue-900 text-sm transition-all shadow-sm"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">QTD Perguntas</label>
                                    <input
                                        type="number"
                                        min="1" max="25"
                                        value={genCount}
                                        onChange={(e) => setGenCount(parseInt(e.target.value))}
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
                                        <option value="easy">Fácil</option>
                                        <option value="medium">Média</option>
                                        <option value="hard">Difícil</option>
                                    </select>
                                </div>
                            </div>

                            <label className="flex items-start gap-4 p-4 rounded-2xl border-2 border-amber-200 bg-amber-50 cursor-pointer hover:bg-amber-100/50 transition-colors shadow-sm group">
                                <div className="pt-1">
                                    <input
                                        type="checkbox"
                                        checked={genContestHighlight}
                                        onChange={(e) => setGenContestHighlight(e.target.checked)}
                                        className="w-5 h-5 rounded-lg border-2 border-amber-300 text-amber-500 focus:ring-amber-200 transition-all cursor-pointer"
                                    />
                                </div>
                                <div className="flex flex-col flex-1">
                                    <span className="text-sm font-black text-amber-900 leading-none">Destaque Especial Concurso</span>
                                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mt-2 leading-relaxed opacity-80">Marcar estas questões para o simulado restrito do edital MINSA. Apenas VIPs.</span>
                                </div>
                                <Sparkles className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                            </label>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Contexto Opcional (Copiar & Colar de PDF)</label>
                                <textarea
                                    rows={4}
                                    value={genContent}
                                    onChange={(e) => setGenContent(e.target.value)}
                                    placeholder="Ex: Regulamento X, Artigo Y. A IA usará isto como base para formular as perguntas..."
                                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 outline-none focus:border-blue-400 font-medium text-slate-700 text-xs leading-relaxed shadow-sm bg-white resize-none"
                                />
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={generating || !genArea || (!genTopic && !isCustomTopic) || (isCustomTopic && !customTopic)}
                                className="w-full group flex justify-center items-center gap-3 py-4 px-6 rounded-2xl shadow-xl shadow-blue-500/20 text-xs font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/40 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:hover:bg-blue-600 disabled:shadow-none"
                            >
                                {generating && !genResult ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                                {generating && !genResult ? 'Motor IA a Processar...' : 'Gerar Novas Questões'}
                            </button>
                        </div>
                    </div>

                    {/* Painel Direito: Preview de Resultados */}
                    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col h-full min-h-[600px] overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-900 flex items-center gap-3">
                                Pré-visualização
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
                                    <p className="text-xs text-slate-400 mt-2 font-medium max-w-xs text-center leading-relaxed">As perguntas formuladas pela Inteligência Artificial surgirão aqui para revisão antes de entrarem na plataforma.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {genResult.questions.map((q: any, i: number) => (
                                        <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden group hover:border-blue-200 transition-colors">
                                            <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                                            <div className="flex gap-4">
                                                <div className="shrink-0 font-black text-blue-200 text-3xl leading-none">
                                                    {String(i + 1).padStart(2, '0')}
                                                </div>
                                                <div className="flex-1 min-w-0">
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
                                                                    {['A', 'B', 'C', 'D', 'E'][j]}
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
