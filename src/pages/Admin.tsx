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
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Users,
  XCircle,
  Zap,
  MessageCircle,
  ShieldCheck,
  Clock,
  Sparkles,
  LogOut,
  User,
  Shield,
  Layout as LayoutIcon,
  Activity,
  LifeBuoy,
  Megaphone
} from 'lucide-react';
import AdminBackup from '../components/AdminBackup';
import AdminNews from '../components/AdminNews';

type ManagedQuestion = {
  id: string;
  content: string;
  difficulty: string;
  exam_year: number | null;
  is_contest_highlight: boolean;
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
  const { profile, signOut } = useAuthStore();
  const { areas, topics, fetchAreas, fetchTopics } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'dashboard');
  const [dbError, setDbError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    users: 0,
    questions: 0,
    premium: 0,
    pendingPayments: 0,
  });
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

  // Support state
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [loadingSupport, setLoadingSupport] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [adminResponse, setAdminResponse] = useState('');

  // Generator State
  const [genArea, setGenArea] = useState('');
  const [genTopic, setGenTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [isCustomTopic, setIsCustomTopic] = useState(false);
  const [genCount, setGenCount] = useState(5);
  const [genDiff, setGenDiff] = useState('medium');
  const [genContestHighlight, setGenContestHighlight] = useState(false);
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
    if (tab === 'monitor') {
      fetchUsers();
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    console.log('Fetching users from profiles table...');
    const { data, error } = await supabase
      .from('profiles')
      .select('*, areas(name), student_number, last_active, total_xp')
      .order('last_active', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('CRITICAL: Error fetching users:', error);
      // alert(`Erro ao carregar usuários: ${error.message}\nVerifique se rodou o script SQL das colunas student_number e last_active.`);
    }
    if (!error && data) {
      console.log('Users fetched successfully. Count:', data.length);
      setUserList(data);
    } else if (!error && !data) {
      console.log('No users found in database (data is null or empty).');
    }
    setLoadingUsers(false);
  };

  const fetchOnlineUsers = async () => {
    try {
      // Threshold: 5 minutes from now
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, student_number, last_active')
        .gte('last_active', fiveMinsAgo)
        .order('last_active', { ascending: false });
      setOnlineUsers(data || []);
    } catch (err) {
      console.error('Error fetching online users', err);
    }
  };

  const [geminiModel, setGeminiModel] = useState('');
  const [geminiMode, setGeminiMode] = useState('');

  const fetchStats = async () => {
    console.log('Fetching platform statistics...');
    setDbError(null);
    const { count: usersCount, error: usersErr } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: qCount, error: qErr } = await supabase.from('questions').select('*', { count: 'exact', head: true });
    const { count: premCount, error: premErr } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'premium');
    const { count: pendingPaymentsCount, error: payErr } = await supabase
      .from('payment_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (usersErr || qErr || premErr || payErr) {
      console.error('Error fetching stats:', { usersErr, qErr, premErr, payErr });
      if (usersErr) {
        console.error('Profiles count error:', usersErr.message);
        setDbError(usersErr.message);
      }
    }

    console.log('Stats Result:', { usersCount, qCount, premCount, pendingPaymentsCount });

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
    if (activeTab === 'monitor') {
      fetchUsers();
    }
  }, [fetchAreas, activeTab]);

  useEffect(() => {
    if (activeTab === 'monitor') {
      fetchUsers();
      void fetchMonitoringData();
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
        .order('created_at', { ascending: false })
        .limit(30);

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

  const fetchSupportMessages = async () => {
    setLoadingSupport(true);
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSupportMessages(data || []);
    } catch (err) {
      console.error('Error fetching support messages:', err);
    } finally {
      setLoadingSupport(false);
    }
  };

  const handleUpdateSupportStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('support_messages')
        .update({
          status,
          admin_response: adminResponse,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);
      if (error) throw error;
      setAdminResponse('');
      setSelectedTicket(null);
      fetchSupportMessages();
    } catch (err) {
      alert('Erro ao atualizar ticket.');
    }
  };

  useEffect(() => {
    if (activeTab === 'support') {
      fetchSupportMessages();
    }
  }, [activeTab]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchStats();
      if (activeTab === 'payments' || activeTab === 'dashboard') {
        void fetchPaymentRequests();
        void fetchOnlineUsers();
      }
      if (activeTab === 'support') {
        void fetchSupportMessages();
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
            difficulty: q.difficulty || genDiff,
            is_contest_highlight: genContestHighlight
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

      {/* Tabs Reorganizadas por Categorias */}
      <div className="space-y-4">
        {/* Gestão e Estrutura */}
        <div>
          <p className="mb-2 ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Gestão e Operações</p>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              onClick={() => changeTab('dashboard')}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'}`}
            >
              <LayoutIcon className="h-4 w-4" />
              Geral
            </button>
            <button
              onClick={() => changeTab('payments')}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all ${activeTab === 'payments' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'}`}
            >
              <Zap className="h-4 w-4" />
              Pagamentos {stats.pendingPayments > 0 && <span className="ml-1 rounded-md bg-amber-400 px-1.5 py-0.5 text-[10px] text-slate-900">{stats.pendingPayments}</span>}
            </button>
            <button
              onClick={() => changeTab('content')}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all ${activeTab === 'content' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'}`}
            >
              <FolderTree className="h-4 w-4" />
              Conteúdo & IA
            </button>
          </div>
        </div>

        {/* Monitorização e Suporte */}
        <div>
          <p className="mb-2 ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Monitorização e Suporte</p>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              onClick={() => changeTab('monitor')}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all ${activeTab === 'monitor' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'}`}
            >
              <Activity className="h-4 w-4" />
              Real-time
            </button>
            <button
              onClick={() => changeTab('support')}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all ${activeTab === 'support' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'}`}
            >
              <LifeBuoy className="h-4 w-4" />
              Suporte {supportMessages.filter(m => m.status === 'open').length > 0 && <span className="ml-1 rounded-md bg-sky-400 px-1.5 py-0.5 text-[10px] text-white text-white">{supportMessages.filter(m => m.status === 'open').length}</span>}
            </button>
            <button
              onClick={() => changeTab('social')}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all ${activeTab === 'social' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'}`}
            >
              <Megaphone className="h-4 w-4" />
              News & Alertas
            </button>
          </div>
        </div>

        {/* Sistema e Conta */}
        <div>
          <p className="mb-2 ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Sistema e Conta</p>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              onClick={() => changeTab('backup')}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all ${activeTab === 'backup' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'}`}
            >
              <Database className="h-4 w-4" />
              Backup
            </button>
            <button
              onClick={() => changeTab('profile')}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all ${activeTab === 'profile' ? 'bg-emerald-600 text-white shadow-lg border-emerald-500' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'}`}
            >
              <User className="h-4 w-4" />
              O meu Perfil
            </button>
          </div>
        </div>
      </div>

      <main className="space-y-6">
        {dbError && (
          <div className="rounded-[1.8rem] border border-red-200 bg-red-50 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                <XCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-900">Erro Crítico de Banco de Dados</h3>
                <p className="mt-1 text-sm text-red-700">
                  O sistema não conseguiu carregar os usuários. Isto geralmente significa que as colunas novas não foram criadas no Supabase.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <code className="rounded-lg bg-red-100 px-2 py-1 text-xs font-mono text-red-800">
                    Erro: {dbError}
                  </code>
                </div>
                <p className="mt-3 text-sm font-medium text-red-800">
                  Ação: Vá ao Supabase SQL Editor e execute o arquivo "fix_profiles_schema.sql".
                </p>
              </div>
            </div>
          </div>
        )}

        {stats.users === 0 && !dbError && (
          <div className="rounded-[1.8rem] border border-blue-200 bg-blue-50 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-blue-900">Diagnóstico de Dados</h3>
                <p className="mt-1 text-sm text-blue-700">
                  O banco de dados retornou **0 usuários**. Se existem usuários registrados, a política de segurança (RLS) pode estar a bloquear o seu acesso.
                </p>
                <p className="mt-2 text-xs text-blue-600">
                  Seu User ID: <code className="font-mono bg-blue-100 px-1 rounded">{profile?.id}</code> | Seu Cargo: <code className="font-mono bg-blue-100 px-1 rounded">{profile?.role}</code>
                </p>
                {profile?.role !== 'admin' && (
                  <p className="mt-3 text-sm font-bold text-red-600">
                    AVISO: O seu perfil no banco de dados não está com o cargo 'admin'. Por isso você vê tudo vazio.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

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
          <>
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
                                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${question.is_contest_highlight
                                          ? 'bg-amber-100 text-amber-700'
                                          : 'bg-slate-100 text-slate-600'
                                          }`}
                                      >
                                        <Sparkles className="h-4 w-4" />
                                        {question.is_contest_highlight ? 'Destaque Concurso' : 'Marcar Destaque'}
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="pt-8">
              <div className="bg-blue-50 border border-blue-100 text-blue-700 p-4 rounded-2xl text-xs mb-6 font-bold uppercase tracking-wider">
                IA: {geminiModel} ({geminiMode})
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Área Alvo</label>
                    <select
                      value={genArea}
                      onChange={(e) => { setGenArea(e.target.value); setGenTopic(''); setIsCustomTopic(false); }}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:border-emerald-500 font-bold text-slate-700 text-sm"
                    >
                      <option value="" disabled>Selecione uma área</option>
                      {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Tópico</label>
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
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:border-emerald-500 font-bold text-slate-700 text-sm"
                      disabled={!genArea}
                    >
                      <option value="" disabled>Selecione um tópico</option>
                      {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      <option value="custom">+ Novo Tópico</option>
                    </select>
                  </div>
                </div>

                {isCustomTopic && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Nome do Novo Tópico</label>
                    <input
                      type="text"
                      placeholder="Ex: Farmacologia Básica"
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border-2 border-emerald-100 bg-emerald-50/30 outline-none focus:border-emerald-500 font-bold text-slate-700 text-sm"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Quantidade</label>
                    <input
                      type="number"
                      min="1" max="20"
                      value={genCount}
                      onChange={(e) => setGenCount(parseInt(e.target.value))}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:border-emerald-500 font-bold text-slate-700 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Nível</label>
                    <select
                      value={genDiff}
                      onChange={(e) => setGenDiff(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:border-emerald-500 font-bold text-slate-700 text-sm"
                    >
                      <option value="easy">Fácil</option>
                      <option value="medium">Média</option>
                      <option value="hard">Difícil</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-3 p-4 rounded-2xl border border-amber-100 bg-amber-50/30 cursor-pointer hover:bg-amber-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={genContestHighlight}
                    onChange={(e) => setGenContestHighlight(e.target.checked)}
                    className="w-5 h-5 rounded-lg border-2 border-amber-200 text-amber-500 focus:ring-amber-200"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-amber-900 leading-none">Destaque Especial Concurso</span>
                    <span className="text-[10px] font-bold text-amber-700/60 uppercase tracking-widest mt-1">Marcar estas questões para o simulado do edital</span>
                  </div>
                  <Sparkles className="w-5 h-5 text-amber-400 ml-auto" />
                </label>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Contexto Adicional (PDF/Texto)</label>
                  <textarea
                    rows={4}
                    value={genContent}
                    onChange={(e) => setGenContent(e.target.value)}
                    placeholder="Cole textos de referência aqui..."
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:border-emerald-500 font-medium text-slate-700 text-xs leading-relaxed"
                  />
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={generating || !genArea || (!genTopic && !isCustomTopic)}
                  className="w-full group flex justify-center items-center gap-2 py-4 px-6 rounded-2xl shadow-lg shadow-emerald-200/50 text-sm font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
                >
                  {generating && !genResult ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 group-hover:animate-pulse" />}
                  {generating && !genResult ? 'Pedindo à IA...' : 'Gerar Novas Questões'}
                </button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 p-6 overflow-y-auto max-h-[700px]">
              <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center justify-between">
                <span>Pré-visualização</span>
                {genResult && <span className="text-[10px] bg-white px-2 py-1 rounded-lg border border-slate-200 text-slate-500 font-bold uppercase">{genResult.questions.length} Perguntas</span>}
              </h2>

              {!genResult ? (
                <div className="h-[400px] flex flex-col items-center justify-center text-center p-8 opacity-40">
                  <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mb-4">
                    <Plus className="h-8 w-8 text-slate-400" />
                  </div>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Nada gerado ainda</p>
                  <p className="text-xs text-slate-400 mt-2 max-w-[200px]">Configure o formulário ao lado e clique em gerar.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {genResult.questions.map((q: any, i: number) => (
                    <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 group">
                      <p className="font-black text-slate-900 mb-4 text-sm leading-snug">#0{i + 1} {q.question}</p>
                      <div className="space-y-2">
                        {q.alternatives.map((a: any, j: number) => (
                          <div key={j} className={`text-xs font-bold p-3 rounded-xl border transition-all ${a.isCorrect ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm shadow-emerald-50' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                            {a.text}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-50 text-[10px] text-slate-400 italic">
                        <strong className="text-emerald-600 font-black uppercase not-italic">Porquê?</strong> {q.explanation}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={handleSaveGenerated}
                    disabled={generating}
                    className="w-full flex justify-center items-center gap-3 py-4 px-6 rounded-2xl text-xs font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-200/50 sticky bottom-0 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
                    Guardar no Banco de Dados
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'monitor' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Section 1: Events mapping */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active Simulations */}
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[450px]">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-blue-50/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-blue-100 text-blue-600">
                      <Monitor className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900 leading-tight">Simulações Ativas</h2>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Feed em Tempo Real</p>
                    </div>
                  </div>
                  {loadingMonitor && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
                  {recentAttempts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 italic">
                      <Database className="h-8 w-8 mb-2" />
                      <p className="text-sm">Sem atividade no momento...</p>
                    </div>
                  ) : (
                    recentAttempts.map((attempt) => (
                      <div key={attempt.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white transition-all hover:shadow-md border-l-4 border-l-blue-500 group">
                        <div className="flex justify-between items-start">
                          <span className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{attempt.profiles?.full_name || 'Usuário Desconhecido'}</span>
                          <span className="text-[10px] font-black text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm flex flex-col items-end">
                            <span>{new Date(attempt.started_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}</span>
                            <span className="text-blue-500">{new Date(attempt.started_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2 font-medium">Área: <span className="text-slate-800 font-bold">{attempt.areas?.name}</span></p>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider ${attempt.is_completed ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 text-white animate-pulse'}`}>
                              {attempt.is_completed ? 'Concluído' : 'A Resolver Prova'}
                            </span>
                            {!attempt.is_completed && <span className="text-[10px] font-bold text-blue-600">Ao vivo</span>}
                          </div>
                          {attempt.is_completed && (
                            <div className="flex items-center gap-1.5">
                              <div className="h-1 w-12 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${attempt.score}%` }} />
                              </div>
                              <span className="text-[11px] font-black text-blue-600">{attempt.score}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action Logs */}
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[450px]">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-50/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-600">
                      <Database className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900 leading-tight">Log de Ações</h2>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Global Events</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
                  {recentActivities.map((log, idx) => {
                    const getActivityLabel = (type: string) => {
                      switch (type) {
                        case 'started_simulation': return 'Iniciou Simulação';
                        case 'completed_simulation': return 'Terminou Simulação';
                        case 'started_training': return 'Iniciou Treino';
                        case 'completed_training': return 'Terminou Treino';
                        case 'simulation_attempt': return 'Simulação (Antigo)';
                        case 'training_question': return 'Questão Treino';
                        case 'login': return 'Entrou no sistema';
                        case 'signup': return 'Criou conta';
                        default: return type.replace(/_/g, ' ');
                      }
                    };

                    const metadata = log.activity_metadata || {};
                    const formattedDate = new Date(log.created_at || log.activity_date);
                    const day = formattedDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
                    const hour = formattedDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div key={idx} className="flex flex-col p-4 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`h-2.5 w-2.5 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] ${log.activity_type === 'started_simulation' ? 'bg-blue-500 shadow-blue-500/50' : log.activity_type === 'training_question' ? 'bg-amber-400 shadow-amber-400/50' : 'bg-emerald-500'}`} />
                            <div>
                              <span className="text-[12px] font-black text-slate-900 uppercase tracking-tight">{log.profiles?.full_name || 'Usuário'}</span>
                              <span className={`ml-2 text-[10px] font-black px-2 py-0.5 rounded-lg border uppercase ${log.activity_type.includes('simulation') ? 'bg-blue-50 border-blue-100 text-blue-600' : log.activity_type.includes('training') ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                                {getActivityLabel(log.activity_type)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400">{day}</p>
                            <p className="text-[10px] font-bold text-slate-300">{hour}</p>
                          </div>
                        </div>

                        {(metadata.score !== undefined || metadata.topic_name) && (
                          <div className="mt-2 ml-6.5 pl-6 border-l border-slate-100 flex flex-wrap gap-2">
                            {metadata.topic_name && (
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                {metadata.topic_name}
                              </span>
                            )}
                            {metadata.score !== undefined && (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                                {metadata.score}% ({metadata.correct}/{metadata.total})
                              </span>
                            )}
                            {metadata.duration && (
                              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {Math.floor(metadata.duration / 60)}m {metadata.duration % 60}s
                              </span>
                            )}
                          </div>
                        )}
                        {metadata.area_name && (
                          <div className="mt-1 ml-6.5 pl-6 text-[9px] font-bold text-slate-300 uppercase tracking-tighter">
                            Área: {metadata.area_name}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section 2: User management - Moved outside Section 1 grid */}
            <div className="bg-white rounded-[2.2rem] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-6 bg-[radial-gradient(circle_at_top_right,#f8fafc,transparent)]">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Gestão de Utilizadores</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{userList.length} usuários registrados</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 w-full lg:w-auto">
                  <div className="relative flex-1 lg:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filtrar por nome ou nº de estudante..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50/50 transition-all font-bold text-slate-700 text-sm shadow-sm"
                    />
                  </div>
                  <button
                    onClick={fetchUsers}
                    disabled={loadingUsers}
                    className="flex items-center justify-center h-[52px] w-[52px] lg:w-auto lg:px-6 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {loadingUsers ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5 lg:mr-2" />}
                    <span className="hidden lg:inline">Atualizar Agora</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto p-4">
                <table className="w-full text-left border-separate border-spacing-y-2">
                  <thead className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.25em]">
                    <tr>
                      <th className="px-6 py-4 rounded-l-2xl">NOME / ID</th>
                      <th className="px-6 py-4">CARGO</th>
                      <th className="px-6 py-4 text-center">Nº ESTUDANTE</th>
                      <th className="px-6 py-4">ÁREA ATUAL</th>
                      <th className="px-6 py-4">ÚLT. ATIVO</th>
                      <th className="px-6 py-4 text-right rounded-r-2xl">ACÇÕES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-transparent">
                    {loadingUsers ? (
                      <tr><td colSpan={6} className="px-6 py-32 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto text-emerald-500" /></td></tr>
                    ) : userList.filter(u =>
                      u.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                      (u.student_number?.toLowerCase().includes(userSearchQuery.toLowerCase()))
                    ).length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-32 text-center text-slate-400 font-bold uppercase tracking-widest italic opacity-40">Nenhum rastro encontrado...</td></tr>
                    ) : (
                      userList
                        .filter(u =>
                          u.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                          (u.student_number?.toLowerCase().includes(userSearchQuery.toLowerCase()))
                        )
                        .map((u) => (
                          <tr key={u.id} className="bg-slate-50/20 hover:bg-white transition-all group hover:shadow-xl hover:shadow-slate-200/50">
                            <td className="px-6 py-5 rounded-l-2xl border border-transparent border-l-slate-200 group-hover:border-slate-100">
                              <div className="flex items-center gap-4">
                                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-200 flex items-center justify-center text-white font-black text-xs uppercase transition-transform group-hover:scale-110">
                                  {u.full_name?.substring(0, 2)}
                                </div>
                                <div>
                                  <p className="text-sm font-black text-slate-900 leading-none group-hover:text-emerald-700 transition-colors uppercase tracking-tight">{u.full_name}</p>
                                  <p className="text-[10px] text-slate-400 font-bold mt-1.5 opacity-60">ID: {u.id.substring(0, 8)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <select
                                value={u.role}
                                onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                className={`text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border-2 transition-all outline-none
                                ${u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                    u.role === 'premium' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                      'bg-slate-100 text-slate-600 border-slate-200'}`}
                              >
                                <option value="free">Livre</option>
                                <option value="premium">Premium</option>
                                <option value="admin">Administrador</option>
                              </select>
                            </td>
                            <td className="px-6 py-5 text-center">
                              <div className="inline-block px-3 py-1 bg-white border border-slate-200 rounded-xl shadow-sm text-xs font-black text-slate-600 ring-2 ring-slate-50">
                                {u.student_number || '---'}
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{u.areas?.name || 'Não definida'}</span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase mt-1">Desde {new Date(u.created_at).toLocaleDateString('pt-PT')}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-2">
                                <div className={`h-1.5 w-1.5 rounded-full ${u.last_active && (Date.now() - new Date(u.last_active).getTime() < 10 * 60 * 1000) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-300'}`} />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">
                                  {u.last_active ? new Date(u.last_active).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Offline'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-right rounded-r-2xl border border-transparent border-r-slate-200 group-hover:border-slate-100">
                              <div className="flex items-center justify-end gap-3">
                                <button
                                  onClick={async () => {
                                    try {
                                      const { data } = await supabase.from('activity_logs').select('*').eq('user_id', u.id).order('activity_date', { ascending: false }).limit(10);
                                      if (!data?.length) return alert('Nenhuma pegada detectada.');
                                      const msg = data.map((l: any) => `[${new Date(l.activity_date).toLocaleTimeString()}] ${l.activity_type}`).join('\n');
                                      alert(`HISTÓRICO RECENTE:\n${msg}`);
                                    } catch (e) { alert('Falha ao rastrear.'); }
                                  }}
                                  className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                  title="Rastrear Pegadas"
                                >
                                  <Monitor className="h-4 w-4" />
                                </button>
                                <select
                                  value={u.selected_area_id || ''}
                                  onChange={(e) => handleUpdateUserArea(u.id, e.target.value)}
                                  className="text-[10px] font-black uppercase tracking-tight border-2 border-slate-100 rounded-xl bg-white px-3 py-1.5 focus:border-emerald-500 outline-none shadow-sm"
                                >
                                  <option value="">Área...</option>
                                  {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'support' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-gray-900">Mensagens de Suporte</h2>
              <button
                onClick={fetchSupportMessages}
                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${loadingSupport ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="grid gap-4">
              {supportMessages.length === 0 && !loadingSupport && (
                <div className="bg-white rounded-[2rem] border-2 border-slate-100 p-12 text-center text-slate-400 font-medium font-bold">
                  Nenhuma mensagem recebida ainda.
                </div>
              )}

              {supportMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`bg-white rounded-[2rem] border-2 transition-all overflow-hidden ${selectedTicket?.id === msg.id ? 'border-emerald-500 shadow-lg' : 'border-slate-100'}`}
                >
                  <div
                    className="p-6 cursor-pointer"
                    onClick={() => setSelectedTicket(selectedTicket?.id === msg.id ? null : msg)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-3 items-center font-bold">
                        <span className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-widest ${msg.status === 'open' ? 'bg-sky-100 text-sky-600' :
                          msg.status === 'in_progress' ? 'bg-amber-100 text-amber-600' :
                            'bg-emerald-100 text-emerald-600'
                          }`}>
                          {msg.status === 'open' ? 'Aberto' : msg.status === 'in_progress' ? 'Em curso' : 'Resolvido'}
                        </span>
                        <span className="text-slate-400 text-xs">{new Date(msg.created_at).toLocaleString()}</span>
                      </div>
                      <MessageCircle className={`w-5 h-5 ${msg.status === 'open' ? 'text-sky-500' : 'text-slate-300'}`} />
                    </div>
                    <h3 className="font-black text-slate-800 text-lg leading-tight">{msg.subject}</h3>
                    <p className="text-sm text-slate-500 font-medium mt-1">De: {msg.profiles?.full_name || msg.email} ({msg.email})</p>
                    <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mt-2">{msg.problem_type}</p>
                  </div>

                  {selectedTicket?.id === msg.id && (
                    <div className="px-6 pb-6 pt-2 bg-slate-50/50 border-t border-slate-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                        {msg.description}
                      </div>

                      <div className="space-y-3">
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Resposta do Administrador</label>
                        <textarea
                          placeholder="Escreva a resposta que o aluno verá..."
                          value={adminResponse}
                          onChange={(e) => setAdminResponse(e.target.value)}
                          className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 font-medium resize-none"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateSupportStatus(msg.id, 'in_progress')}
                            className="flex-1 bg-amber-500 text-white font-black py-3 rounded-xl uppercase tracking-widest text-[10px] shadow-[0_4px_0_0_#d97706] active:translate-y-1 active:shadow-none transition-all"
                          >
                            Em Progresso
                          </button>
                          <button
                            onClick={() => handleUpdateSupportStatus(msg.id, 'resolved')}
                            className="flex-1 bg-emerald-500 text-white font-black py-3 rounded-xl uppercase tracking-widest text-[10px] shadow-[0_4px_0_0_#059669] active:translate-y-1 active:shadow-none transition-all"
                          >
                            Marcar Resolvido
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'backup' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-2xl font-black text-gray-900 border-b border-gray-100 pb-4">Backup e Importação</h2>
            <AdminBackup />
          </div>
        )}
        {activeTab === 'social' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-2xl font-black text-gray-900 border-b border-gray-100 pb-4">Gestão Social e Alertas</h2>
            <AdminNews />
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="animate-in fade-in duration-500 space-y-6">
            <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40 relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                <div className={`relative w-40 h-40 shrink-0 rounded-[3rem] shadow-2xl flex items-center justify-center text-7xl font-black border-4 border-white overflow-hidden ${!profile?.avatar_url ? (profile?.avatar_style || 'bg-emerald-100 text-emerald-700') : 'bg-white'}`}>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    profile?.full_name?.charAt(0) || 'A'
                  )}
                </div>

                <div className="flex-1 text-center md:text-left">
                  <div className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-purple-700 mb-4">
                    <Shield className="w-3.5 h-3.5" />
                    Administrador Master
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">{profile?.full_name}</h2>
                  <p className="mt-2 text-slate-500 font-medium">Logado como <span className="text-slate-900 font-bold">{profile?.role}</span></p>

                  <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-4 text-xs font-bold uppercase tracking-widest">
                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                      <Clock className="w-4 h-4 text-slate-400" />
                      Desde {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-PT') : '---'}
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  <button
                    onClick={async () => {
                      if (window.confirm('Tem certeza que deseja sair do painel administrativo?')) {
                        await signOut();
                        window.location.href = '/login';
                      }
                    }}
                    className="group flex flex-col items-center justify-center gap-2 w-32 h-32 rounded-[2rem] bg-rose-50 border-2 border-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-lg shadow-rose-200/50 hover:shadow-rose-500/30"
                  >
                    <LogOut className="w-8 h-8 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Sair Agora</span>
                  </button>
                </div>
              </div>

              {/* Background accent */}
              <div className="absolute right-[-5%] top-[-10%] w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Segurança</p>
                <p className="text-sm font-medium text-slate-600 mb-6">A sua conta possui acesso total a todos os dados sensíveis, incluindo pagamentos e logs de usuários.</p>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                  <p className="text-xs font-bold text-amber-800 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Proteção Ativa
                  </p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] border border-slate-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Sessão Atual</p>
                <p className="text-sm font-medium text-slate-600 mb-2">ID: <span className="text-slate-900 font-mono text-[10px]">{profile?.id}</span></p>
                <p className="text-sm font-medium text-slate-600">PWA: Instalado</p>
              </div>

              <div className="bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] p-6 rounded-[2rem] text-white">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Ajuda Admin</p>
                <p className="text-sm font-medium text-slate-200 mb-4">Precisa de assistência técnica ou encontrou um bug crítico no painel?</p>
                <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                  Contactar Suporte Dev
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
