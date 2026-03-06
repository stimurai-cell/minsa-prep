import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { generateQuestions, getGeminiConfigStatus } from '../lib/gemini';
import { stripAlternativePrefix } from '../lib/quiz';
import { LayoutDashboard, Users, Database, Zap, Plus, Loader2, Settings } from 'lucide-react';

export default function Admin() {
  const { profile } = useAuthStore();
  const { areas, topics, fetchAreas, fetchTopics } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'dashboard');
  const [stats, setStats] = useState({ users: 0, questions: 0, premium: 0 });
  const [userList, setUserList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [contentCatalog, setContentCatalog] = useState<any[]>([]);
  
  // Generator State
  const [genArea, setGenArea] = useState('');
  const [genTopic, setGenTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [isCustomTopic, setIsCustomTopic] = useState(false);
  const [genCount, setGenCount] = useState(5);
  const [genDiff, setGenDiff] = useState('medium');
  const [genContent, setGenContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<any>(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*, areas(name)')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setUserList(data);
    }
    setLoadingUsers(false);
  };

  const [geminiModel, setGeminiModel] = useState('');
  const [geminiMode, setGeminiMode] = useState('');

  const fetchStats = async () => {
    const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: qCount } = await supabase.from('questions').select('*', { count: 'exact', head: true });
    const { count: premCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'premium');

    setStats({
      users: usersCount || 0,
      questions: qCount || 0,
      premium: premCount || 0
    });
  };

  const fetchContentCatalog = async (areaId: string) => {
    if (!areaId) {
      setContentCatalog([]);
      return;
    }

    setLoadingCatalog(true);
    try {
      const { data: topicRows, error: topicError } = await supabase
        .from('topics')
        .select('id, name')
        .eq('area_id', areaId)
        .order('name', { ascending: true });

      if (topicError) throw topicError;

      const catalog = await Promise.all(
        (topicRows || []).map(async (topic) => {
          const { count } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('topic_id', topic.id);

          return {
            ...topic,
            questionsCount: count || 0,
          };
        })
      );

      setContentCatalog(catalog);
    } catch (error) {
      console.error('Error fetching content catalog:', error);
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    const { mode, modelName } = getGeminiConfigStatus();
    setGeminiMode(mode);
    setGeminiModel(modelName);
  }, []);

  useEffect(() => {
    fetchAreas();
    fetchStats();
  }, [fetchAreas]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  useEffect(() => {
    if (genArea) {
      fetchTopics(genArea);
      fetchContentCatalog(genArea);
    }
  }, [genArea, fetchTopics]);

  if (profile?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
          <Settings className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Acesso Negado</h2>
        <p className="text-gray-500">Você não tem permissão para acessar esta área.</p>
        <p className="text-xs text-gray-400 max-w-xs">
          Se você é o administrador (jossdemo@gmail.com), certifique-se de ter executado o script SQL de correção no Supabase.
        </p>
      </div>
    );
  }

  const handleUpdateUserArea = async (userId: string, areaId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ selected_area_id: areaId })
      .eq('id', userId);
    
    if (error) alert('Erro ao atualizar área.');
    else fetchUsers();
  };

  const handleUpdateUserRole = async (userId: string, role: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);
    
    if (error) alert('Erro ao atualizar cargo.');
    else fetchUsers();
  };

  const handleGenerate = async () => {
    if (!genArea || (!genTopic && !isCustomTopic) || (isCustomTopic && !customTopic)) {
      return alert('Selecione área e tópico.');
    }
    setGenerating(true);
    setGenResult(null);
    
    try {
      const areaName = areas.find(a => a.id === genArea)?.name || '';
      const topicName = isCustomTopic ? customTopic : (topics.find(t => t.id === genTopic)?.name || '');
      
      const result = await generateQuestions(areaName, topicName, genCount, genDiff, genContent);
      setGenResult(result);
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Erro ao gerar questoes com o Gemini.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveGenerated = async () => {
    if (!genResult?.questions || !genArea) return;
    if (!isCustomTopic && !genTopic) return;
    if (isCustomTopic && !customTopic) return;

    setGenerating(true);
    console.log('Starting save process...');
    
    try {
      let finalTopicId = genTopic;

      // 1. If custom topic, create it first
      if (isCustomTopic) {
        console.log('Creating custom topic:', customTopic);
        const { data: newTopic, error: topicError } = await supabase
          .from('topics')
          .insert({
            area_id: genArea,
            name: customTopic
          })
          .select()
          .single();
        
        if (topicError) {
          console.error('Error creating topic:', topicError);
          throw new Error(`Erro ao criar tópico: ${topicError.message}`);
        }
        finalTopicId = newTopic.id;
        await fetchTopics(genArea); // Refresh topics list
      }

      console.log('Saving questions to topic:', finalTopicId);

      for (const q of genResult.questions) {
        // 2. Insert Question
        const { data: qData, error: qError } = await supabase
          .from('questions')
          .insert({
            topic_id: finalTopicId,
            content: q.question,
            difficulty: q.difficulty || genDiff
          })
          .select()
          .single();
          
        if (qError) {
          console.error('Error inserting question:', qError);
          throw new Error(`Erro ao inserir questão: ${qError.message}`);
        }
        
        // 3. Insert Alternatives
        const alts = q.alternatives.map((a: any) => ({
          question_id: qData.id,
          content: stripAlternativePrefix(a.text),
          is_correct: a.isCorrect
        }));
        
        const { error: altsError } = await supabase.from('alternatives').insert(alts);
        if (altsError) {
          console.error('Error inserting alternatives:', altsError);
          throw new Error(`Erro ao inserir alternativas: ${altsError.message}`);
        }
        
        // 4. Insert Explanation
        if (q.explanation) {
          const { error: expError } = await supabase.from('question_explanations').insert({
            question_id: qData.id,
            content: q.explanation
          });
          if (expError) {
            console.error('Error inserting explanation:', expError);
            // Don't throw here, explanation is secondary
          }
        }
      }
      
      alert('Questões salvas com sucesso!');
      await fetchStats();
      await fetchContentCatalog(genArea);
      setGenResult(null);
      setGenContent('');
      if (isCustomTopic) {
        setIsCustomTopic(false);
        setCustomTopic('');
      }
    } catch (error: any) {
      console.error('Full save error:', error);
      const message = error?.message || '';
      if (message.includes('row-level security policy')) {
        alert('O banco bloqueou a gravacao por RLS. Execute o SQL atualizado de policies no Supabase e confirme que seu perfil esta com role admin.');
      } else {
        alert(message || 'Erro ao salvar questões no banco.');
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f2f7ff_40%,#f4fbf7_100%)] p-5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.35)] md:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Ambiente administrativo</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900 md:text-4xl">Painel Administrativo</h1>
          <p className="text-gray-500">Gerencie a plataforma e gere conteúdo.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`shrink-0 rounded-full px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'dashboard' ? 'bg-emerald-600 text-white shadow-[0_18px_40px_-28px_rgba(5,150,105,0.55)]' : 'bg-white text-gray-500 ring-1 ring-gray-200'}`}
        >
          Visão Geral
        </button>
        <button
          onClick={() => setActiveTab('generator')}
          className={`shrink-0 rounded-full px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'generator' ? 'bg-emerald-600 text-white shadow-[0_18px_40px_-28px_rgba(5,150,105,0.55)]' : 'bg-white text-gray-500 ring-1 ring-gray-200'}`}
        >
          Gerador IA
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`shrink-0 rounded-full px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'users' ? 'bg-emerald-600 text-white shadow-[0_18px_40px_-28px_rgba(5,150,105,0.55)]' : 'bg-white text-gray-500 ring-1 ring-gray-200'}`}
        >
          Gerenciar Usuários
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="bg-white p-5 rounded-[1.8rem] shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Usuários</p>
              <p className="text-2xl font-bold text-gray-900">{stats.users}</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-[1.8rem] shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Questões</p>
              <p className="text-2xl font-bold text-gray-900">{stats.questions}</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-[1.8rem] shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Usuários Premium</p>
              <p className="text-2xl font-bold text-gray-900">{stats.premium}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900">Lista de Usuários</h2>
            <button onClick={fetchUsers} className="text-emerald-600 text-sm font-medium hover:underline">Atualizar</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 font-medium">Nome</th>
                  <th className="px-6 py-3 font-medium">Cargo</th>
                  <th className="px-6 py-3 font-medium">Área Atual</th>
                  <th className="px-6 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingUsers ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">Carregando...</td></tr>
                ) : userList.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">Nenhum usuário encontrado.</td></tr>
                ) : (
                  userList.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                        <p className="text-xs text-gray-500">{u.id.substring(0, 8)}...</p>
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={u.role} 
                          onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                          className="text-xs border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                        >
                          <option value="free">Free</option>
                          <option value="premium">Premium</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">{u.areas?.name || 'Não selecionada'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={u.selected_area_id || ''} 
                          onChange={(e) => handleUpdateUserArea(u.id, e.target.value)}
                          className="text-xs border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                        >
                          <option value="">Nenhuma</option>
                          {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-xl text-sm mb-4">
              Modo Gemini: <code>{geminiMode}</code> | Modelo preferencial: <code>{geminiModel}</code>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-xs uppercase tracking-wider text-emerald-700 font-semibold">Questoes</p>
                <p className="text-2xl font-bold text-emerald-900 mt-1">{stats.questions}</p>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs uppercase tracking-wider text-blue-700 font-semibold">Topicos da area</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{contentCatalog.length}</p>
              </div>
              <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
                <p className="text-xs uppercase tracking-wider text-purple-700 font-semibold">Preview atual</p>
                <p className="text-2xl font-bold text-purple-900 mt-1">{genResult?.questions?.length || 0}</p>
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-600" />
              Gerador Inteligente (Gemini)
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Área</label>
                <select
                  value={genArea}
                  onChange={(e) => { setGenArea(e.target.value); setGenTopic(''); setIsCustomTopic(false); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                >
                  <option value="" disabled>Selecione</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tópico</label>
                <div className="space-y-2">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                    disabled={!genArea}
                  >
                    <option value="" disabled>Selecione</option>
                    {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    <option value="custom">+ Criar Novo Tópico</option>
                  </select>
                  
                  {isCustomTopic && (
                    <input
                      type="text"
                      placeholder="Nome do novo tópico..."
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                      autoFocus
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                <input
                  type="number"
                  min="1" max="20"
                  value={genCount}
                  onChange={(e) => setGenCount(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dificuldade</label>
                <select
                  value={genDiff}
                  onChange={(e) => setGenDiff(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                >
                  <option value="easy">Fácil</option>
                  <option value="medium">Média</option>
                  <option value="hard">Difícil</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conteúdo Base (Opcional)</label>
              <textarea
                rows={5}
                value={genContent}
                onChange={(e) => setGenContent(e.target.value)}
                placeholder="Cole aqui o texto base para a IA gerar as questões..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-sm font-mono"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || !genArea || (!genTopic && !isCustomTopic) || (isCustomTopic && !customTopic)}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {generating && !genResult ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
              {generating && !genResult ? 'Gerando...' : 'Gerar Questões'}
            </button>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 p-6 rounded-2xl shadow-inner border border-gray-200 overflow-y-auto max-h-[600px]">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Pré-visualização</h2>
            
            <div className="mb-4 space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Mapa de conteudo</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {genArea ? 'Veja abaixo os topicos da area e quantas questoes ja existem em cada um.' : 'Selecione uma area para ver o catalogo.'}
                    </p>
                  </div>
                  <button
                    onClick={() => fetchContentCatalog(genArea)}
                    disabled={!genArea || loadingCatalog}
                    className="text-sm font-medium text-emerald-600 disabled:opacity-50"
                  >
                    {loadingCatalog ? 'Atualizando...' : 'Atualizar'}
                  </button>
                </div>
                <div className="mt-4 space-y-2 max-h-44 overflow-y-auto pr-1">
                  {!genArea ? (
                    <p className="text-sm text-gray-500">Nenhuma area selecionada.</p>
                  ) : contentCatalog.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhum topico encontrado para esta area.</p>
                  ) : (
                    contentCatalog.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                        <span className="text-sm text-gray-700">{item.name}</span>
                        <span className="text-xs font-semibold text-gray-500">{item.questionsCount} questoes</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {!genResult ? (
              <div className="text-center text-gray-500 py-12">
                Nenhuma questão gerada ainda.
              </div>
            ) : (
              <div className="space-y-6">
                {genResult.questions.map((q: any, i: number) => (
                  <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <p className="font-medium text-gray-900 mb-3 text-sm">{i + 1}. {q.question}</p>
                    <div className="space-y-2 pl-4">
                      {q.alternatives.map((a: any, j: number) => (
                        <div key={j} className={`text-sm p-2 rounded ${a.isCorrect ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'text-gray-600'}`}>
                          {a.text}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                      <strong>Explicação:</strong> {q.explanation}
                    </div>
                  </div>
                ))}
                
                <button
                  onClick={handleSaveGenerated}
                  disabled={generating}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors sticky bottom-0"
                >
                  {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  Salvar {genResult.questions.length} Questões no Banco
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
