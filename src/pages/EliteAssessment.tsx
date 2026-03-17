import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Target, Calendar, User } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { archiveCurrentPlans, createPlanRevision } from '../lib/elitePlans';

interface PersonalAnswers {
  daily_study_time: 'LOW' | 'MEDIUM' | 'HIGH' | 'INTENSIVE';
  exam_experience: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERIENCED';
  preferred_study_period: 'MORNING' | 'AFTERNOON' | 'EVENING';
  preferred_study_hour: string;
}

interface AssessmentResult {
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  weakTopics: string[];
  strongTopics: string[];
  recommendations: string[];
}

const WEEK_DAYS: { key: string; label: string }[] = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terça' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' }
];

const DEFAULT_TOPICS = [
  'Revisao geral',
  'Saude publica',
  'Epidemiologia',
  'Anatomia',
  'Farmacologia',
  'Urgencias',
  'Pediatria',
  'Saude materna',
  'Saude mental',
  'Etica profissional'
];


export default function EliteAssessment() {
  const { profile, refreshProfile } = useAuthStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [showPersonalQuestions, setShowPersonalQuestions] = useState(true);
  const [showTechnicalStep, setShowTechnicalStep] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<AssessmentResult | null>(null);
  const [selectedDays, setSelectedDays] = useState<string[]>([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
  ]);
  const [submitting, setSubmitting] = useState(false);

  const [personalAnswers, setPersonalAnswers] = useState<PersonalAnswers>({
    daily_study_time: 'MEDIUM',
    exam_experience: 'BEGINNER',
    preferred_study_period: 'EVENING',
    preferred_study_hour: '21:00'
  });

  const [technicalTopics, setTechnicalTopics] = useState<string[]>([]);
  const [selectedTechnicalTopics, setSelectedTechnicalTopics] = useState<string[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    const loadTopics = async () => {
      if (!profile?.selected_area_id) {
        setTechnicalTopics(DEFAULT_TOPICS);
        setSelectedTechnicalTopics(DEFAULT_TOPICS.slice(0, 3));
        return;
      }
      setLoadingTopics(true);
      const { data, error } = await supabase
        .from('topics')
        .select('name')
        .eq('area_id', profile.selected_area_id)
        .order('name')
        .limit(10);

      if (error || !data || data.length === 0) {
        setTechnicalTopics(DEFAULT_TOPICS);
        setSelectedTechnicalTopics(DEFAULT_TOPICS.slice(0, 3));
      } else {
        const names = data.map(t => t.name);
        setTechnicalTopics(names);
        setSelectedTechnicalTopics(prev => (prev.length ? prev : names.slice(0, Math.min(3, names.length))));
      }
      setLoadingTopics(false);
    };
    void loadTopics();
  }, [profile?.selected_area_id]);

  useEffect(() => {
    const loadLatestAssessment = async () => {
      if (!profile?.id) return;
      const { data } = await supabase
        .from('elite_assessments')
        .select('weak_topics')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.weak_topics?.length) {
        setSelectedTechnicalTopics(data.weak_topics.slice(0, 5));
      }
    };
    void loadLatestAssessment();
  }, [profile?.id]);

  const handlePersonalAnswer = (field: keyof PersonalAnswers, value: string) => {
    setPersonalAnswers(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleTopic = (topic: string) => {
    setSelectedTechnicalTopics(prev => {
      if (prev.includes(topic)) return prev.filter(t => t !== topic);
      if (prev.length >= 10) return prev;
      return [...prev, topic];
    });
  };

  const isLegacyEliteProfileSchemaError = (error: any) => {
    const errorText = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return (
      error?.code === 'PGRST204' ||
      error?.code === '42703' ||
      errorText.includes('study_days') ||
      errorText.includes('selected_area_id')
    );
  };

  const persistPersonalData = async () => {
    if (!profile?.id) {
      throw new Error('Perfil do usuario indisponivel para salvar respostas Elite.');
    }

    const persistEliteProfilePayload = async (payload: Record<string, unknown>) => {
      const { data: existingProfile, error: lookupError } = await supabase
        .from('elite_profiles')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (existingProfile?.id) {
        return supabase
          .from('elite_profiles')
          .update(payload)
          .eq('id', existingProfile.id);
      }

      return supabase
        .from('elite_profiles')
        .insert(payload);
    };

    const basePayload = {
      user_id: profile.id,
      daily_study_time: personalAnswers.daily_study_time,
      exam_experience: personalAnswers.exam_experience,
      preferred_study_period: personalAnswers.preferred_study_period,
      preferred_study_hour: personalAnswers.preferred_study_hour
    };

    const extendedPayload = {
      ...basePayload,
      study_days: selectedDays,
      selected_area_id: profile.selected_area_id || null
    };

    let { error } = await persistEliteProfilePayload(extendedPayload);

    if (error && isLegacyEliteProfileSchemaError(error)) {
      console.warn('elite_profiles ainda sem colunas novas; salvando com schema basico', error);
      ({ error } = await persistEliteProfilePayload(basePayload));
    }

    if (error) throw error;

    if (profile.selected_area_id) {
      const { error: syncProfileError } = await supabase
        .from('profiles')
        .update({ selected_area_id: String(profile.selected_area_id) })
        .eq('id', profile.id);

      if (syncProfileError) {
        console.warn('Nao foi possivel sincronizar a area principal em profiles', syncProfileError);
      }
    }

    await refreshProfile(profile.id);
  };

  const getTimeSuggestions = () => {
    switch (personalAnswers.preferred_study_period) {
      case 'MORNING':
        return ['07:00', '08:00', '09:00'];
      case 'AFTERNOON':
        return ['14:00', '15:00', '16:00'];
      case 'EVENING':
      default:
        return ['20:00', '21:00', '22:00'];
    }
  };

  const generateRecommendations = (weakTopics: string[], strongTopics: string[]): string[] => {
    const recommendations: string[] = [];

    if (weakTopics.length > 0) {
      recommendations.push(`Foque nos tópicos: ${weakTopics.slice(0, 3).join(', ')}`);
      recommendations.push('Dedique 60% do seu tempo de estudo aos pontos fracos identificados');
    }

    if (strongTopics.length > 0) {
      recommendations.push(`Mantenha o domínio em: ${strongTopics.slice(0, 2).join(', ')}`);
      recommendations.push('Use seus pontos fortes para ganhar confiança nas provas');
    }

    switch (personalAnswers.daily_study_time) {
      case 'LOW':
        recommendations.push('Otimize seu tempo limitado focando nos tópicos mais importantes');
        break;
      case 'HIGH':
      case 'INTENSIVE':
        recommendations.push('Aproveite o tempo disponível para revisão profunda e prática intensiva');
        break;
    }

    switch (personalAnswers.exam_experience) {
      case 'BEGINNER':
        recommendations.push('Comece com sessões mais curtas e aumente gradualmente');
        break;
      case 'EXPERIENCED':
        recommendations.push('Foque em simulados e estratégias de prova');
        break;
    }

    recommendations.push('Estude nos seus horários preferidos para melhor aproveitamento');
    return recommendations;
  };

  const getFallbackPlan = (intensity: string) => {
    const templates = {
      LOW: {
        monday: { type: 'training', time: '20:00', focus: 'Revisão básica' },
        tuesday: { type: 'rest', time: null, focus: null },
        wednesday: { type: 'practice', time: '20:00', focus: 'Exercícios leves' },
        thursday: { type: 'rest', time: null, focus: null },
        friday: { type: 'srs', time: '20:00', focus: 'Revisão SRS' },
        saturday: { type: 'rest', time: null, focus: null },
        sunday: { type: 'mini_simulation', time: '20:00', focus: 'Mini simulado' }
      },
      MEDIUM: {
        monday: { type: 'training', time: '20:00', focus: 'Estudo focado' },
        tuesday: { type: 'training', time: '21:00', focus: 'Prática intensiva' },
        wednesday: { type: 'practice', time: '20:00', focus: 'Exercícios variados' },
        thursday: { type: 'srs', time: '21:00', focus: 'Revisão SRS' },
        friday: { type: 'practice', time: '20:00', focus: 'Speed mode' },
        saturday: { type: 'review', time: '16:00', focus: 'Revisão semanal' },
        sunday: { type: 'simulation', time: '20:00', focus: 'Simulado completo' }
      },
      HIGH: {
        monday: { type: 'training', time: '20:00', focus: 'Estudo intensivo' },
        tuesday: { type: 'practice', time: '21:00', focus: 'Prática avançada' },
        wednesday: { type: 'srs', time: '20:00', focus: 'Revisão SRS' },
        thursday: { type: 'practice', time: '21:00', focus: 'Speed mode' },
        friday: { type: 'training', time: '20:00', focus: 'Estudo focado' },
        saturday: { type: 'review', time: '16:00', focus: 'Revisão completa' },
        sunday: { type: 'simulation', time: '20:00', focus: 'Simulado completo' }
      },
      INTENSIVE: {
        monday: { type: 'training', time: '20:00', focus: 'Estudo super intensivo' },
        tuesday: { type: 'practice', time: '21:00', focus: 'Prática expert' },
        wednesday: { type: 'srs', time: '20:00', focus: 'Revisão SRS' },
        thursday: { type: 'practice', time: '21:00', focus: 'Speed mode avançado' },
        friday: { type: 'training', time: '20:00', focus: 'Estudo focado' },
        saturday: { type: 'review', time: '14:00', focus: 'Revisão detalhada' },
        sunday: { type: 'simulation', time: '20:00', focus: 'Simulado completo' }
      }
    };
    return templates[intensity as keyof typeof templates] || templates.MEDIUM;
  };

  const saveStudyPlan = async (
    plan: any,
    source: string,
    focusTopics: string[],
    assessmentResults?: AssessmentResult
  ) => {
    const weekStart = new Date();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const normalizedPlan: any = { ...plan };
    Object.keys(normalizedPlan).forEach(dayKey => {
      const isSelected = selectedDays.includes(dayKey.toLowerCase());
      if (!isSelected) {
        normalizedPlan[dayKey] = { type: 'rest', time: null, focus: 'Descanso', topics: [] };
      }
    });

    const planPayload = {
      user_id: profile?.id,
      week_start: weekStart.toISOString(),
      week_end: weekEnd.toISOString(),
      daily_plan: normalizedPlan,
      focus_topics: focusTopics || [],
      status: 'draft',
      status_changed_at: new Date().toISOString(),
      source,
      created_at: new Date().toISOString()
    };

    if (profile?.id) {
      await archiveCurrentPlans(profile.id);
    }

    const { data: createdPlan, error: planError } = await supabase
      .from('elite_study_plans')
      .insert(planPayload)
      .select('id')
      .single();

    if (planError) {
      console.warn('elite_study_plans indisponivel, salvando fallback em study_plans', planError);
      await supabase.from('study_plans').insert({
        user_id: profile?.id,
        plan_json: planPayload,
        generated_at: new Date().toISOString()
      });
    } else if (createdPlan?.id && profile?.id) {
      await createPlanRevision({
        planId: createdPlan.id,
        userId: profile.id,
        eventType: 'created',
        actorRole: 'student',
        previousStatus: null,
        newStatus: 'draft',
        changeSummary: 'Plano inicial gerado a partir do diagnostico Elite.',
        snapshot: {
          daily_plan: normalizedPlan,
          focus_topics: focusTopics || [],
          source
        }
      });
    }

    if (assessmentResults) {
      const { error: assessError } = await supabase.from('elite_assessments').insert({
        user_id: profile?.id,
        assessment_type: 'weekly_personal_only',
        total_questions: assessmentResults.totalQuestions || 0,
        correct_answers: assessmentResults.correctAnswers || 0,
        score: assessmentResults.score || 0,
        duration_seconds: 0,
        weak_topics: assessmentResults.weakTopics || [],
        strong_topics: assessmentResults.strongTopics || [],
        recommendations: assessmentResults.recommendations || generateRecommendations([], []),
        created_at: new Date().toISOString()
      });

      if (assessError) {
        console.warn('elite_assessments indisponivel, prosseguindo sem gravar avaliacao', assessError);
      }
    }
  };

  const generatePersonalizedStrategy = async (assessmentResults: AssessmentResult, personalData: PersonalAnswers) => {
    try {
      const fallbackPlan = getFallbackPlan(personalData.daily_study_time);
      await saveStudyPlan(fallbackPlan, 'template', assessmentResults.weakTopics || [], assessmentResults);
    } catch (error) {
      console.error('Error generating personalized strategy:', error);
    }
  };

  const handleContinueFromPersonal = async () => {
    if (selectedDays.length === 0) {
      alert('Escolha ao menos um dia da semana para estudar.');
      return;
    }
    setSubmitting(true);
    try {
      await persistPersonalData();
      if (technicalTopics.length > 0) {
        setShowPersonalQuestions(false);
        setShowTechnicalStep(true);
      } else {
        await finalizeAssessment();
      }
    } catch (error) {
      console.error('Error saving personal answers:', error);
      alert('Erro ao salvar suas informacoes. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const finalizeAssessment = async () => {
    setSubmitting(true);
    try {
      const syntheticResults: AssessmentResult = {
        totalQuestions: 0,
        correctAnswers: 0,
        score: 0,
        weakTopics: selectedTechnicalTopics,
        strongTopics: [],
        recommendations: generateRecommendations(selectedTechnicalTopics, [])
      };

      await generatePersonalizedStrategy(syntheticResults, personalAnswers);
      setResults(syntheticResults);
      setShowPersonalQuestions(false);
      setShowTechnicalStep(false);
      setShowResults(true);
    } catch (error) {
      console.error('Error generating plan:', error);
      alert('Erro ao gerar plano. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipTechnicalStep = async () => {
    setSubmitting(true);
    try {
      const syntheticResults: AssessmentResult = {
        totalQuestions: 0,
        correctAnswers: 0,
        score: 0,
        weakTopics: [],
        strongTopics: [],
        recommendations: generateRecommendations([], [])
      };

      await generatePersonalizedStrategy(syntheticResults, personalAnswers);
      setResults(syntheticResults);
      setShowPersonalQuestions(false);
      setShowTechnicalStep(false);
      setShowResults(true);
    } catch (error) {
      console.error('Error generating fallback plan:', error);
      alert('Erro ao gerar plano padrão. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };
  const handleContinueToPlan = () => {
    // Garantir que o plano foi gerado; se ainda não houver, gerar fallback e depois navegar
    if (!results) {
      const syntheticResults: AssessmentResult = {
        totalQuestions: 0,
        correctAnswers: 0,
        score: 0,
        weakTopics: [],
        strongTopics: [],
        recommendations: generateRecommendations([], [])
      };
      generatePersonalizedStrategy(syntheticResults, personalAnswers).finally(() => navigate('/elite-plan-preview'));
    } else {
      navigate('/elite-plan-preview');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-amber-200 border-t-amber-600"></div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2 mt-4">Preparando sua avaliação</h2>
          <p className="text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (showResults && results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-emerald-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 bg-green-100 rounded-full px-6 py-3 mb-6">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <span className="text-green-900 font-bold text-lg">Plano criado!</span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 mb-4">Pronto para começar</h1>
            <p className="text-xl text-slate-600">
              Geramos seu plano semanal com base na sua disponibilidade. Você pode revisar os detalhes antes de iniciar.
            </p>
          </div>

          <div className="bg-gradient-to-r from-amber-600 to-emerald-600 rounded-3xl p-8 text-white mb-8">
            <h2 className="text-2xl font-bold mb-6">Resumo rápido</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white/10 rounded-xl p-4">
                <p className="text-sm text-amber-200">Tempo diário</p>
                <p className="text-xl font-bold">
                  {personalAnswers.daily_study_time === 'LOW'
                    ? 'Menos de 1h'
                    : personalAnswers.daily_study_time === 'MEDIUM'
                    ? '1-2h'
                    : personalAnswers.daily_study_time === 'HIGH'
                    ? '2-3h'
                    : 'Mais de 3h'}
                </p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <p className="text-sm text-amber-200">Experiência</p>
                <p className="text-xl font-bold">
                  {personalAnswers.exam_experience === 'BEGINNER'
                    ? 'Iniciante'
                    : personalAnswers.exam_experience === 'INTERMEDIATE'
                    ? 'Intermediário'
                    : 'Experiente'}
                </p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <p className="text-sm text-amber-200">Dias escolhidos</p>
                <p className="text-xl font-bold">{selectedDays.length} dia(s)/semana</p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={handleContinueToPlan}
              className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-500 to-emerald-500 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-xl"
            >
              <Calendar className="h-6 w-6" />
              Ver Plano de Estudos Detalhado
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showTechnicalStep) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-emerald-50 py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-8">
            <Target className="h-16 w-16 text-emerald-600 mx-auto mb-4" />
            <h1 className="text-3xl font-black text-slate-900 mb-4">Escolha os topicos de foco</h1>
            <p className="text-lg text-slate-600">
              Usaremos os topicos mais fracos e o radar ja existente; selecione ate 10 ou pule se quiser seguir o padrao.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-emerald-200 p-8 shadow-lg space-y-6">
            {loadingTopics ? (
              <div className="flex items-center justify-center py-10 text-emerald-700">Carregando topicos...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {technicalTopics.map(topic => {
                  const active = selectedTechnicalTopics.includes(topic);
                  return (
                    <button
                      key={topic}
                      onClick={() => toggleTopic(topic)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        active
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <div className="font-semibold">{topic}</div>
                      <div className="text-sm text-slate-500">Clique para {active ? 'remover' : 'focar'}</div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-3 mt-4">
              <button
                onClick={finalizeAssessment}
                className="flex-1 py-4 bg-gradient-to-r from-amber-500 to-emerald-500 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all"
                disabled={submitting}
              >
                {submitting ? 'Gerando plano...' : 'Gerar plano com topicos'}
              </button>
              <button
                onClick={handleSkipTechnicalStep}
                className="flex-1 py-4 border-2 border-slate-200 text-slate-700 rounded-xl font-bold text-lg hover:border-slate-300 transition-all"
                disabled={submitting}
              >
                Pular (usar padrao)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showPersonalQuestions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-emerald-50 py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-8">
            <User className="h-16 w-16 text-amber-600 mx-auto mb-4" />
            <h1 className="text-3xl font-black text-slate-900 mb-4">Vamos Personalizar Seu Plano</h1>
            <p className="text-lg text-slate-600">
              Responda algumas perguntas para criarmos a estratégia perfeita para você
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-amber-200 p-8 shadow-lg space-y-8">
            {/* Tempo de estudo */}
            <div>
              <label className="block text-lg font-bold text-slate-900 mb-4">
                Quantas horas por dia você consegue estudar?
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { value: 'LOW', label: 'Menos de 1 hora' },
                  { value: 'MEDIUM', label: 'Entre 1 e 2 horas' },
                  { value: 'HIGH', label: 'Entre 2 e 3 horas' },
                  { value: 'INTENSIVE', label: 'Mais de 3 horas' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handlePersonalAnswer('daily_study_time', option.value)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      personalAnswers.daily_study_time === option.value
                        ? 'border-amber-500 bg-amber-50 text-amber-900'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div className="font-semibold">{option.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Experiência */}
            <div>
              <label className="block text-lg font-bold text-slate-900 mb-4">
                Você já participou de concursos públicos?
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { value: 'BEGINNER', label: 'Nunca participei' },
                  { value: 'INTERMEDIATE', label: 'Já participei algumas vezes' },
                  { value: 'EXPERIENCED', label: 'Já participei várias vezes' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handlePersonalAnswer('exam_experience', option.value)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      personalAnswers.exam_experience === option.value
                        ? 'border-amber-500 bg-amber-50 text-amber-900'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div className="font-semibold">{option.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Dias disponíveis */}
            <div>
              <label className="block text-lg font-bold text-slate-900 mb-4">
                Em quais dias desta semana você pode estudar?
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {WEEK_DAYS.map((day) => {
                  const active = selectedDays.includes(day.key);
                  return (
                    <button
                      key={day.key}
                      onClick={() =>
                        setSelectedDays((prev) =>
                          prev.includes(day.key) ? prev.filter((d) => d !== day.key) : [...prev, day.key]
                        )
                      }
                      className={`p-3 rounded-xl border-2 transition-all ${
                        active
                          ? 'border-amber-500 bg-amber-50 text-amber-900'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <div className="font-semibold">{day.label}</div>
                    </button>
                  );
                })}
              </div>
              <p className="text-sm text-amber-600 mt-2">
                Este passo é semanal para acompanhar mudanças na sua escala.
              </p>
            </div>

            {/* Período preferido */}
            <div>
              <label className="block text-lg font-bold text-slate-900 mb-4">
                Em qual período do dia você geralmente tem mais disponibilidade para estudar?
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { value: 'MORNING', label: 'Manhã' },
                  { value: 'AFTERNOON', label: 'Tarde' },
                  { value: 'EVENING', label: 'Noite' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handlePersonalAnswer('preferred_study_period', option.value)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      personalAnswers.preferred_study_period === option.value
                        ? 'border-amber-500 bg-amber-50 text-amber-900'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div className="font-semibold">{option.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Horário preferido */}
            <div>
              <label className="block text-lg font-bold text-slate-900 mb-4">
                Qual horário você normalmente prefere estudar?
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {getTimeSuggestions().map((time) => (
                  <button
                    key={time}
                    onClick={() => handlePersonalAnswer('preferred_study_hour', time)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      personalAnswers.preferred_study_hour === time
                        ? 'border-amber-500 bg-amber-50 text-amber-900'
                        : 'border-slate-200 hover-border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div className="font-semibold">{time}</div>
                  </button>
                ))}
              </div>
              {personalAnswers.preferred_study_period === 'EVENING' && (
                <p className="text-sm text-amber-600 mt-2">
                  Horários noturnos são recomendados para estudantes que trabalham durante o dia
                </p>
              )}
            </div>

            <button
              onClick={handleContinueFromPersonal}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-emerald-500 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all"
              disabled={submitting}
            >
              {submitting ? 'Gerando plano...' : 'Continuar para Avaliação de Conhecimento'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
