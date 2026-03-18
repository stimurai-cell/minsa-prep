import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, BarChart3, Brain, Calendar, CheckCircle2, Clock3, Download, Eye, Search, Sparkles, Target, TrendingUp, Users, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CURRENT_PLAN_STATUSES, getPlanStatusLabel } from '../lib/elitePlans';
import { useAuthStore } from '../store/useAuthStore';

type ElitePlanStatus = 'draft' | 'finalized' | 'active' | 'completed' | 'archived' | 'unknown';
type RiskLevel = 'low' | 'medium' | 'high';

type ElitePlan = { id: string; user_id: string; week_start?: string; week_end?: string; status?: ElitePlanStatus; focus_topics?: string[]; daily_plan?: Record<string, any>; performance?: Record<string, any> | null; updated_at?: string; created_at?: string };
type EliteAssessment = { id?: string; user_id: string; assessment_type?: string; total_questions?: number; correct_answers?: number; score?: number; weak_topics?: string[]; strong_topics?: string[]; recommendations?: string[]; created_at: string };
type EliteReassessment = { id?: string; user_id: string; week_start?: string; week_end?: string; total_study_time?: number; completed_days?: number; simulation_scores?: number[]; improvement_areas?: string[]; overall_improvement?: number; created_at: string };
type EliteRevision = { id: string; user_id: string; event_type: string; previous_status?: string | null; new_status?: string | null; change_summary?: string | null; created_at: string };
type ActivityLogRow = { id: string; user_id: string; activity_type: string; activity_date?: string | null; created_at?: string | null; activity_metadata?: Record<string, any> | null };
type EliteStudentView = { id: string; full_name: string; selected_area_id?: string | null; phone?: string | null; last_active?: string | null; total_xp?: number; created_at?: string; currentPlan: ElitePlan | null; plans: ElitePlan[]; assessments: EliteAssessment[]; reassessments: EliteReassessment[]; revisions: EliteRevision[]; recentActivities: ActivityLogRow[]; latestScore: number; completionRate: number; weeklyStudyMinutes: number; activityDaysThisWeek: number; riskLevel: RiskLevel; focusTopics: string[]; aiSuggestions: string[] };

const safeArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString('pt-PT') : 'Sem registo');
const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString('pt-PT') : 'Sem registo');
const statusTone = (status?: string | null) => status === 'active' ? 'bg-emerald-100 text-emerald-700' : status === 'finalized' ? 'bg-blue-100 text-blue-700' : status === 'draft' ? 'bg-amber-100 text-amber-700' : status === 'completed' ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-600';
const riskTone = (risk: RiskLevel) => risk === 'high' ? 'bg-rose-100 text-rose-700' : risk === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
const byUser = <T extends { user_id: string }>(rows: T[]) => rows.reduce((map, row) => map.set(row.user_id, [...(map.get(row.user_id) || []), row]), new Map<string, T[]>());
const currentPlan = (plans: ElitePlan[]) => plans.find((plan) => CURRENT_PLAN_STATUSES.includes((plan.status || 'unknown') as any)) || plans[0] || null;
const completionRate = (plan: ElitePlan | null, reassessment?: EliteReassessment) => typeof reassessment?.completed_days === 'number' ? Math.round((Math.min(reassessment.completed_days, 7) / 7) * 100) : !plan?.daily_plan ? 0 : Math.round((Object.values(plan.daily_plan).filter((day: any) => day?.completed).length / Math.max(Object.keys(plan.daily_plan).length, 1)) * 100);
const weeklyStudyMinutes = (plan: ElitePlan | null, reassessment?: EliteReassessment) => typeof reassessment?.total_study_time === 'number' ? Math.round(reassessment.total_study_time) : Math.round(Number(plan?.performance?.totalStudyTime || 0) || Object.values(plan?.daily_plan || {}).reduce((sum, day: any) => sum + Number(day?.timeSpent || 0), 0));
const latestScore = (assessments: EliteAssessment[], reassessments: EliteReassessment[]) => typeof assessments[0]?.score === 'number' ? Math.round(assessments[0].score || 0) : safeArray<number>(reassessments[0]?.simulation_scores).length ? Math.round(safeArray<number>(reassessments[0]?.simulation_scores).reduce((sum, score) => sum + Number(score || 0), 0) / safeArray<number>(reassessments[0]?.simulation_scores).length) : 0;
const activeDaysThisWeek = (logs: ActivityLogRow[]) => new Set(logs.filter((log) => { const stamp = new Date(log.activity_date || log.created_at || '').getTime(); return !Number.isNaN(stamp) && stamp >= Date.now() - 7 * 24 * 60 * 60 * 1000; }).map((log) => new Date(log.activity_date || log.created_at || '').toISOString().slice(0, 10))).size;
const riskLevel = (score: number, completion: number, lastActive?: string | null, activeDays = 0): RiskLevel => { const inactiveDays = lastActive ? Math.floor((Date.now() - new Date(lastActive).getTime()) / (24 * 60 * 60 * 1000)) : 99; if (score < 55 || completion < 45 || inactiveDays >= 7) return 'high'; if (score < 70 || completion < 70 || inactiveDays >= 4 || activeDays < 3) return 'medium'; return 'low'; };
const aiSuggestions = (student: EliteStudentView) => { const out: string[] = []; const weak = safeArray<string>(student.assessments[0]?.weak_topics); const recs = safeArray<string>(student.assessments[0]?.recommendations); const improve = safeArray<string>(student.reassessments[0]?.improvement_areas); const inactiveDays = student.last_active ? Math.floor((Date.now() - new Date(student.last_active).getTime()) / (24 * 60 * 60 * 1000)) : 99; if (student.latestScore < 60) out.push('Reforcar diagnostico antes de expandir a carga.'); if (student.completionRate < 60) out.push('Reduzir a carga e recuperar consistencia diaria.'); if (student.weeklyStudyMinutes < 90) out.push('Aumentar o tempo semanal com blocos mais curtos.'); if (inactiveDays >= 5) out.push('Acionar acompanhamento proximo por quebra recente de atividade.'); if (weak.length) out.push('Revisar ' + weak.slice(0, 2).join(' e ') + ' antes de rodar foco.'); if (improve.length) out.push('Cruzar o proximo plano com ' + improve.slice(0, 2).join(' e ') + '.'); out.push(...recs.slice(0, 2)); if (!out.length && student.focusTopics.length) out.push('Manter tracao e aprofundar ' + student.focusTopics.slice(0, 2).join(' e ') + '.'); return out.slice(0, 4); };
const performanceTimeline = (student: EliteStudentView) => ([...student.assessments.slice(0, 4).map((row) => ({ id: row.created_at + '-a', label: formatDate(row.created_at), date: row.created_at, value: Math.round(row.score || 0), type: 'avaliacao' })), ...student.reassessments.slice(0, 4).map((row) => ({ id: row.created_at + '-r', label: formatDate(row.created_at), date: row.created_at, value: safeArray<number>(row.simulation_scores).length ? Math.round(safeArray<number>(row.simulation_scores).reduce((sum, score) => sum + Number(score || 0), 0) / safeArray<number>(row.simulation_scores).length) : Math.round(Number(row.overall_improvement || 0) + 70), type: 'reavaliacao' }))].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-6));
const activitySummary = (activity: ActivityLogRow) => { const meta = activity.activity_metadata || {}; if (activity.activity_type === 'completed_training') return 'Terminou treino' + (meta.topic_name ? ' em ' + meta.topic_name : '') + '.'; if (activity.activity_type === 'started_training') return 'Iniciou treino' + (meta.topic_name ? ' em ' + meta.topic_name : '') + '.'; if (activity.activity_type === 'completed_speed_mode') return 'Concluiu uma sessao de Modo Relampago.'; if (activity.activity_type === 'completed_simulation') return 'Concluiu uma simulacao.'; return activity.activity_type.replace(/_/g, ' '); };
const exportSnapshot = (student: EliteStudentView) => { const blob = new Blob([JSON.stringify(student, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'elite_' + student.full_name.replace(/\s+/g, '_').toLowerCase() + '.json'; link.click(); URL.revokeObjectURL(url); };

export default function AdminEliteDashboard() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [students, setStudents] = useState<EliteStudentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ElitePlanStatus>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | RiskLevel>('all');
  const [selectedStudent, setSelectedStudent] = useState<EliteStudentView | null>(null);

  const loadEliteStudentsData = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const { data: eliteProfiles, error: profilesError } = await supabase.from('profiles').select('id, full_name, selected_area_id, phone, last_active, total_xp, created_at').eq('role', 'elite').order('last_active', { ascending: false, nullsFirst: false });
      if (profilesError) throw profilesError;
      const safeProfiles = (eliteProfiles || []) as Array<{ id: string; full_name: string; selected_area_id?: string | null; phone?: string | null; last_active?: string | null; total_xp?: number; created_at?: string }>;
      if (!safeProfiles.length) { setStudents([]); setSelectedStudent(null); setLoading(false); return; }
      const userIds = safeProfiles.map((student) => student.id);
      const [plansResult, revisionsResult, assessmentsResult, reassessmentsResult, activitiesResult] = await Promise.all([
        supabase.from('elite_study_plans').select('id, user_id, week_start, week_end, status, focus_topics, daily_plan, performance, updated_at, created_at').in('user_id', userIds).order('created_at', { ascending: false }),
        supabase.from('elite_plan_revisions').select('id, user_id, event_type, previous_status, new_status, change_summary, created_at').in('user_id', userIds).order('created_at', { ascending: false }),
        supabase.from('elite_assessments').select('id, user_id, assessment_type, total_questions, correct_answers, score, weak_topics, strong_topics, recommendations, created_at').in('user_id', userIds).order('created_at', { ascending: false }),
        supabase.from('elite_reassessments').select('id, user_id, week_start, week_end, total_study_time, completed_days, simulation_scores, improvement_areas, overall_improvement, created_at').in('user_id', userIds).order('created_at', { ascending: false }),
        supabase.from('activity_logs').select('id, user_id, activity_type, activity_date, created_at, activity_metadata').in('user_id', userIds).order('activity_date', { ascending: false }).limit(500),
      ]);
      const plans = (plansResult.data || []) as ElitePlan[];
      const revisions = (revisionsResult.data || []) as EliteRevision[];
      const assessments = (assessmentsResult.data || []) as EliteAssessment[];
      const reassessments = (reassessmentsResult.data || []) as EliteReassessment[];
      const activities = (activitiesResult.data || []) as ActivityLogRow[];
      const plansByUser = byUser(plans);
      const revisionsByUser = byUser(revisions);
      const assessmentsByUser = byUser(assessments);
      const reassessmentsByUser = byUser(reassessments);
      const activitiesByUser = byUser(activities);
      const nextStudents = safeProfiles.map((student) => {
        const studentPlans = (plansByUser.get(student.id) || []).slice(0, 8);
        const plan = currentPlan(studentPlans);
        const studentAssessments = (assessmentsByUser.get(student.id) || []).slice(0, 6);
        const studentReassessments = (reassessmentsByUser.get(student.id) || []).slice(0, 6);
        const studentRevisions = (revisionsByUser.get(student.id) || []).slice(0, 8);
        const studentActivities = (activitiesByUser.get(student.id) || []).slice(0, 10);
        const focusTopics = safeArray<string>(plan?.focus_topics);
        const score = latestScore(studentAssessments, studentReassessments);
        const completion = completionRate(plan, studentReassessments[0]);
        const minutes = weeklyStudyMinutes(plan, studentReassessments[0]);
        const activeDays = activeDaysThisWeek(studentActivities);
        const studentRisk = riskLevel(score, completion, student.last_active, activeDays);
        const view: EliteStudentView = { ...student, currentPlan: plan, plans: studentPlans, assessments: studentAssessments, reassessments: studentReassessments, revisions: studentRevisions, recentActivities: studentActivities, latestScore: score, completionRate: completion, weeklyStudyMinutes: minutes, activityDaysThisWeek: activeDays, riskLevel: studentRisk, focusTopics, aiSuggestions: [] };
        view.aiSuggestions = aiSuggestions(view);
        return view;
      }).sort((left, right) => ({ high: 0, medium: 1, low: 2 }[left.riskLevel] - { high: 0, medium: 1, low: 2 }[right.riskLevel] || right.latestScore - left.latestScore));
      setStudents(nextStudents);
      setSelectedStudent((current) => nextStudents.find((student) => student.id === current?.id) || null);
    } catch (error) {
      console.error('Error loading elite students data:', error);
      setErrorMessage('Nao foi possivel carregar a gestao detalhada dos estudantes Elite.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.role !== 'admin') { navigate('/dashboard'); return; }
    void loadEliteStudentsData();
  }, [profile, navigate]);

  const filteredStudents = useMemo(() => students.filter((student) => {
    const matchesSearch = !searchQuery || student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || safeArray<string>(student.currentPlan?.focus_topics).some((topic) => topic.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || (student.currentPlan?.status || 'unknown') === statusFilter;
    const matchesRisk = riskFilter === 'all' || student.riskLevel === riskFilter;
    return matchesSearch && matchesStatus && matchesRisk;
  }), [riskFilter, searchQuery, statusFilter, students]);

  const metrics = useMemo(() => {
    const total = students.length;
    return {
      total,
      activeThisWeek: students.filter((student) => student.activityDaysThisWeek > 0).length,
      activePlans: students.filter((student) => student.currentPlan?.status === 'active').length,
      attentionNeeded: students.filter((student) => student.riskLevel !== 'low').length,
      averageScore: total ? Math.round(students.reduce((sum, student) => sum + student.latestScore, 0) / total) : 0,
      averageCompletion: total ? Math.round(students.reduce((sum, student) => sum + student.completionRate, 0) / total) : 0,
    };
  }, [students]);

  const topExecution = useMemo(() => [...filteredStudents].sort((a, b) => b.completionRate - a.completionRate).slice(0, 6), [filteredStudents]);
  const attentionQueue = useMemo(() => filteredStudents.filter((student) => student.riskLevel !== 'low').slice(0, 6), [filteredStudents]);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center rounded-[2rem] border border-slate-200 bg-white"><div className="text-center"><BarChart3 className="mx-auto mb-4 h-14 w-14 animate-pulse text-emerald-500" /><h2 className="text-2xl font-black text-slate-900">A carregar monitorizacao Elite</h2><p className="mt-2 text-sm text-slate-500">A consolidar planos, relatorios, atividades e indicadores.</p></div></div>;
  }

  if (errorMessage) {
    return <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-8 text-center"><AlertCircle className="mx-auto h-14 w-14 text-rose-500" /><h2 className="mt-4 text-2xl font-black text-slate-900">Falha ao carregar a gestao Elite</h2><p className="mt-2 text-sm text-slate-600">{errorMessage}</p></div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_right,#fff1c7,transparent_30%),linear-gradient(135deg,#ffffff_0%,#f7fafc_45%,#eef8ff_100%)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-amber-700"><Brain className="h-4 w-4" />Operacao Elite</div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900">Gestao minuciosa dos estudantes Elite</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Planos, relatorios, atividades recentes, desempenho semanal, graficos simples e sugestoes automatizadas.</p>
          </div>
          <button type="button" onClick={() => void loadEliteStudentsData()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"><TrendingUp className="h-4 w-4" />Atualizar dados</button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {[
          { label: 'Estudantes Elite', value: metrics.total, icon: Users, tone: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: 'Ativos na semana', value: metrics.activeThisWeek, icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          { label: 'Planos em execucao', value: metrics.activePlans, icon: Target, tone: 'text-amber-600 bg-amber-50 border-amber-200' },
          { label: 'Fila de atencao', value: metrics.attentionNeeded, icon: AlertCircle, tone: 'text-rose-600 bg-rose-50 border-rose-200' },
          { label: 'Score medio', value: metrics.averageScore + '%', icon: BarChart3, tone: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
          { label: 'Execucao media', value: metrics.averageCompletion + '%', icon: Clock3, tone: 'text-violet-600 bg-violet-50 border-violet-200' },
        ].map((card) => <div key={card.label} className={'rounded-[1.6rem] border p-4 shadow-sm ' + card.tone}><div className="flex items-center justify-between"><card.icon className="h-5 w-5" /><span className="text-2xl font-black">{card.value}</span></div><p className="mt-3 text-xs font-black uppercase tracking-[0.18em]">{card.label}</p></div>)}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.5fr_0.8fr_0.8fr]">
          <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Pesquisar estudante ou topico em foco..." className="w-full rounded-2xl border border-slate-200 py-3 pl-12 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400" /></div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | ElitePlanStatus)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400"><option value="all">Todos os status</option><option value="active">Planos ativos</option><option value="finalized">Planos confirmados</option><option value="draft">Rascunhos</option><option value="completed">Concluidos</option><option value="archived">Arquivados</option></select>
          <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as 'all' | RiskLevel)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400"><option value="all">Todas as prioridades</option><option value="high">Risco alto</option><option value="medium">Acompanhar</option><option value="low">Saudavel</option></select>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-black text-slate-900">Grafico de execucao da semana</h2><p className="mt-1 text-sm text-slate-500">Barra comparativa para acompanhar quem esta a cumprir o plano.</p></div><div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{topExecution.length} no foco</div></div>
          <div className="mt-6 space-y-4">
            {topExecution.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">Nenhum estudante corresponde aos filtros atuais.</div> : topExecution.map((student) => <div key={student.id}><div className="mb-2 flex items-center justify-between gap-4"><div><p className="text-sm font-black text-slate-900">{student.full_name}</p><p className="text-xs text-slate-500">Score {student.latestScore}% • {student.weeklyStudyMinutes} min • {student.activityDaysThisWeek} dias ativos</p></div><button type="button" onClick={() => setSelectedStudent(student)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"><Eye className="h-4 w-4" />Detalhes</button></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className={'h-full rounded-full ' + (student.completionRate >= 80 ? 'bg-emerald-500' : student.completionRate >= 60 ? 'bg-amber-400' : 'bg-rose-500')} style={{ width: Math.max(student.completionRate, 6) + '%' }} /></div></div>)}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-black text-slate-900">Fila de atencao</h2><p className="mt-1 text-sm text-slate-500">Estudantes que merecem acompanhamento mais proximo agora.</p></div><AlertCircle className="h-5 w-5 text-rose-500" /></div>
          <div className="mt-6 space-y-3">
            {attentionQueue.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">Nenhum alerta forte nos filtros atuais.</div> : attentionQueue.map((student) => <button key={student.id} type="button" onClick={() => setSelectedStudent(student)} className="w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-rose-200 hover:bg-rose-50/50"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-slate-900">{student.full_name}</p><p className="mt-1 text-xs text-slate-500">Score {student.latestScore}% • Execucao {student.completionRate}% • Ultima atividade {formatDate(student.last_active)}</p></div><span className={'rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ' + riskTone(student.riskLevel)}>{student.riskLevel === 'high' ? 'Critico' : 'Vigiar'}</span></div><p className="mt-3 text-sm leading-6 text-slate-600">{student.aiSuggestions[0] || 'Acompanhamento preventivo recomendado.'}</p></button>)}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-black text-slate-900">Carteira completa de estudantes Elite</h2><p className="mt-1 text-sm text-slate-500">Acesso rapido a relatorios, atividades, graficos e sugestoes.</p></div><div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{filteredStudents.length} visiveis</div></div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[980px]"><thead><tr className="border-b border-slate-200 text-left text-[11px] font-black uppercase tracking-[0.18em] text-slate-400"><th className="px-3 py-3">Estudante</th><th className="px-3 py-3">Plano</th><th className="px-3 py-3">Score</th><th className="px-3 py-3">Execucao</th><th className="px-3 py-3">Atividade</th><th className="px-3 py-3">Foco</th><th className="px-3 py-3">IA</th><th className="px-3 py-3 text-right">Acoes</th></tr></thead><tbody>
            {filteredStudents.map((student) => <tr key={student.id} className="border-b border-slate-100 align-top"><td className="px-3 py-4"><div><p className="font-black text-slate-900">{student.full_name}</p><p className="mt-1 text-xs text-slate-500">XP {student.total_xp || 0} • Ultima atividade {formatDate(student.last_active)}</p></div></td><td className="px-3 py-4"><div className="space-y-2"><span className={'inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ' + statusTone(student.currentPlan?.status)}>{getPlanStatusLabel(student.currentPlan?.status)}</span><p className="text-xs text-slate-500">{student.currentPlan?.week_start ? formatDate(student.currentPlan.week_start) + ' ate ' + formatDate(student.currentPlan.week_end) : 'Sem periodo ativo'}</p></div></td><td className="px-3 py-4"><div className="text-sm font-black text-slate-900">{student.latestScore}%</div><p className="mt-1 text-xs text-slate-500">{student.assessments.length} relatorios</p></td><td className="px-3 py-4"><div className="text-sm font-black text-slate-900">{student.completionRate}%</div><p className="mt-1 text-xs text-slate-500">{student.weeklyStudyMinutes} min na semana</p></td><td className="px-3 py-4"><span className={'inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ' + riskTone(student.riskLevel)}>{student.riskLevel === 'high' ? 'Critico' : student.riskLevel === 'medium' ? 'Acompanhar' : 'Saudavel'}</span><p className="mt-2 text-xs text-slate-500">{student.activityDaysThisWeek} dias ativos na semana</p></td><td className="px-3 py-4"><div className="flex max-w-[220px] flex-wrap gap-2">{(student.focusTopics.length > 0 ? student.focusTopics : ['Sem foco definido']).slice(0, 3).map((topic) => <span key={topic} className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">{topic}</span>)}</div></td><td className="px-3 py-4"><p className="max-w-[240px] text-sm leading-6 text-slate-600">{student.aiSuggestions[0] || 'Sem alerta prioritario no momento.'}</p></td><td className="px-3 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => setSelectedStudent(student)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"><Eye className="h-4 w-4" />Abrir</button><button type="button" onClick={() => exportSnapshot(student)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-700 transition hover:border-slate-300"><Download className="h-4 w-4" />JSON</button></div></td></tr>)}
          </tbody></table>
        </div>
      </section>
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 p-4 md:p-8">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
              <div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className={'rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ' + statusTone(selectedStudent.currentPlan?.status)}>{getPlanStatusLabel(selectedStudent.currentPlan?.status)}</span><span className={'rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ' + riskTone(selectedStudent.riskLevel)}>{selectedStudent.riskLevel === 'high' ? 'Prioridade alta' : selectedStudent.riskLevel === 'medium' ? 'Vigiar' : 'Saudavel'}</span></div><h2 className="mt-3 text-3xl font-black text-slate-900">{selectedStudent.full_name}</h2><p className="mt-2 text-sm text-slate-500">Ultima atividade {formatDateTime(selectedStudent.last_active)} • Criado em {formatDate(selectedStudent.created_at)}</p></div><button type="button" onClick={() => setSelectedStudent(null)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-slate-200"><X className="h-5 w-5" /></button></div>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[{ label: 'Score atual', value: selectedStudent.latestScore + '%' }, { label: 'Execucao', value: selectedStudent.completionRate + '%' }, { label: 'Tempo semanal', value: selectedStudent.weeklyStudyMinutes + ' min' }, { label: 'Dias ativos', value: String(selectedStudent.activityDaysThisWeek) }].map((card) => <div key={card.label} className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4"><p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{card.label}</p><p className="mt-2 text-3xl font-black text-slate-900">{card.value}</p></div>)}</div>

              <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-2"><Calendar className="h-5 w-5 text-emerald-600" /><h3 className="text-lg font-black text-slate-900">Plano e relatorio</h3></div>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl bg-slate-50 p-4"><div className="grid gap-3 md:grid-cols-2"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Periodo</p><p className="mt-2 text-sm font-black text-slate-900">{selectedStudent.currentPlan?.week_start ? formatDate(selectedStudent.currentPlan.week_start) + ' ate ' + formatDate(selectedStudent.currentPlan.week_end) : 'Sem periodo ativo'}</p></div><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Ultima atualizacao</p><p className="mt-2 text-sm font-black text-slate-900">{formatDateTime(selectedStudent.currentPlan?.updated_at)}</p></div></div><div className="mt-4"><p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Topicos de foco</p><div className="mt-3 flex flex-wrap gap-2">{(selectedStudent.focusTopics.length > 0 ? selectedStudent.focusTopics : ['Sem foco definido']).map((topic) => <span key={topic} className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">{topic}</span>)}</div></div></div>
                    <div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2"><Target className="h-4 w-4 text-cyan-600" /><p className="text-sm font-black text-slate-900">Relatorio mais recente</p></div>{selectedStudent.assessments[0] ? <div className="mt-4 space-y-4"><div className="grid gap-3 md:grid-cols-3"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Score</p><p className="mt-2 text-xl font-black text-slate-900">{selectedStudent.assessments[0].score || 0}%</p></div><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Acertos</p><p className="mt-2 text-xl font-black text-slate-900">{selectedStudent.assessments[0].correct_answers || 0}/{selectedStudent.assessments[0].total_questions || 0}</p></div><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Gerado em</p><p className="mt-2 text-sm font-black text-slate-900">{formatDateTime(selectedStudent.assessments[0].created_at)}</p></div></div><div className="grid gap-3 md:grid-cols-2"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Topicos fracos</p><div className="mt-3 flex flex-wrap gap-2">{safeArray<string>(selectedStudent.assessments[0].weak_topics).length > 0 ? safeArray<string>(selectedStudent.assessments[0].weak_topics).map((topic) => <span key={topic} className="rounded-full bg-rose-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-rose-700">{topic}</span>) : <span className="text-sm text-slate-500">Sem pontos fracos destacados.</span>}</div></div><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Topicos fortes</p><div className="mt-3 flex flex-wrap gap-2">{safeArray<string>(selectedStudent.assessments[0].strong_topics).length > 0 ? safeArray<string>(selectedStudent.assessments[0].strong_topics).map((topic) => <span key={topic} className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">{topic}</span>) : <span className="text-sm text-slate-500">Sem pontos fortes destacados.</span>}</div></div></div><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Recomendacoes guardadas</p><div className="mt-3 space-y-2">{safeArray<string>(selectedStudent.assessments[0].recommendations).length > 0 ? safeArray<string>(selectedStudent.assessments[0].recommendations).map((recommendation, index) => <div key={recommendation + '-' + index} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">{recommendation}</div>) : <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">Sem recomendacoes persistidas neste relatorio.</div>}</div></div></div> : <div className="mt-4 rounded-2xl bg-white px-4 py-4 text-sm text-slate-500 shadow-sm">Este estudante ainda nao tem relatorio Elite gravado.</div>}</div>
                  </div>
                </div>

                <div className="space-y-6"><div className="rounded-[1.8rem] border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-blue-600" /><h3 className="text-lg font-black text-slate-900">Grafico simples de desempenho</h3></div><div className="mt-5 space-y-4">{performanceTimeline(selectedStudent).length > 0 ? performanceTimeline(selectedStudent).map((point) => <div key={point.id}><div className="mb-2 flex items-center justify-between gap-3"><p className="text-sm font-black text-slate-900">{point.type === 'avaliacao' ? 'Avaliacao' : 'Reavaliacao'}</p><span className="text-xs font-bold text-slate-500">{point.label}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className={'h-full rounded-full ' + (point.value >= 80 ? 'bg-emerald-500' : point.value >= 60 ? 'bg-amber-400' : 'bg-rose-500')} style={{ width: Math.max(Math.min(point.value, 100), 6) + '%' }} /></div><p className="mt-2 text-xs font-bold text-slate-500">{point.value}%</p></div>) : <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">Ainda nao ha pontos suficientes para desenhar a evolucao deste estudante.</div>}</div></div><div className="rounded-[1.8rem] border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-600" /><h3 className="text-lg font-black text-slate-900">Sugestoes da IA</h3></div><div className="mt-5 space-y-3">{selectedStudent.aiSuggestions.map((suggestion, index) => <div key={suggestion + '-' + index} className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-4 text-sm leading-6 text-slate-700">{suggestion}</div>)}</div></div></div>
              </div>
              <div className="grid gap-6 xl:grid-cols-[1fr_1fr]"><div className="rounded-[1.8rem] border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><Users className="h-5 w-5 text-emerald-600" /><h3 className="text-lg font-black text-slate-900">Atividades recentes</h3></div><div className="mt-5 space-y-3">{selectedStudent.recentActivities.length > 0 ? selectedStudent.recentActivities.map((activity) => <div key={activity.id} className="rounded-2xl bg-slate-50 px-4 py-4"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-black text-slate-900">{activitySummary(activity)}</p><p className="mt-2 text-xs text-slate-500">{formatDateTime(activity.activity_date || activity.created_at)}</p></div><span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{activity.activity_type}</span></div></div>) : <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">Nenhuma atividade recente encontrada.</div>}</div></div><div className="rounded-[1.8rem] border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><Brain className="h-5 w-5 text-amber-600" /><h3 className="text-lg font-black text-slate-900">Historico do plano</h3></div><div className="mt-5 space-y-3">{selectedStudent.revisions.length > 0 ? selectedStudent.revisions.map((revision) => <div key={revision.id} className="rounded-2xl bg-slate-50 px-4 py-4"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-black text-slate-900">{revision.change_summary || revision.event_type}</p><p className="mt-2 text-xs text-slate-500">{revision.previous_status && revision.new_status ? getPlanStatusLabel(revision.previous_status) + ' -> ' + getPlanStatusLabel(revision.new_status) : getPlanStatusLabel(revision.new_status)}</p></div><span className="text-xs font-bold text-slate-500">{formatDateTime(revision.created_at)}</span></div></div>) : <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">Ainda nao ha revisoes guardadas para este plano.</div>}</div></div></div>
              <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row"><button type="button" onClick={() => exportSnapshot(selectedStudent)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300"><Download className="h-4 w-4" />Exportar snapshot JSON</button><button type="button" onClick={() => setSelectedStudent(null)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800">Fechar painel</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
