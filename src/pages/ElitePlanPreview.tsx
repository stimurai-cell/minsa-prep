import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Target, Brain, Edit2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { CURRENT_PLAN_STATUSES, createPlanRevision, getLatestPlanByStatuses, getPlanStatusLabel, type ElitePlanStatus } from '../lib/elitePlans';

interface DailyPlan {
  type:
    | 'training'
    | 'practice'
    | 'srs'
    | 'simulation'
    | 'review'
    | 'speed_mode'
    | 'rest'
    | 'mini_simulation'
    | 'study'
    | 'planning';
  time: string | null;
  focus: string | null;
  estimatedTime?: number;
  topics?: string[];
  completed?: boolean;
}

interface StudyPlan {
  id: string;
  week_start: string;
  week_end: string;
  daily_plan: Record<string, DailyPlan>;
  focus_topics: string[];
  source: string;
  status?: ElitePlanStatus;
}

interface DayConfig {
  label: string;
  keys: string[];
}

interface PersonalProfile {
  daily_study_time: 'LOW' | 'MEDIUM' | 'HIGH' | 'INTENSIVE';
  exam_experience: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERIENCED';
  self_declared_weak_area: string;
  preferred_study_period: 'MORNING' | 'AFTERNOON' | 'EVENING';
  preferred_study_hour: string;
}

interface PlanRevision {
  id: string;
  event_type: string;
  previous_status: string | null;
  new_status: string | null;
  change_summary: string | null;
  created_at: string;
}

const WEEK_DAYS: DayConfig[] = [
  { label: 'Segunda', keys: ['monday', 'segunda'] },
  { label: 'Terca', keys: ['tuesday', 'terca'] },
  { label: 'Quarta', keys: ['wednesday', 'quarta'] },
  { label: 'Quinta', keys: ['thursday', 'quinta'] },
  { label: 'Sexta', keys: ['friday', 'sexta'] },
  { label: 'Sabado', keys: ['saturday', 'sabado'] },
  { label: 'Domingo', keys: ['sunday', 'domingo'] }
];

const ELITE_PLAN_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
  'domingo'
];

const getWeekRange = (weekStartInput?: string | null, weekEndInput?: string | null) => {
  const weekStart = new Date(weekStartInput || new Date().toISOString());
  const safeStart = Number.isNaN(weekStart.getTime()) ? new Date() : weekStart;
  const rawEnd = weekEndInput ? new Date(weekEndInput) : null;
  const safeEnd =
    rawEnd && !Number.isNaN(rawEnd.getTime()) && rawEnd.getTime() > safeStart.getTime()
      ? rawEnd
      : new Date(safeStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    weekStart: safeStart.toISOString(),
    weekEnd: safeEnd.toISOString()
  };
};

const extractLegacyDailyPlan = (payload: any): Record<string, DailyPlan> | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  if (payload.daily_plan && typeof payload.daily_plan === 'object' && !Array.isArray(payload.daily_plan)) {
    return payload.daily_plan as Record<string, DailyPlan>;
  }

  const hasWeeklyShape = ELITE_PLAN_KEYS.some((key) => key in payload);
  return hasWeeklyShape ? (payload as Record<string, DailyPlan>) : null;
};

