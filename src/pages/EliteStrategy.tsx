import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle2, Clock, Target, TrendingUp, AlertCircle, Play, BarChart3, BookOpen } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';

interface DailyPlan {
  type:
    | 'study'
    | 'simulation'
    | 'planning'
    | 'review'
    | 'training'
    | 'practice'
    | 'srs'
    | 'speed_mode'
    | 'rest'
    | 'mini_simulation';
  focus: string;
  estimatedTime?: number;
  topics?: string[];
  time?: string | null;
  completed?: boolean;
  completedAt?: string;
}

interface StudyPlan {
  id: string;
  week_start: string;
  week_end: string;
  daily_plan: Record<string, DailyPlan>;
  focus_topics: string[];
  status: 'active' | 'completed';
  progress?: number;
}

export default function EliteStrategy() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayProgress, setTodayProgress] = useState(0);
  const [weekProgress, setWeekProgress] = useState(0);

  useEffect(() => {
    loadCurrentStudyPlan();
  }, []);

  const loadCurrentStudyPlan = async () => {
    if (!profile?.id) return;

    try {
      const { data: plan } = await supabase
        .from('elite_study_plans')
        .select('*')
        .eq('user_id', profile.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (plan) {
        setStudyPlan(plan);
        calculateProgress(plan);
      } else {
        const { data: legacyPlan } = await supabase
          .from('study_plans')
          .select('id, generated_at, plan_json')
          .eq('user_id', profile.id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .single();

        if (legacyPlan?.plan_json) {
          const parsed = legacyPlan.plan_json as any;
          const mappedPlan: StudyPlan = {
            id: legacyPlan.id,
            week_start: parsed.week_start || legacyPlan.generated_at,
            week_end: parsed.week_end || legacyPlan.generated_at,
            daily_plan: parsed.daily_plan || {},
            focus_topics: parsed.focus_topics || [],
            status: 'active'
          };
          setStudyPlan(mappedPlan);
          calculateProgress(mappedPlan);
        } else {
          navigate('/elite-plan-preview');
        }
      }
    } catch (error) {
      console.error('Error loading study plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = (plan: StudyPlan) => {
    const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });
    const todayKey = Object.keys(plan.daily_plan).find(day => 
      day.toLowerCase().includes(today.toLowerCase().substring(0, 3))
    );

    let completedToday = 0;
    let totalToday = 0;
    let completedWeek = 0;
    let totalWeek = 0;

    Object.entries(plan.daily_plan).forEach(([day, dailyPlan]) => {
      totalWeek++;
      if (dailyPlan.completed) {
        completedWeek++;
        if (day === todayKey) {
          completedToday++;
        }
      }
      if (day === todayKey) {
        totalToday++;
      }
    });

    setTodayProgress(totalToday > 0 ? (completedToday / totalToday) * 100 : 0);
    setWeekProgress(totalWeek > 0 ? (completedWeek / totalWeek) * 100 : 0);
  };

  const handleStartDailyActivity = async (day: string, activity: DailyPlan) => {
    if (activity.type === 'simulation' || activity.type === 'mini_simulation') {
      navigate('/simulation?mode=weekly');
    } else if (activity.type === 'speed_mode') {
      navigate('/speed-mode');
    } else if (activity.type === 'study' || activity.type === 'training' || activity.type === 'practice' || activity.type === 'review' || activity.type === 'srs') {
      navigate(`/training?topic=${encodeURIComponent(activity.focus || 'Revisao geral')}&mode=elite`);
    } else if (activity.type === 'planning') {
      navigate('/elite-plan-preview');
    } else if (activity.type === 'rest') {
      return;
    } else {
      navigate('/training?mode=elite');
    }
  };

  const markActivityCompleted = async (day: string) => {
    if (!studyPlan || !profile?.id) return;

    const updatedPlan = {
      ...studyPlan,
      daily_plan: {
        ...studyPlan.daily_plan,
        [day]: {
          ...studyPlan.daily_plan[day],
          completed: true,
          completedAt: new Date().toISOString()
        }
      }
    };

    try {
      await supabase
        .from('elite_study_plans')
        .update({
          daily_plan: updatedPlan.daily_plan,
          updated_at: new Date().toISOString()
        })
        .eq('id', studyPlan.id);

      setStudyPlan(updatedPlan);
      calculateProgress(updatedPlan);
    } catch (error) {
      console.error('Error marking activity completed:', error);
    }
  };

  const getDayStatus = (day: string, activity: DailyPlan) => {
    const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });
    const isToday = day.toLowerCase().includes(today.toLowerCase().substring(0, 3));
    const isPast = new Date(day) < new Date() && !isToday;

    if (activity.completed) return 'completed';
    if (isToday) return 'today';
    if (isPast) return 'overdue';
    return 'upcoming';
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'study': return <BookOpen className="h-5 w-5" />;
      case 'simulation': return <BarChart3 className="h-5 w-5" />;
      case 'planning': return <Calendar className="h-5 w-5" />;
      case 'review': return <Target className="h-5 w-5" />;
      default: return <BookOpen className="h-5 w-5" />;
    }
  };

  const getActivityColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'today': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'overdue': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <Calendar className="h-16 w-16 text-amber-600 mx-auto mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Carregando seu plano</h2>
          <p className="text-slate-600">Preparando sua estratégia de estudos...</p>
        </div>
      </div>
    );
  }

  if (!studyPlan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-amber-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Plano não encontrado</h2>
          <p className="text-slate-600 mb-4">Você precisa completar a avaliação primeiro</p>
          <button
            onClick={() => navigate('/elite-assessment')}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-emerald-500 text-white rounded-xl font-bold hover:opacity-90"
          >
            Fazer Avaliação
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-emerald-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-slate-900 mb-4">Seu Plano de Estudos</h1>
          <p className="text-xl text-slate-600">
            Estratégia personalizada para maximizar seu desempenho
          </p>
        </div>

        {/* Progress Overview */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-green-200 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Progresso Hoje</h3>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-green-600 mb-2">{Math.round(todayProgress)}%</div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${todayProgress}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-amber-200 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Progresso Semanal</h3>
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
            <div className="text-3xl font-bold text-amber-600 mb-2">{Math.round(weekProgress)}%</div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${weekProgress}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-blue-200 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Foco da Semana</h3>
              <Target className="h-5 w-5 text-blue-600" />
            </div>
            <div className="space-y-1">
              {studyPlan.focus_topics.slice(0, 3).map((topic, index) => (
                <div key={index} className="text-sm text-slate-600">
                  • {topic}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Weekly Plan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
            <Calendar className="h-6 w-6 text-amber-600" />
            Cronograma Semanal
          </h2>

          <div className="grid md:grid-cols-7 gap-4">
            {Object.entries(studyPlan.daily_plan).map(([day, activity]) => {
              const status = getDayStatus(day, activity);
              const colors = getActivityColor(status);

              return (
                <div key={day} className={`rounded-xl border-2 p-4 ${colors}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm">{day}</h3>
                    {activity.completed && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {getActivityIcon(activity.type)}
                      <span className="text-xs font-medium">
                        {activity.type === 'study' ? 'Estudo' :
                         activity.type === 'simulation' ? 'Simulado' :
                         activity.type === 'planning' ? 'Planejamento' : 'Revisão'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 mb-2">
                      {activity.focus}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      {activity.estimatedTime}min
                    </div>

                    {!activity.completed && status === 'today' && (
                      <button
                        onClick={() => handleStartDailyActivity(day, activity)}
                        className="w-full mt-2 px-2 py-1 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 flex items-center justify-center gap-1"
                      >
                        <Play className="h-3 w-3" />
                        Começar
                      </button>
                    )}

                    {activity.completed && (
                      <div className="text-xs text-green-600 font-semibold">
                        Concluído ✓
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Focus Topics */}
        <div className="bg-gradient-to-r from-amber-600 to-emerald-600 rounded-3xl p-8 text-white">
          <h2 className="text-2xl font-bold mb-6">Tópicos de Foco Esta Semana</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {studyPlan.focus_topics.map((topic, index) => (
              <div key={index} className="bg-white/10 backdrop-blur rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5" />
                  <span className="font-semibold">{topic}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 bg-white/10 backdrop-blur rounded-xl p-4">
            <h3 className="font-bold mb-2">Lembrete:</h3>
            <p className="text-sm">
              Concentre-se nos tópicos identificados na sua avaliação inicial. 
              Ao final da semana, faremos uma reavaliação para ajustar sua estratégia.
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
          >
            Voltar ao Dashboard
          </button>
          <button
            onClick={() => navigate('/simulation?mode=weekly')}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 text-white font-bold hover:opacity-90"
          >
            Fazer Simulado Agora
          </button>
        </div>
      </div>
    </div>
  );
}
