import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Target, Brain, Edit2, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';

interface DailyPlan {
  type: 'training' | 'practice' | 'srs' | 'simulation' | 'review' | 'speed_mode' | 'rest' | 'mini_simulation';
  time: string | null;
  focus: string | null;
}

interface StudyPlan {
  id: string;
  week_start: string;
  week_end: string;
  daily_plan: Record<string, DailyPlan>;
  focus_topics: string[];
  source: string;
}

interface PersonalProfile {
  daily_study_time: 'LOW' | 'MEDIUM' | 'HIGH' | 'INTENSIVE';
  exam_experience: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERIENCED';
  self_declared_weak_area: string;
  preferred_study_period: 'MORNING' | 'AFTERNOON' | 'EVENING';
  preferred_study_hour: string;
}

export default function ElitePlanPreview() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [personalProfile, setPersonalProfile] = useState<PersonalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingMode, setEditingMode] = useState(false);
  const [editablePlan, setEditablePlan] = useState<Record<string, DailyPlan>>({});

  useEffect(() => {
    loadStudyPlan();
  }, []);

  const loadStudyPlan = async () => {
    if (!profile?.id) return;

    try {
      // Carregar plano de estudos
      const { data: plan } = await supabase
        .from('elite_study_plans')
        .select('*')
        .eq('user_id', profile.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (plan) {
        setStudyPlan(plan as StudyPlan);
        setEditablePlan(plan.daily_plan);
      }

      // Carregar perfil pessoal
      const { data: profileData } = await supabase
        .from('elite_profiles')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      if (profileData) {
        setPersonalProfile(profileData as PersonalProfile);
      }
    } catch (error) {
      console.error('Error loading study plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeChange = (day: string, newTime: string) => {
    setEditablePlan(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        time: newTime
      }
    }));
  };

  const handleFocusChange = (day: string, newFocus: string) => {
    setEditablePlan(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        focus: newFocus
      }
    }));
  };

  const handleTypeChange = (day: string, newType: DailyPlan['type']) => {
    setEditablePlan(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        type: newType
      }
    }));
  };

  const handleConfirmPlan = async () => {
    if (!studyPlan || !profile?.id) return;

    try {
      await supabase
        .from('elite_study_plans')
        .update({
          daily_plan: editablePlan,
          updated_at: new Date().toISOString()
        })
        .eq('id', studyPlan.id);

      setStudyPlan(prev => prev ? { ...prev, daily_plan: editablePlan } : null);
      setEditingMode(false);
    } catch (error) {
      console.error('Error updating study plan:', error);
      alert('Erro ao atualizar plano. Tente novamente.');
    }
  };

  const handleCancelEdit = () => {
    if (studyPlan) {
      setEditablePlan(studyPlan.daily_plan);
    }
    setEditingMode(false);
  };

  const getActivityLabel = (type: DailyPlan['type']) => {
    const labels = {
      training: 'Treino',
      practice: 'Prática',
      srs: 'Revisão SRS',
      simulation: 'Simulado',
      review: 'Revisão',
      speed_mode: 'Speed Mode',
      rest: 'Descanso',
      mini_simulation: 'Mini Simulado'
    };
    return labels[type] || type;
  };

  const getActivityColor = (type: DailyPlan['type']) => {
    const colors = {
      training: 'bg-blue-100 text-blue-700 border-blue-200',
      practice: 'bg-green-100 text-green-700 border-green-200',
      srs: 'bg-purple-100 text-purple-700 border-purple-200',
      simulation: 'bg-red-100 text-red-700 border-red-200',
      review: 'bg-amber-100 text-amber-700 border-amber-200',
      speed_mode: 'bg-orange-100 text-orange-700 border-orange-200',
      rest: 'bg-gray-100 text-gray-700 border-gray-200',
      mini_simulation: 'bg-pink-100 text-pink-700 border-pink-200'
    };
    return colors[type] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getIntensityLabel = (intensity: string) => {
    const labels = {
      LOW: 'Plano Leve',
      MEDIUM: 'Plano Equilibrado',
      HIGH: 'Plano Intensivo',
      INTENSIVE: 'Plano Super Intensivo'
    };
    return labels[intensity as keyof typeof labels] || intensity;
  };

  const getExperienceLabel = (experience: string) => {
    const labels = {
      BEGINNER: 'Iniciante',
      INTERMEDIATE: 'Intermediário',
      EXPERIENCED: 'Experiente'
    };
    return labels[experience as keyof typeof labels] || experience;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <Calendar className="h-16 w-16 text-amber-600 mx-auto mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Carregando seu plano</h2>
          <p className="text-slate-600">Preparando sua estratégia personalizada...</p>
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
          <p className="text-slate-600 mb-4">Você precisa completar a avaliação primeiro.</p>
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

  const weekDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const currentPlan = editingMode ? editablePlan : studyPlan.daily_plan;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-emerald-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 bg-amber-100 rounded-full px-6 py-3 mb-6">
            <Calendar className="h-8 w-8 text-amber-600" />
            <span className="text-amber-900 font-bold text-lg">Seu Plano Estratégico de Estudo</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-4">
            Plano Personalizado para Sua Aprovação
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Este plano foi criado com base no seu tempo disponível, horário preferido de estudo e desempenho na avaliação.
          </p>
        </div>

        {/* Personal Profile Summary */}
        {personalProfile && (
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl border border-blue-200 p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900">Tempo de Estudo</h3>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {getIntensityLabel(personalProfile.daily_study_time)}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-green-200 p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <Brain className="h-5 w-5 text-green-600" />
                <h3 className="font-bold text-slate-900">Experiência</h3>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {getExperienceLabel(personalProfile.exam_experience)}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-purple-200 p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <Target className="h-5 w-5 text-purple-600" />
                <h3 className="font-bold text-slate-900">Área Foco</h3>
              </div>
              <div className="text-lg font-bold text-purple-600">
                {personalProfile.self_declared_weak_area}
              </div>
            </div>
          </div>
        )}

        {/* Weekly Plan */}
        <div className="bg-white rounded-2xl border border-amber-200 p-8 shadow-lg mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <Calendar className="h-6 w-6 text-amber-600" />
              Cronograma Semanal
            </h2>
            {!editingMode && (
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50"
              >
                Cancelar
              </button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-7">
            {weekDays.map((day) => {
              const dayPlan = currentPlan[day.toLowerCase()];
              const isRestDay = !dayPlan?.type || dayPlan?.type === 'rest';

              return (
                <div key={day} className="border border-slate-200 rounded-xl p-4">
                  <div className="text-center mb-3">
                    <div className="font-bold text-slate-900 mb-1">{day}</div>
                    {dayPlan?.time && (
                      <div className="text-sm text-slate-600 flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3" />
                        {dayPlan.time}
                      </div>
                    )}
                  </div>

                  {editingMode ? (
                    <div className="space-y-2">
                      <select
                        value={dayPlan?.type || ''}
                        onChange={(e) => handleTypeChange(day.toLowerCase(), e.target.value as DailyPlan['type'])}
                        className="w-full p-2 text-sm border border-slate-200 rounded-lg focus:border-amber-500 focus:outline-none"
                      >
                        <option value="">Selecione...</option>
                        <option value="training">Treino</option>
                        <option value="practice">Prática</option>
                        <option value="srs">Revisão SRS</option>
                        <option value="simulation">Simulado</option>
                        <option value="review">Revisão</option>
                        <option value="speed_mode">Speed Mode</option>
                        <option value="rest">Descanso</option>
                        <option value="mini_simulation">Mini Simulado</option>
                      </select>

                      <input
                        type="text"
                        value={dayPlan?.time || ''}
                        onChange={(e) => handleTimeChange(day.toLowerCase(), e.target.value)}
                        placeholder="Horário"
                        className="w-full p-2 text-sm border border-slate-200 rounded-lg focus:border-amber-500 focus:outline-none"
                      />

                      <input
                        type="text"
                        value={dayPlan?.focus || ''}
                        onChange={(e) => handleFocusChange(day.toLowerCase(), e.target.value)}
                        placeholder="Foco"
                        className="w-full p-2 text-sm border border-slate-200 rounded-lg focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      {dayPlan && !isRestDay && (
                        <div className={`p-3 rounded-lg text-center text-sm font-medium ${getActivityColor(dayPlan.type)}`}>
                          <div className="font-bold mb-1">
                            {getActivityLabel(dayPlan.type)}
                          </div>
                          {dayPlan.focus && (
                            <div className="text-xs">
                              {dayPlan.focus}
                            </div>
                          )}
                        </div>
                      )}
                      {isRestDay && (
                        <div className="p-3 rounded-lg text-center text-sm font-medium bg-gray-100 text-gray-700 border-gray-200">
                          <div className="font-bold">Descanso</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Focus Areas */}
        {studyPlan.focus_topics && studyPlan.focus_topics.length > 0 && (
          <div className="bg-gradient-to-r from-amber-600 to-emerald-600 rounded-3xl p-8 text-white mb-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
              <Target className="h-6 w-6" />
              Foco Principal da Semana
            </h3>
            <div className="flex flex-wrap gap-3">
              {studyPlan.focus_topics.map((topic, index) => (
                <div key={index} className="bg-white/20 backdrop-blur rounded-xl px-4 py-2">
                  {topic}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Plan Info */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg mb-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-slate-900 mb-3">Período do Plano</h4>
              <div className="text-slate-600">
                <div>Início: {new Date(studyPlan.week_start).toLocaleDateString('pt-BR')}</div>
                <div>Fim: {new Date(studyPlan.week_end).toLocaleDateString('pt-BR')}</div>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-3">Origem do Plano</h4>
              <div className="text-slate-600">
                {studyPlan.source === 'ai_generated' ? 'Gerado por IA' : 'Template Predefinido'}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="text-center">
          {editingMode ? (
            <div className="space-y-4">
              <button
                onClick={handleConfirmPlan}
                className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-500 to-emerald-500 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-xl"
              >
                <CheckCircle2 className="h-6 w-6" />
                Confirmar Plano
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => navigate('/elite-strategy')}
                className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-500 to-emerald-500 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-xl"
              >
                <Target className="h-6 w-6" />
                Começar Plano
              </button>
              
              <button
                onClick={() => setEditingMode(true)}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all"
              >
                <Edit2 className="h-6 w-6" />
                Ajustar Plano
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