export default function ElitePlanPreview() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [personalProfile, setPersonalProfile] = useState<PersonalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingMode, setEditingMode] = useState(false);
  const [editablePlan, setEditablePlan] = useState<Record<string, DailyPlan>>({});
  const [planStorage, setPlanStorage] = useState<'elite' | 'legacy' | null>(null);
  const [saving, setSaving] = useState(false);
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('');
  const [revisions, setRevisions] = useState<PlanRevision[]>([]);

  useEffect(() => {
    loadStudyPlan();
  }, []);

  useEffect(() => {
    if (!editingMode || !studyPlan || !profile?.id) return;

    const nextSnapshot = JSON.stringify(editablePlan || {});
    if (!lastSavedSnapshot || nextSnapshot === lastSavedSnapshot) return;

    setAutosaveState('saving');
    const timeout = setTimeout(async () => {
      const ok = await persistPlan(studyPlan.status || 'draft', 'autosave');
      setAutosaveState(ok ? 'saved' : 'error');
    }, 1200);

    return () => clearTimeout(timeout);
  }, [editingMode, editablePlan, lastSavedSnapshot, profile?.id, studyPlan]);

  useEffect(() => {
    if (editingMode && studyPlan) {
      setAutosaveState('idle');
      setLastSavedSnapshot(JSON.stringify(studyPlan.daily_plan || {}));
    }
  }, [editingMode, studyPlan]);

  const resolveDayKey = (plan: Record<string, DailyPlan>, config: DayConfig): string => {
    const byAlias = config.keys.find((key) => plan[key]);
    if (byAlias) return byAlias;
    return config.keys[0];
  };

  const ensureEditableDay = (dayKey: string) => {
    setEditablePlan((prev) => {
      if (prev[dayKey]) return prev;
      return {
        ...prev,
        [dayKey]: {
          type: 'rest',
          time: '20:00',
          focus: 'Descanso'
        }
      };
    });
  };

  const loadStudyPlan = async () => {
    if (!profile?.id) return;

    try {
      const plan = await getLatestPlanByStatuses<StudyPlan>(profile.id, CURRENT_PLAN_STATUSES);

      if (plan) {
        setStudyPlan(plan as StudyPlan);
        setEditablePlan(plan.daily_plan);
        setPlanStorage('elite');
        setLastSavedSnapshot(JSON.stringify(plan.daily_plan || {}));
      } else {
        const { data: legacyPlans, error: legacyError } = await supabase
          .from('study_plans')
          .select('*')
          .eq('user_id', profile.id)
          .order('generated_at', { ascending: false })
          .limit(10);

        const compatibleLegacyPlan = (legacyPlans || []).find((candidate) =>
          !!extractLegacyDailyPlan(candidate?.plan_json)
        );

        if (compatibleLegacyPlan?.plan_json) {
          const parsed = compatibleLegacyPlan.plan_json as any;
          const dailyPlan = extractLegacyDailyPlan(parsed);
          if (dailyPlan) {
            const { weekStart, weekEnd } = getWeekRange(
              parsed.week_start || compatibleLegacyPlan.generated_at,
              parsed.week_end || compatibleLegacyPlan.generated_at
            );
            const mappedPlan: StudyPlan = {
              id: compatibleLegacyPlan.id,
              week_start: weekStart,
              week_end: weekEnd,
              daily_plan: dailyPlan,
              focus_topics: parsed.focus_topics || [],
              source: parsed.source || 'fallback',
              status: parsed.status || 'draft'
            };
            setStudyPlan(mappedPlan);
            setEditablePlan(mappedPlan.daily_plan);
            setPlanStorage('legacy');
            setLastSavedSnapshot(JSON.stringify(mappedPlan.daily_plan || {}));
          }
        } else if (legacyError) {
          console.warn('Nenhum plano encontrado em study_plans', legacyError);
        }
      }

      // Carregar perfil pessoal
      const { data: profileData, error: profileError } = await supabase
        .from('elite_profiles')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      if (profileData) {
        setPersonalProfile(profileData as PersonalProfile);
      } else if (profileError) {
        console.warn('Perfil elite não encontrado, usando dados básicos', profileError);
      }

      const { data: revisionData, error: revisionError } = await supabase
        .from('elite_plan_revisions')
        .select('id,event_type,previous_status,new_status,change_summary,created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(6);

      if (!revisionError) {
        setRevisions((revisionData as PlanRevision[]) || []);
      }
    } catch (error) {
      console.error('Error loading study plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeChange = (day: string, newTime: string) => {
    ensureEditableDay(day);
    setEditablePlan(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        time: newTime
      }
    }));
  };

  const handleFocusChange = (day: string, newFocus: string) => {
    ensureEditableDay(day);
    setEditablePlan(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        focus: newFocus
      }
    }));
  };

  const handleTypeChange = (day: string, newType: DailyPlan['type']) => {
    ensureEditableDay(day);
    setEditablePlan(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        type: newType
      }
    }));
  };

  const isLegacyElitePlanSchemaError = (error: any) => {
    const errorText = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return (
      error?.code === 'PGRST204' ||
      error?.code === '42703' ||
      errorText.includes('status_changed_at') ||
      errorText.includes('finalized_at') ||
      errorText.includes('activated_at') ||
      errorText.includes('source')
    );
  };

  const persistPlan = async (
    targetStatus?: ElitePlanStatus,
    eventType: 'autosave' | 'manual_save' | 'finalized' = 'manual_save'
  ): Promise<boolean> => {
    if (!studyPlan || !profile?.id) return false;

    const now = new Date().toISOString();
    const { weekStart, weekEnd } = getWeekRange(studyPlan.week_start, studyPlan.week_end);
    const nextStatus = targetStatus || studyPlan.status || 'draft';
    const source = eventType === 'finalized' ? 'confirmed_by_student' : (studyPlan.source || 'template');
    const basePlanPayload = {
      user_id: profile.id,
      week_start: weekStart,
      week_end: weekEnd,
      daily_plan: editablePlan,
      focus_topics: studyPlan.focus_topics || [],
      status: nextStatus,
      updated_at: now
    };
    const planPayload = {
      ...basePlanPayload,
      status_changed_at: now,
      finalized_at: nextStatus === 'finalized' ? now : null,
      source
    };

    try {
      let legacySaved = false;
      if (planStorage === 'legacy') {
        const { error: legacyUpdateError } = await supabase
          .from('study_plans')
          .update({
            plan_json: {
              ...studyPlan,
              status: nextStatus,
              source,
              week_start: weekStart,
              week_end: weekEnd,
              daily_plan: editablePlan,
              focus_topics: studyPlan.focus_topics || []
            }
          })
          .eq('id', studyPlan.id);
        if (legacyUpdateError) throw legacyUpdateError;
        legacySaved = true;
      }

      let elitePlanId = studyPlan.id;
      const existingActive = await getLatestPlanByStatuses<{ id: string }>(profile.id, CURRENT_PLAN_STATUSES);
      let elitePersisted = false;

      const persistToEliteTable = async (payload: typeof basePlanPayload | typeof planPayload) => {
        if (existingActive?.id) {
          const { error: updateError } = await supabase
            .from('elite_study_plans')
            .update(payload)
            .eq('id', existingActive.id);

          if (updateError) return { error: updateError, id: existingActive.id };
          return { error: null, id: existingActive.id };
        }

        const { data: inserted, error: insertError } = await supabase
          .from('elite_study_plans')
          .insert({
            ...payload,
            created_at: now
          })
          .select('id')
          .single();

        return { error: insertError, id: inserted?.id || studyPlan.id };
      };

      let persistedEliteResult = await persistToEliteTable(planPayload);
      if (persistedEliteResult.error && isLegacyElitePlanSchemaError(persistedEliteResult.error)) {
        console.warn('elite_study_plans ainda sem schema completo; tentando persistencia basica', persistedEliteResult.error);
        persistedEliteResult = await persistToEliteTable(basePlanPayload);
      }

      if (persistedEliteResult.error) {
        if (legacySaved && isLegacyElitePlanSchemaError(persistedEliteResult.error)) {
          console.warn('Plano mantido no fallback study_plans por incompatibilidade do schema Elite', persistedEliteResult.error);
        } else {
          throw persistedEliteResult.error;
        }
      } else {
        elitePlanId = persistedEliteResult.id;
        elitePersisted = true;
      }

      const revisionEntry: PlanRevision = {
        id: `${elitePlanId}-${now}-${eventType}`,
        event_type: eventType,
        previous_status: studyPlan.status || null,
        new_status: nextStatus,
        change_summary:
          eventType === 'autosave'
            ? 'Rascunho salvo automaticamente no editor.'
            : eventType === 'finalized'
            ? 'Plano confirmado pelo estudante.'
            : 'Plano ajustado manualmente pelo estudante.',
        created_at: now
      };

      await createPlanRevision({
        planId: elitePlanId,
        userId: profile.id,
        eventType,
        actorRole: 'student',
        previousStatus: revisionEntry.previous_status,
        newStatus: revisionEntry.new_status,
        changeSummary: revisionEntry.change_summary,
        snapshot: {
          daily_plan: editablePlan,
          focus_topics: studyPlan.focus_topics || [],
          source,
          status: nextStatus
        }
      });

      setStudyPlan((prev) => (
        prev
          ? { ...prev, id: elitePlanId, week_start: weekStart, week_end: weekEnd, daily_plan: editablePlan, source, status: nextStatus }
          : null
      ));
      setPlanStorage(elitePersisted ? 'elite' : planStorage);
      setLastSavedSnapshot(JSON.stringify(editablePlan || {}));
      setRevisions((prev) => [revisionEntry, ...prev].slice(0, 6));
      return true;
    } catch (error) {
      console.error('Error persisting study plan:', error);
      return false;
    }
  };

  const handleConfirmPlan = async () => {
    setSaving(true);
    const ok = await persistPlan(studyPlan?.status || 'draft', 'manual_save');
    setSaving(false);

    if (!ok) {
      alert('Erro ao atualizar plano. Tente novamente.');
      return;
    }
    setAutosaveState('saved');
    setEditingMode(false);
  };

  const handleFinalizePlan = async () => {
    if (!profile?.id) return;
    setSaving(true);

    const saved = await persistPlan('finalized', 'finalized');
    if (!saved) {
      setSaving(false);
      alert('Nao foi possivel concluir o plano agora. Tente novamente.');
      return;
    }

    const { error: onboardingError } = await supabase
      .from('elite_onboarding')
      .upsert({
        user_id: profile.id,
        completed: true,
        completed_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (onboardingError) {
      console.warn('Nao foi possivel atualizar elite_onboarding', onboardingError);
    }

    const { error: insightError } = await supabase.from('elite_insights').insert({
      user_id: profile.id,
      insight_type: 'milestone',
      title: 'Plano Elite confirmado',
      description: 'Plano concluido pelo estudante e liberado para acompanhamento administrativo.',
      priority: 'medium',
      actionable: false
    });

    if (insightError) {
      console.warn('Nao foi possivel registrar insight de confirmacao do plano', insightError);
    }

    setSaving(false);
    setAutosaveState('saved');
    setEditingMode(false);
    navigate('/dashboard');
  };

  const handleCancelEdit = () => {
    if (studyPlan) {
      setEditablePlan(studyPlan.daily_plan);
      setLastSavedSnapshot(JSON.stringify(studyPlan.daily_plan || {}));
    }
    setAutosaveState('idle');
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
      mini_simulation: 'Mini Simulado',
      study: 'Estudo',
      planning: 'Planejamento'
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
      mini_simulation: 'bg-pink-100 text-pink-700 border-pink-200',
      study: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      planning: 'bg-indigo-100 text-indigo-700 border-indigo-200'
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
            {editingMode && (
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50"
              >
                Cancelar edição
              </button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-7">
            {WEEK_DAYS.map((dayConfig) => {
              const planKey = resolveDayKey(currentPlan, dayConfig);
              const dayPlan = currentPlan[planKey];
              const isRestDay = !dayPlan?.type || dayPlan?.type === 'rest';

              return (
                <div key={dayConfig.label} className="border border-slate-200 rounded-xl p-4">
                  <div className="text-center mb-3">
                    <div className="font-bold text-slate-900 mb-1">{dayConfig.label}</div>
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
                        onChange={(e) => handleTypeChange(planKey, e.target.value as DailyPlan['type'])}
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
                        onChange={(e) => handleTimeChange(planKey, e.target.value)}
                        placeholder="Horário"
                        className="w-full p-2 text-sm border border-slate-200 rounded-lg focus:border-amber-500 focus:outline-none"
                      />

                      <input
                        type="text"
                        value={dayPlan?.focus || ''}
                        onChange={(e) => handleFocusChange(planKey, e.target.value)}
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
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-bold text-slate-900 mb-3">Período do Plano</h4>
              <div className="text-slate-600">
                <div>Início: {new Date(studyPlan.week_start).toLocaleDateString('pt-BR')}</div>
                <div>Fim: {new Date(studyPlan.week_end).toLocaleDateString('pt-BR')}</div>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-3">Status do Plano</h4>
              <div className="text-slate-600">
                {getPlanStatusLabel(studyPlan.status)}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-3">Origem do Plano</h4>
              <div className="text-slate-600">
                {studyPlan.source === 'ai_generated'
                  ? 'Gerado por IA'
                  : studyPlan.source === 'confirmed_by_student'
                  ? 'Confirmado pelo estudante'
                  : 'Template predefinido'}
              </div>
            </div>
          </div>
          {editingMode && (
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {autosaveState === 'saving' && 'Salvando rascunho automaticamente...'}
              {autosaveState === 'saved' && 'Rascunho salvo automaticamente.'}
              {autosaveState === 'error' && 'Autosave falhou. Use Confirmar Alteracoes para tentar novamente.'}
              {autosaveState === 'idle' && 'As alteracoes serao salvas automaticamente apos uma pequena pausa.'}
            </div>
          )}
        </div>

        {revisions.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg mb-8">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Historico recente do plano</h3>
            <div className="space-y-3">
              {revisions.map((revision) => (
                <div key={revision.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900">
                      {revision.change_summary || revision.event_type}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(revision.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {revision.previous_status && revision.new_status
                      ? `${getPlanStatusLabel(revision.previous_status)} -> ${getPlanStatusLabel(revision.new_status)}`
                      : getPlanStatusLabel(revision.new_status || studyPlan.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="text-center">
          {editingMode ? (
            <div className="space-y-4">
              <button
                onClick={handleConfirmPlan}
                disabled={saving}
                className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-500 to-emerald-500 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-xl disabled:opacity-60"
              >
                <CheckCircle2 className="h-6 w-6" />
                {saving ? 'Salvando...' : 'Confirmar Alteracoes'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={handleFinalizePlan}
                disabled={saving}
                className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-500 to-emerald-500 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-xl disabled:opacity-60"
              >
                <CheckCircle2 className="h-6 w-6" />
                {saving ? 'Concluindo...' : 'Concluir Plano e Fechar'}
              </button>
              
              <button
                onClick={() => setEditingMode(true)}
                disabled={saving}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all"
              >
                <Edit2 className="h-6 w-6" />
                Editar Plano
              </button>

              <button
                onClick={() => navigate('/dashboard')}
                disabled={saving}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl border border-emerald-200 text-emerald-700 font-bold hover:bg-emerald-50 transition-all"
              >
                <Target className="h-6 w-6" />
                Ir para Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
