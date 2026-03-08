import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { generateQuestions, getGeminiConfigStatus } from '../lib/gemini';
import { stripAlternativePrefix } from '../lib/quiz';
import {
  BellRing,
  CheckCircle2,
  Database,
  FolderTree,
  LayoutDashboard,
  Loader2,
  Monitor,
  Plus,
  Search,
  Settings,
  Trash2,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';

type ManagedQuestion = {
  id: string;
  content: string;
  difficulty: string;
  exam_year: number | null;
  alternatives?: { id: string; content: string; is_correct: boolean }[];
  question_explanations?: { id: string; content: string }[];
};

type ManagedTopic = {
  id: string;
  name: string;
  description?: string | null;
  questions: ManagedQuestion[];
};

type PaymentRequest = {
  id: string;
  created_at: string;
  user_id: string;
  payer_name: string;
  plan_id: string;
  plan_name: string;
  amount_kwanza: number;
  duration_months: number;
  payment_reference: string;
  proof_url: string;
  student_note?: string | null;
  admin_notes?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  profiles?: { full_name: string } | null;
};

export default function Admin() {
  const { profile } = useAuthStore();
  const { areas, topics, fetchAreas, fetchTopics } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'dashboard');
  const [stats, setStats] = useState({ users: 0, questions: 0, premium: 0, pendingPayments: 0 });
  const [userList, setUserList] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [contentCatalog, setContentCatalog] = useState<any[]>([]);
  const [managementArea, setManagementArea] = useState('');
  const [managementTopics, setManagementTopics] = useState<ManagedTopic[]>([]);
  const [loadingManagement, setLoadingManagement] = useState(false);
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaDescription, setNewAreaDescription] = useState('');
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDescription, setNewTopicDescription] = useState('');
  const [savingContent, setSavingContent] = useState(false);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [adminPaymentNotes, setAdminPaymentNotes] = useState<Record<string, string>>({});

  // Monitoring State
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [recentAttempts, setRecentAttempts] = useState<any[]>([]);
  const [loadingMonitor, setLoadingMonitor] = useState(false);
  const [selectedUserDetail, setSelectedUserDetail] = useState<any>(null);

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

  const changeTab = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*, areas(name), student_number, last_active')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUserList(data);
    }
    setLoadingUsers(false);
  };

  const fetchOnlineUsers = async () => {
    try {
      // Assume we have a last_active or is_online flag in profiles or activity table
      const { data } = await supabase.from('profiles').select('id, full_name, student_number, last_active').order('last_active', { ascending: false }).limit(50);
      setOnlineUsers(data || []);
    } catch (err) {
      console.error('Error fetching online users', err);
    }
  };

  const [geminiModel, setGeminiModel] = useState('');
  const [geminiMode, setGeminiMode] = useState('');

  const fetchStats = async () => {
    const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: qCount } = await supabase.from('questions').select('*', { count: 'exact', head: true });
    const { count: premCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'premium');
    const { count: pendingPaymentsCount } = await supabase
      .from('payment_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    setStats({
      users: usersCount || 0,
      questions: qCount || 0,
      premium: premCount || 0,
      pendingPayments: pendingPaymentsCount || 0,
    });
  };

  const fetchPaymentRequests = async () => {
    setLoadingPayments(true);
    try {
      let query = supabase
        .from('payment_requests')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false });

      if (paymentFilter !== 'all') {
        query = query.eq('status', paymentFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      setPaymentRequests((data || []) as PaymentRequest[]);
    } catch (error) {
      console.error('Error fetching payment requests:', error);
    } finally {
      setLoadingPayments(false);
    }
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

  const fetchManagementContent = async (areaId: string) => {
    if (!areaId) {
      setManagementTopics([]);
      return;
    }

    setLoadingManagement(true);
    try {
      const { data: topicRows, error: topicError } = await supabase
        .from('topics')
        .select('id, name, description')
        .eq('area_id', areaId)
        .order('name', { ascending: true });

      if (topicError) throw topicError;

      const topicIds = (topicRows || []).map((topic) => topic.id);
      if (topicIds.length === 0) {
        setManagementTopics([]);
        return;
      }

      const { data: questionRows, error: questionError } = await supabase
        .from('questions')
        .select(
          `
          id,
          topic_id,
          content,
          difficulty,
          exam_year,
          alternatives (id, content, is_correct),
          question_explanations (id, content)
        `
        )
        .in('topic_id', topicIds)
        .order('created_at', { ascending: false });

      if (questionError) throw questionError;

      const questionsByTopic = new Map<string, ManagedQuestion[]>();
      (questionRows || []).forEach((question: any) => {
        const items = questionsByTopic.get(question.topic_id) || [];
        items.push(question);
        questionsByTopic.set(question.topic_id, items);
      });

      setManagementTopics(
        (topicRows || []).map((topic) => ({
          ...topic,
          questions: questionsByTopic.get(topic.id) || [],
        }))
      );
    } catch (error) {
      console.error('Error fetching management content:', error);
    } finally {
      setLoadingManagement(false);
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
    if (activeTab === 'dashboard') {
      void fetchOnlineUsers();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'payments' || activeTab === 'dashboard') {
      void fetchPaymentRequests();
    }
  }, [activeTab, paymentFilter]);

  useEffect(() => {
    if (genArea) {
      fetchTopics(genArea);
      fetchContentCatalog(genArea);
    }
  }, [genArea, fetchTopics]);

  const fetchMonitoringData = async () => {
    setLoadingMonitor(true);
    try {
      // Fetch recent quiz attempts with user info
      const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('*, profiles(full_name, student_number), areas(name)')
        .order('started_at', { ascending: false })
        .limit(20);

      // Fetch recent global activity logs
      const { data: activities } = await supabase
        .from('activity_logs')
        .select('*, profiles(full_name, student_number)')
        .order('activity_date', { ascending: false })
        .limit(20);

      setRecentAttempts(attempts || []);
      setRecentActivities(activities || []);
    } catch (err) {
      console.error('Error fetching monitor data:', err);
    } finally {
      setLoadingMonitor(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'monitor') {
      fetchMonitoringData();
      const interval = setInterval(fetchMonitoringData, 15000); // 15s live feed
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  useEffect(() => {
    if (managementArea) {
      fetchManagementContent(managementArea);
    }
  }, [managementArea]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchStats();
      if (activeTab === 'payments' || activeTab === 'dashboard') {
        void fetchPaymentRequests();
        void fetchOnlineUsers();
      }
    }, 30000);

    return () => window.clearInterval(interval);
  }, [activeTab, paymentFilter]);

  if (profile?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
          <Settings className="w-8 h-8" />
        </div>
        {onlineUsers && onlineUsers.length > 0 && (
          <div className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700">Usuários recentes (últimos 50)</p>
            <div className="mt-3 grid gap-2">
              {onlineUsers.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{u.full_name}</div>
                    <div className="text-xs text-gray-500">{u.student_number || '—'}</div>
                  </div>
                  <div className="text-xs text-gray-500">{u.last_active ? new Date(u.last_active).toLocaleString() : '—'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
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
            throw new Error(`Erro ao inserir explicação: ${expError.message}`);
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

  const requireAdmin = (action: string) => {
    const message =
      `Tem certeza que deseja ${action}? Esta acao pode remover conteudo em cascata e nao deve ser usada sem revisao.`;
    return window.confirm(message);
  };

  const handleCreateArea = async () => {
    if (!newAreaName.trim()) return;

    setSavingContent(true);
    try {
      const { error } = await supabase.from('areas').insert({
        name: newAreaName.trim(),
        description: newAreaDescription.trim() || null,
      });

      if (error) throw error;

      setNewAreaName('');
      setNewAreaDescription('');
      await fetchAreas();
      await fetchStats();
    } catch (error: any) {
      alert(error?.message || 'Erro ao criar area.');
    } finally {
      setSavingContent(false);
    }
  };

  const handleCreateTopic = async () => {
    if (!managementArea || !newTopicName.trim()) return;

    setSavingContent(true);
    try {
      const { error } = await supabase.from('topics').insert({
        area_id: managementArea,
        name: newTopicName.trim(),
        description: newTopicDescription.trim() || null,
      });

      if (error) throw error;

      setNewTopicName('');
      setNewTopicDescription('');
      await fetchTopics(managementArea);
      await fetchContentCatalog(managementArea);
      await fetchManagementContent(managementArea);
    } catch (error: any) {
      alert(error?.message || 'Erro ao criar topico.');
    } finally {
      setSavingContent(false);
    }
  };

  const handleDeleteArea = async (areaId: string) => {
    if (!requireAdmin('apagar esta area')) return;

    setSavingContent(true);
    try {
      const { error } = await supabase.from('areas').delete().eq('id', areaId);
      if (error) throw error;

      if (managementArea === areaId) {
        setManagementArea('');
        setManagementTopics([]);
      }

      await fetchAreas();
      await fetchStats();
    } catch (error: any) {
      alert(error?.message || 'Erro ao apagar area. Se existirem perfis ligados a ela, remova ou altere primeiro.');
    } finally {
      setSavingContent(false);
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!requireAdmin('apagar este topico')) return;

    setSavingContent(true);
    try {
      const { error } = await supabase.from('topics').delete().eq('id', topicId);
      if (error) throw error;

      await fetchTopics(managementArea);
      await fetchContentCatalog(managementArea);
      await fetchManagementContent(managementArea);
      await fetchStats();
    } catch (error: any) {
      alert(error?.message || 'Erro ao apagar topico.');
    } finally {
      setSavingContent(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!requireAdmin('apagar esta pergunta')) return;

    setSavingContent(true);
    try {
      const { error } = await supabase.from('questions').delete().eq('id', questionId);
      if (error) throw error;

      await fetchContentCatalog(managementArea);
      await fetchManagementContent(managementArea);
      await fetchStats();
    } catch (error: any) {
      alert(error?.message || 'Erro ao apagar pergunta.');
    } finally {
      setSavingContent(false);
    }
  };

  const handleReviewPayment = async (request: PaymentRequest, status: 'approved' | 'rejected') => {
    const adminNotes = adminPaymentNotes[request.id]?.trim() || null;
    const confirmed = window.confirm(
      status === 'approved'
        ? 'Confirmar aprovacao deste pagamento e ativar premium?'
        : 'Confirmar rejeicao deste pagamento?'
    );

    if (!confirmed) return;

    setLoadingPayments(true);
    try {
      const reviewedAt = new Date().toISOString();
      const { error: paymentError } = await supabase
        .from('payment_requests')
        .update({
          status,
          admin_notes: adminNotes,
          reviewed_at: reviewedAt,
        })
        .eq('id', request.id);

      if (paymentError) throw paymentError;

      if (status === 'approved') {
        const startDate = new Date();
        // Para modelo de cobrança sem duracao, mantemos a subscription ativa sem end_date
        await supabase
          .from('subscriptions')
          .update({ is_active: false })
          .eq('user_id', request.user_id)
          .eq('is_active', true);

        const { error: subscriptionError } = await supabase.from('subscriptions').insert({
          user_id: request.user_id,
          plan_type: request.plan_id,
          start_date: startDate.toISOString(),
          end_date: null,
          is_active: true,
        });

        if (subscriptionError) throw subscriptionError;

        const { error: profileError } = await supabase
          .from('profiles')
          .update({ role: 'premium' })
          .eq('id', request.user_id);

        if (profileError) throw profileError;
      }

      await fetchStats();
      await fetchPaymentRequests();
      await fetchUsers();
    } catch (error: any) {
      alert(error?.message || 'Erro ao rever pagamento.');
    } finally {
      setLoadingPayments(false);
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
          onClick={() => changeTab('dashboard')}
          className={`shrink-0 rounded-full px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'dashboard' ? 'bg-emerald-600 text-white shadow-[0_18px_40px_-28px_rgba(5,150,105,0.55)]' : 'bg-white text-gray-500 ring-1 ring-gray-200'}`}
        >
          Visão Geral
        </button>
        <button
          onClick={() => changeTab('payments')}
          className={`shrink-0 rounded-full px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'payments' ? 'bg-emerald-600 text-white shadow-[0_18px_40px_-28px_rgba(5,150,105,0.55)]' : 'bg-white text-gray-500 ring-1 ring-gray-200'}`}
        >
          Pagamentos {stats.pendingPayments > 0 ? `(${stats.pendingPayments})` : ''}
        </button>
        <button
          onClick={() => changeTab('content')}
          className={`shrink-0 rounded-full px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'content' ? 'bg-emerald-600 text-white shadow-[0_18px_40px_-28px_rgba(5,150,105,0.55)]' : 'bg-white text-gray-500 ring-1 ring-gray-200'}`}
        >
          Conteudo e IA
        </button>
        <button
          onClick={() => changeTab('users')}
          className={`shrink-0 rounded-full px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'users' ? 'bg-emerald-600 text-white shadow-[0_18px_40px_-28px_rgba(5,150,105,0.55)]' : 'bg-white text-gray-500 ring-1 ring-gray-200'}`}
        >
          Gerenciar Usuários
        </button>
        <button
          onClick={() => changeTab('monitor')}
          className={`shrink-0 rounded-full px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'monitor' ? 'bg-emerald-600 text-white shadow-[0_18px_40px_-28px_rgba(5,150,105,0.55)]' : 'bg-white text-gray-500 ring-1 ring-gray-200'}`}
        >
          Monitorização
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          {stats.pendingPayments > 0 && (
            <div className="rounded-[1.8rem] border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <BellRing className="mt-1 h-5 w-5 text-amber-700" />
                <div>
                  <p className="text-lg font-black text-slate-900">
                    Há {stats.pendingPayments} pagamento{stats.pendingPayments > 1 ? 's' : ''} pendente{stats.pendingPayments > 1 ? 's' : ''}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Revise estes comprovativos o mais rápido possível para o estudante não ficar à espera do plano.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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
            <div className="bg-white p-5 rounded-[1.8rem] shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                <BellRing className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Pagamentos Pendentes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingPayments}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-5">
          <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Pagamentos para aprovação</h2>
                <p className="text-sm text-slate-500">Aprove ou rejeite e ative o premium manualmente.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['pending', 'approved', 'rejected', 'all'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setPaymentFilter(filter)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${paymentFilter === filter ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                  >
                    {filter === 'pending'
                      ? 'Pendentes'
                      : filter === 'approved'
                        ? 'Aprovados'
                        : filter === 'rejected'
                          ? 'Rejeitados'
                          : 'Todos'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loadingPayments ? (
            <div className="rounded-[1.8rem] border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
              A carregar pedidos de pagamento...
            </div>
          ) : paymentRequests.length === 0 ? (
            <div className="rounded-[1.8rem] border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
              Nenhum pagamento nesta fila.
            </div>
          ) : (
            paymentRequests.map((request) => (
              <div key={request.id} className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
                        {request.status}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                        {request.plan_name}
                      </span>
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-800">
                        {request.amount_kwanza?.toLocaleString('pt-PT')} Kz
                      </span>
                    </div>
                    <p className="mt-3 text-lg font-black text-slate-900">{request.profiles?.full_name || request.payer_name}</p>
                    <div className="mt-2 space-y-1 text-sm text-slate-600">
                      <p>Referência: {request.payment_reference}</p>
                      <p>Pedido: {new Date(request.created_at).toLocaleString('pt-PT')}</p>
                      {request.student_note && <p>Nota do estudante: {request.student_note}</p>}
                      {request.admin_notes && <p>Nota do admin: {request.admin_notes}</p>}
                    </div>
                    <a
                      href={request.proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
                    >
                      Abrir comprovativo
                    </a>
                  </div>

                  <div className="w-full max-w-md rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Nota do admin</label>
                    <textarea
                      rows={3}
                      value={adminPaymentNotes[request.id] ?? request.admin_notes ?? ''}
                      onChange={(e) =>
                        setAdminPaymentNotes((prev) => ({
                          ...prev,
                          [request.id]: e.target.value,
                        }))
                      }
                      placeholder="Escreva aqui a decisão ou motivo."
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                    />
                    {request.status === 'pending' && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => handleReviewPayment(request, 'approved')}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Aprovar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewPayment(request, 'rejected')}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600"
                        >
                          <XCircle className="h-4 w-4" />
                          Rejeitar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'content' && (
        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-6">
            <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                  <FolderTree className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Criar area</h2>
                  <p className="text-sm text-slate-500">Use isto apenas quando surgir uma nova carreira real.</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <input
                  type="text"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  placeholder="Nome da area"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
                <textarea
                  rows={3}
                  value={newAreaDescription}
                  onChange={(e) => setNewAreaDescription(e.target.value)}
                  placeholder="Descricao breve"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleCreateArea}
                  disabled={savingContent || !newAreaName.trim()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Criar area
                </button>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-900">Areas existentes</h2>
              <div className="mt-4 space-y-3">
                {areas.map((area) => (
                  <div key={area.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">{area.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{area.description || 'Sem descricao.'}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setManagementArea(area.id)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                        >
                          Gerir
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteArea(area.id)}
                          disabled={savingContent}
                          className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-50"
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

          <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">Gestao de topicos e perguntas</h2>
                <p className="text-sm text-slate-500">Apague topicos inteiros ou perguntas especificas sem passar pelo banco manualmente.</p>
              </div>
              <div className="w-full max-w-sm">
                <label className="mb-2 block text-sm font-medium text-slate-700">Area</label>
                <select
                  value={managementArea}
                  onChange={(e) => setManagementArea(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="">Selecione uma area</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {managementArea && (
              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <h3 className="text-sm font-black text-emerald-800">Criar topico manualmente</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <input
                    type="text"
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    placeholder="Nome do topico"
                    className="rounded-xl border border-emerald-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    value={newTopicDescription}
                    onChange={(e) => setNewTopicDescription(e.target.value)}
                    placeholder="Descricao opcional"
                    className="rounded-xl border border-emerald-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleCreateTopic}
                    disabled={savingContent || !newTopicName.trim()}
                    className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Criar topico
                  </button>
                </div>
              </div>
            )}

            <div className="mt-5 space-y-4">
              {!managementArea ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                  Escolha uma area para gerenciar o conteudo.
                </div>
              ) : loadingManagement ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                  A carregar estrutura de conteudo...
                </div>
              ) : managementTopics.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                  Esta area ainda nao tem topicos.
                </div>
              ) : (
                managementTopics.map((topic) => (
                  <div key={topic.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-lg font-black text-slate-900">{topic.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{topic.description || 'Sem descricao.'}</p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {topic.questions.length} perguntas
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedTopicId(expandedTopicId === topic.id ? null : topic.id)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                        >
                          {expandedTopicId === topic.id ? 'Esconder' : 'Ver perguntas'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTopic(topic.id)}
                          disabled={savingContent}
                          className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Apagar topico
                        </button>
                      </div>
                    </div>

                    {expandedTopicId === topic.id && (
                      <div className="mt-4 space-y-3">
                        {topic.questions.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                            Nenhuma pergunta neste topico.
                          </div>
                        ) : (
                          topic.questions.map((question, index) => (
                            <div key={question.id} className="rounded-xl border border-slate-200 bg-white p-4">
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-slate-900">
                                    {index + 1}. {question.content}
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                                    <span className="rounded-full bg-cyan-50 px-3 py-1 text-cyan-700">
                                      {question.difficulty}
                                    </span>
                                    {question.exam_year && (
                                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                                        {question.exam_year}
                                      </span>
                                    )}
                                  </div>
                                  {question.alternatives && question.alternatives.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                      {question.alternatives.map((alternative) => (
                                        <div
                                          key={alternative.id}
                                          className={`rounded-lg px-3 py-2 text-sm ${alternative.is_correct
                                            ? 'bg-emerald-50 text-emerald-800'
                                            : 'bg-slate-50 text-slate-600'
                                            }`}
                                        >
                                          {alternative.content}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {question.question_explanations?.[0]?.content && (
                                    <p className="mt-3 text-sm leading-6 text-slate-500">
                                      Explicacao: {question.question_explanations[0].content}
                                    </p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteQuestion(question.id)}
                                  disabled={savingContent}
                                  className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Apagar pergunta
                                </button>
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
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-lg font-bold text-gray-900">Lista de Usuários</h2>
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-emerald-500"
                />
              </div>
              <button onClick={fetchUsers} className="text-emerald-600 text-sm font-medium hover:underline whitespace-nowrap">Atualizar</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 font-medium">Nome</th>
                  <th className="px-6 py-3 font-medium">Cargo</th>
                  <th className="px-6 py-3 font-medium">Nº Estudante</th>
                  <th className="px-6 py-3 font-medium">Área Atual</th>
                  <th className="px-6 py-3 font-medium">Últ. ativo</th>
                  <th className="px-6 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingUsers ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">Carregando...</td></tr>
                ) : userList.filter(u =>
                  u.full_name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                  (u.student_number?.toLowerCase().includes(userSearchQuery.toLowerCase()))
                ).length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">Nenhum usuário encontrado.</td></tr>
                ) : (
                  userList
                    .filter(u =>
                      u.full_name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                      (u.student_number?.toLowerCase().includes(userSearchQuery.toLowerCase()))
                    )
                    .map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                            {u.last_active && (Date.now() - new Date(u.last_active).getTime() < 5 * 60 * 1000) && (
                              <span className="h-2 w-2 rounded-full bg-emerald-500" title="Ativo agora" />
                            )}
                          </div>
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
                          <span className="text-sm text-gray-700">{u.student_number || '—'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-700">{u.areas?.name || 'Não selecionada'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">{u.last_active ? new Date(u.last_active).toLocaleString() : '—'}</span>
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
                          <div className="mt-2">
                            <button type="button" onClick={async () => {
                              try {
                                const { data } = await supabase.from('activity_logs').select('*').eq('user_id', u.id).order('activity_date', { ascending: false }).limit(20);
                                if (!data || data.length === 0) {
                                  alert('Sem atividade recente para este usuário.');
                                  return;
                                }
                                const lines = (data || []).map((r: any) => `${r.activity_date} - ${r.activity_type} (${r.count || 1})`).join('\n');
                                alert(lines);
                              } catch (err) {
                                console.error(err);
                                alert('Erro ao buscar atividade. Veja console.');
                              }
                            }} className="mt-2 text-xs text-emerald-600 hover:underline">Ver atividade</button>
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'content' && (
        <div className="pt-8 mt-10 border-t border-slate-200">
          <h2 className="text-2xl font-black text-slate-900 mb-6">Gerador de Questões com IA</h2>
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
        </div>
      )}
      {activeTab === 'monitor' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Live Feed: Recent Simulations */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-blue-50/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-100 text-blue-600">
                    <Database className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-black text-slate-900">Atividade em Tempo Real</h2>
                </div>
                {loadingMonitor && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {recentAttempts.length === 0 ? (
                  <p className="text-center py-10 text-slate-400 text-sm italic">Esperando por atividade...</p>
                ) : (
                  recentAttempts.map((attempt) => (
                    <div key={attempt.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white transition-colors border-l-4 border-l-blue-500">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-black text-slate-900">{attempt.profiles?.full_name}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(attempt.started_at).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">Iniciou Simulação: <span className="font-semibold">{attempt.areas?.name}</span></p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${attempt.is_completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {attempt.is_completed ? 'Concluído' : 'Em curso'}
                        </span>
                        {attempt.is_completed && (
                          <span className="text-[10px] font-black text-slate-500">Score: {attempt.score}%</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Global Logs */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-50/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
                    <Monitor className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-black text-slate-900">Logs de Uso</h2>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {recentActivities.map((log, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-emerald-400" />
                      <div>
                        <span className="font-bold text-slate-900">{log.profiles?.full_name}</span>
                        <span className="text-slate-500 ml-2">{log.activity_type}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400">{log.activity_date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* User Search & Drill-down Section */}
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 space-y-4">
              <h2 className="text-xl font-black text-slate-900">Pesquisar Alunos</h2>
              <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Nome ou Nº de Estudante..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 outline-none focus:border-emerald-500 transition-all font-medium text-slate-700"
                />
              </div>
            </div>
            <div className="p-8 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">
                    <th className="pb-4 px-4">Estudante</th>
                    <th className="pb-4 px-4">Área</th>
                    <th className="pb-4 px-4">Nível</th>
                    <th className="pb-4 px-4">Última Atividade</th>
                    <th className="pb-4 px-4">XP Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {userList
                    .filter(u =>
                      u.full_name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                      (u.student_number?.toLowerCase().includes(userSearchQuery.toLowerCase()))
                    )
                    .slice(0, 50)
                    .map((u) => (
                      <tr key={u.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{u.full_name}</span>
                            <span className="text-[10px] text-slate-400 font-medium">#{u.id.substring(0, 8)}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-sm text-slate-600 font-medium">{u.areas?.name || '—'}</td>
                        <td className="py-4 px-4">
                          <span className={`text-[10px] px-2 py-1 rounded-lg font-black uppercase ${u.role === 'premium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-[10px] text-slate-500 font-bold uppercase">
                          {u.last_active ? new Date(u.last_active).toLocaleString('pt-PT') : 'Nunca'}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <Zap className="h-3 w-3 text-yellow-500 fill-current" />
                            <span className="font-black text-slate-900">{u.total_xp || 0}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
