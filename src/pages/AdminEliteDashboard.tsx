import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp, Calendar, Clock, Target, Brain, BarChart3, AlertCircle, CheckCircle2, Eye, Download } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { CURRENT_PLAN_STATUSES, getPlanStatusLabel } from '../lib/elitePlans';

interface EliteStudent {
  id: string;
  full_name: string;
  role: string;
  current_plan?: {
    week_start: string;
    week_end: string;
    focus_topics: string[];
    status: string;
    updated_at?: string;
    performance?: any;
  };
  plan_revisions: Array<{
    id: string;
    event_type: string;
    previous_status: string | null;
    new_status: string | null;
    change_summary: string | null;
    created_at: string;
  }>;
  assessments: Array<{
    created_at: string;
    score: number;
    weak_topics: string[];
    strong_topics: string[];
  }>;
  weekly_stats: Array<{
    week_start: string;
    total_study_time: number;
    completed_days: number;
    simulation_scores: number[];
    completion_rate: number;
  }>;
  last_active: string;
  total_xp: number;
}

interface PerformanceMetrics {
  totalEliteStudents: number;
  activeThisWeek: number;
  averageWeeklyStudyTime: number;
  averageImprovement: number;
  completionRate: number;
  topPerformers: EliteStudent[];
  strugglingStudents: EliteStudent[];
}

export default function AdminEliteDashboard() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [students, setStudents] = useState<EliteStudent[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<EliteStudent | null>(null);
  const [showStudentDetails, setShowStudentDetails] = useState(false);

  useEffect(() => {
    if (profile?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    loadEliteStudentsData();
  }, [profile, navigate]);

  const loadEliteStudentsData = async () => {
    try {
      // Buscar todos os usuários Elite
      const { data: eliteUsers } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'elite')
        .order('last_active', { ascending: false });

      if (!eliteUsers) return;

      // Para cada usuário, buscar dados detalhados
      const studentsWithData = await Promise.all(
        eliteUsers.map(async (user) => {
          const [currentPlan, assessments, weeklyStats, planRevisions] = await Promise.all([
            getCurrentPlan(user.id),
            getUserAssessments(user.id),
            getUserWeeklyStats(user.id),
            getPlanRevisions(user.id)
          ]);

          return {
            ...user,
            current_plan: currentPlan,
            assessments,
            weekly_stats: weeklyStats,
            plan_revisions: planRevisions
          } as EliteStudent;
        })
      );

      setStudents(studentsWithData);
      calculateMetrics(studentsWithData);
    } catch (error) {
      console.error('Error loading elite students data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPlan = async (userId: string) => {
    const { data } = await supabase
      .from('elite_study_plans')
      .select('*')
      .eq('user_id', userId)
      .in('status', [...CURRENT_PLAN_STATUSES])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  };

  const getPlanRevisions = async (userId: string) => {
    const { data } = await supabase
      .from('elite_plan_revisions')
      .select('id,event_type,previous_status,new_status,change_summary,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    return data || [];
  };

  const getUserAssessments = async (userId: string) => {
    const { data } = await supabase
      .from('elite_assessments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    return data || [];
  };

  const getUserWeeklyStats = async (userId: string) => {
    const { data } = await supabase
      .from('elite_study_plans')
      .select('week_start, week_end, performance')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(4);

    return (data || []).map((entry: any) => {
      const perf = entry.performance || {};
      const completedDays = Number(perf.completedDays || 0);
      return {
        week_start: entry.week_start,
        total_study_time: Number(perf.totalStudyTime || 0),
        completed_days: completedDays,
        simulation_scores: Array.isArray(perf.simulationScores) ? perf.simulationScores : [],
        completion_rate: Math.round((completedDays / 7) * 100)
      };
    });
  };

  const calculateMetrics = (studentsData: EliteStudent[]) => {
    const now = new Date();
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
    
    const activeThisWeek = studentsData.filter(student => 
      student.last_active && new Date(student.last_active) >= weekStart
    ).length;

    const totalStudyTime = studentsData.reduce((acc, student) => {
      const currentWeekTime = student.weekly_stats
        .filter(stat => new Date(stat.week_start) >= weekStart)
        .reduce((weekAcc, stat) => weekAcc + (stat.total_study_time || 0), 0);
      return acc + currentWeekTime;
    }, 0);

    const averageStudyTime = activeThisWeek > 0 ? totalStudyTime / activeThisWeek : 0;

    // Calcular taxa de melhoria baseada nas avaliações
    const improvements = studentsData
      .filter(student => student.assessments.length >= 2)
      .map(student => {
        const latest = student.assessments[0]?.score || 0;
        const previous = student.assessments[1]?.score || 0;
        return latest - previous;
      })
      .filter(improvement => improvement !== 0);

    const averageImprovement = improvements.length > 0 
      ? improvements.reduce((acc, imp) => acc + imp, 0) / improvements.length 
      : 0;

    // Taxa de conclusão semanal
    const completedPlans = studentsData.filter(student =>
      student.weekly_stats.some((stat) => stat.completion_rate >= 85)
    ).length;
    const completionRate = studentsData.length > 0 ? (completedPlans / studentsData.length) * 100 : 0;

    // Top performers
    const topPerformers = studentsData
      .filter(student => student.assessments.length > 0)
      .sort((a, b) => (b.assessments[0]?.score || 0) - (a.assessments[0]?.score || 0))
      .slice(0, 5);

    // Struggling students (baixa performance ou inatividade)
    const strugglingStudents = studentsData
      .filter(student => {
        const lastAssessment = student.assessments[0];
        const hasLowScore = lastAssessment && lastAssessment.score < 60;
        const isInactive = student.last_active && 
          new Date(student.last_active) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return hasLowScore || isInactive;
      })
      .slice(0, 5);

    setMetrics({
      totalEliteStudents: studentsData.length,
      activeThisWeek,
      averageWeeklyStudyTime: Math.round(averageStudyTime),
      averageImprovement: Math.round(averageImprovement * 10) / 10,
      completionRate: Math.round(completionRate),
      topPerformers,
      strugglingStudents
    });
  };

  const handleStudentClick = (student: EliteStudent) => {
    setSelectedStudent(student);
    setShowStudentDetails(true);
  };

  const exportStudentData = (student: EliteStudent) => {
    const data = {
      student: student.full_name,
      email: student.id,
      role: student.role,
      total_xp: student.total_xp,
      last_active: student.last_active,
      current_plan: student.current_plan,
      plan_revisions: student.plan_revisions,
      assessments: student.assessments,
      weekly_stats: student.weekly_stats
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elite_student_${student.full_name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case 'draft':
        return 'bg-amber-100 text-amber-700';
      case 'finalized':
        return 'bg-blue-100 text-blue-700';
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'completed':
        return 'bg-emerald-100 text-emerald-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="h-16 w-16 text-slate-600 mx-auto mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Carregando dashboard</h2>
          <p className="text-slate-600">Analisando dados dos estudantes Elite...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Erro ao carregar dados</h2>
          <p className="text-slate-600">Não foi possível carregar as métricas dos estudantes Elite</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-slate-900 mb-4">Dashboard Elite</h1>
          <p className="text-xl text-slate-600">
            Acompanhamento detalhado do desempenho dos estudantes Elite
          </p>
        </div>

        {/* Metrics Overview */}
        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span className="text-2xl font-bold text-slate-900">{metrics.totalEliteStudents}</span>
            </div>
            <div className="text-sm text-slate-600">Total Elite</div>
          </div>

          <div className="bg-white rounded-xl border border-green-200 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold text-green-600">{metrics.activeThisWeek}</span>
            </div>
            <div className="text-sm text-slate-600">Ativos esta semana</div>
          </div>

          <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-5 w-5 text-amber-600" />
              <span className="text-2xl font-bold text-amber-600">{metrics.averageWeeklyStudyTime}min</span>
            </div>
            <div className="text-sm text-slate-600">Tempo médio/semana</div>
          </div>

          <div className="bg-white rounded-xl border border-purple-200 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Target className="h-5 w-5 text-purple-600" />
              <span className="text-2xl font-bold text-purple-600">+{metrics.averageImprovement}%</span>
            </div>
            <div className="text-sm text-slate-600">Melhoria média</div>
          </div>

          <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span className="text-2xl font-bold text-emerald-600">{metrics.completionRate}%</span>
            </div>
            <div className="text-sm text-slate-600">Taxa conclusão</div>
          </div>

          <div className="bg-white rounded-xl border border-red-200 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-2xl font-bold text-red-600">{metrics.strugglingStudents.length}</span>
            </div>
            <div className="text-sm text-slate-600">Precisam atenção</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Top Performers */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Top Performers
            </h2>
            <div className="space-y-3">
              {metrics.topPerformers.map((student, index) => (
                <div key={student.id} className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{student.full_name}</div>
                      <div className="text-sm text-slate-600">
                        Score: {student.assessments[0]?.score || 0}%
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStudentClick(student)}
                    className="p-2 text-green-600 hover:bg-green-100 rounded-lg"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Struggling Students */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Precisam de Atenção
            </h2>
            <div className="space-y-3">
              {metrics.strugglingStudents.map((student) => (
                <div key={student.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center">
                      <AlertCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{student.full_name}</div>
                      <div className="text-sm text-slate-600">
                        Score: {student.assessments[0]?.score || 0}% | 
                        Última atividade: {student.last_active ? 
                          new Date(student.last_active).toLocaleDateString('pt-BR') : 
                          'Nunca'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStudentClick(student)}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* All Students Table */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Todos os Estudantes Elite
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-3 font-semibold text-slate-700">Estudante</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Status</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Score Atual</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Tempo/ Semana</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Última Atividade</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3">
                      <div>
                        <div className="font-semibold text-slate-900">{student.full_name}</div>
                        <div className="text-sm text-slate-600">XP: {student.total_xp || 0}</div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(student.current_plan?.status)}`}>
                        {getPlanStatusLabel(student.current_plan?.status)}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">
                        {student.assessments[0]?.score || 0}%
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-sm text-slate-600">
                        {student.weekly_stats[0]?.total_study_time || 0}min
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-sm text-slate-600">
                        {student.last_active ? 
                          new Date(student.last_active).toLocaleDateString('pt-BR') : 
                          'Nunca'}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStudentClick(student)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => exportStudentData(student)}
                          className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Student Details Modal */}
        {showStudentDetails && selectedStudent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900">
                  Detalhes: {selectedStudent.full_name}
                </h2>
                <button
                  onClick={() => setShowStudentDetails(false)}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Current Plan */}
{selectedStudent.current_plan && (
                  <div>
                    <h3 className="font-bold text-slate-900 mb-3">Plano Atual</h3>
                    <div className="bg-slate-50 rounded-xl p-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-600">Status:</span>
                          <span className={`ml-2 inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadgeClass(selectedStudent.current_plan.status)}`}>
                            {getPlanStatusLabel(selectedStudent.current_plan.status)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-600">Período:</span>
                          <span className="ml-2 font-semibold">
                            {new Date(selectedStudent.current_plan.week_start).toLocaleDateString('pt-BR')} - 
                            {new Date(selectedStudent.current_plan.week_end).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-600">Ultima atualizacao:</span>
                          <span className="ml-2 font-semibold">
                            {selectedStudent.current_plan.updated_at
                              ? new Date(selectedStudent.current_plan.updated_at).toLocaleString('pt-BR')
                              : 'Sem registro'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3">
                        <span className="text-slate-600">Tópicos de foco:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {(selectedStudent.current_plan.focus_topics || []).map((topic, index) => (
                            <span key={index} className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-xs">
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedStudent.plan_revisions.length > 0 && (
                  <div>
                    <h3 className="font-bold text-slate-900 mb-3">Historico Recente do Plano</h3>
                    <div className="space-y-2">
                      {selectedStudent.plan_revisions.map((revision) => (
                        <div key={revision.id} className="bg-slate-50 rounded-xl p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="font-semibold text-slate-900">
                                {revision.change_summary || revision.event_type}
                              </div>
                              <div className="mt-1 text-sm text-slate-600">
                                {revision.previous_status && revision.new_status
                                  ? `${getPlanStatusLabel(revision.previous_status)} -> ${getPlanStatusLabel(revision.new_status)}`
                                  : getPlanStatusLabel(revision.new_status || undefined)}
                              </div>
                            </div>
                            <div className="text-xs text-slate-500">
                              {new Date(revision.created_at).toLocaleString('pt-BR')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Assessments */}
                <div>
                  <h3 className="font-bold text-slate-900 mb-3">Avaliações Recentes</h3>
                  <div className="space-y-2">
                    {selectedStudent.assessments.map((assessment, index) => (
                      <div key={index} className="bg-slate-50 rounded-xl p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-semibold text-slate-900">
                              Score: {assessment.score}%
                            </div>
                            <div className="text-sm text-slate-600">
                              {new Date(assessment.created_at).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-slate-600">
                              <span className="text-red-600">Fracos: {assessment.weak_topics.length}</span> | 
                              <span className="text-green-600"> Fortes: {assessment.strong_topics.length}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Weekly Stats */}
                {selectedStudent.weekly_stats.length > 0 && (
                  <div>
                    <h3 className="font-bold text-slate-900 mb-3">Estatísticas Semanais</h3>
                    <div className="space-y-2">
                      {selectedStudent.weekly_stats.map((stat, index) => (
                        <div key={index} className="bg-slate-50 rounded-xl p-4">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-slate-600">Semana:</span>
                              <span className="ml-2 font-semibold">
                                {new Date(stat.week_start).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-600">Tempo estudo:</span>
                              <span className="ml-2 font-semibold">{stat.total_study_time}min</span>
                            </div>
                            <div>
                              <span className="text-slate-600">Dias completos:</span>
                              <span className="ml-2 font-semibold">{stat.completed_days}/7</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
