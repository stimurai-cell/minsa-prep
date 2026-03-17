import { supabase } from './supabase';
import { archiveCurrentPlans, createPlanRevision, CURRENT_PLAN_STATUSES, EXECUTION_PLAN_STATUSES, getLatestPlanByStatuses } from './elitePlans';

export interface WeeklyPerformance {
  weekStart: string;
  weekEnd: string;
  totalStudyTime: number;
  completedDays: number;
  simulationScores: number[];
  topicPerformance: Record<string, { correct: number; total: number }>;
  improvementAreas: string[];
  strongAreas: string[];
}

export interface StudyStrategy {
  id: string;
  userId: string;
  weekStart: string;
  weekEnd: string;
  dailyPlan: Record<string, DailyActivity>;
  focusTopics: string[];
  status: 'draft' | 'finalized' | 'active' | 'completed' | 'archived';
  performance?: WeeklyPerformance;
  source?: string;
}

export interface DailyActivity {
  type: 'study' | 'simulation' | 'planning' | 'review' | 'practice' | 'srs' | 'speed_mode' | 'rest' | 'mini_simulation';
  focus: string;
  estimatedTime: number;
  topics: string[];
  completed?: boolean;
  completedAt?: string;
  timeSpent?: number;
  accuracy?: number;
  time?: string | null;
}

export interface PersonalProfile {
  daily_study_time: 'LOW' | 'MEDIUM' | 'HIGH' | 'INTENSIVE';
  exam_experience: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERIENCED';
  self_declared_weak_area: string;
  preferred_study_period: 'MORNING' | 'AFTERNOON' | 'EVENING';
  preferred_study_hour: string;
}

export class EliteStrategyManager {
static async createWeeklyStrategy(userId: string, assessmentResults: any, personalProfile: PersonalProfile): Promise<StudyStrategy> {
    const weekStart = new Date();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const now = new Date().toISOString();

    // Tentar gerar plano personalizado com base nas informações
    const personalizedPlan = this.generatePersonalizedPlan(assessmentResults, personalProfile);

    await archiveCurrentPlans(userId);

    const { data, error } = await supabase
      .from('elite_study_plans')
      .insert({
        user_id: userId,
        week_start: weekStart.toISOString(),
        week_end: weekEnd.toISOString(),
        daily_plan: personalizedPlan,
        focus_topics: assessmentResults.weakTopics || [],
        status: 'active',
        status_changed_at: now,
        activated_at: now,
        source: 'personalized',
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error) throw error;
    await createPlanRevision({
      planId: data.id,
      userId,
      eventType: 'created',
      actorRole: 'system',
      previousStatus: null,
      newStatus: 'active',
      changeSummary: 'Plano semanal personalizado gerado automaticamente pelo sistema.',
      snapshot: {
        daily_plan: personalizedPlan,
        focus_topics: assessmentResults.weakTopics || [],
        source: 'personalized',
        week_start: weekStart.toISOString(),
        week_end: weekEnd.toISOString()
      }
    });
    return data as StudyStrategy;
  }

  static generatePersonalizedPlan(assessmentResults: any, personalProfile: PersonalProfile): Record<string, DailyActivity> {
    const days = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
    const plan: Record<string, DailyActivity> = {};

    // Basear horários no período preferido
    const baseTime = personalProfile.preferred_study_hour || '21:00';

    days.forEach((day, index) => {
      if (index === 6) {
        // Domingo - Simulado final
        plan[day] = {
          type: 'simulation',
          focus: 'Simulado completo',
          estimatedTime: 120,
          topics: assessmentResults.weakTopics || ['Revisão geral'],
          time: baseTime
        };
      } else if (index === 0) {
        // Segunda - Planejamento
        plan[day] = {
          type: 'planning',
          focus: 'Organização e revisão de estratégia',
          estimatedTime: 30,
          topics: ['Planejamento semanal'],
          time: baseTime
        };
      } else {
        // Dias de semana - Baseado no perfil pessoal
        plan[day] = this.generatePersonalizedDayActivity(
          day,
          index,
          assessmentResults,
          personalProfile,
          baseTime
        );
      }
    });

    return plan;
  }

  static generatePersonalizedDayActivity(
    day: string,
    dayIndex: number,
    assessmentResults: any,
    personalProfile: PersonalProfile,
    baseTime: string
  ): DailyActivity {
    const { daily_study_time, exam_experience, self_declared_weak_area } = personalProfile;

    // Lógica baseada na experiência
    const activityType = this.getActivityByExperience(exam_experience, dayIndex);

    // Lógica baseada no tempo disponível
    const estimatedTime = this.getTimeByIntensity(daily_study_time);

    // Foco principal: área mais fraca ou tópicos da avaliação
    const focusTopic = self_declared_weak_area ||
      assessmentResults.weakTopics?.[dayIndex - 1] ||
      assessmentResults.strongTopics?.[dayIndex - 1] ||
      'Revisão geral';

    // Variar horários levemente para evitar monotonia
    const timeVariation = (dayIndex % 2) * 0.5; // Alternar entre baseTime e baseTime + 30min
    const adjustedTime = this.adjustTimeByPeriod(baseTime, timeVariation, personalProfile.preferred_study_period);

    return {
      type: activityType,
      focus: focusTopic,
      estimatedTime,
      topics: [focusTopic],
      time: adjustedTime
    };
  }

  static getActivityByExperience(experience: string, dayIndex: number): DailyActivity['type'] {
    const experiencePatterns = {
      BEGINNER: ['training', 'training', 'practice', 'training', 'practice'],
      INTERMEDIATE: ['training', 'practice', 'srs', 'practice', 'speed_mode'],
      EXPERIENCED: ['practice', 'srs', 'practice', 'simulation', 'review']
    };

    const patterns = experiencePatterns[experience as keyof typeof experiencePatterns] || experiencePatterns.BEGINNER;
    return patterns[dayIndex % patterns.length] as DailyActivity['type'];
  }

  static getTimeByIntensity(intensity: string): number {
    const intensityMap = {
      LOW: 45,      // Menos de 1h = 45min
      MEDIUM: 90,    // 1-2h = 90min
      HIGH: 150,     // 2-3h = 150min
      INTENSIVE: 210 // Mais de 3h = 210min
    };
    return intensityMap[intensity as keyof typeof intensityMap] || 90;
  }

  static adjustTimeByPeriod(baseTime: string, variation: number, period: string): string {
    const [hours, minutes] = baseTime.split(':').map(Number);
    let adjustedMinutes = minutes + variation;

    // Ajustar para manter dentro do período
    if (period === 'MORNING' && (hours < 6 || hours > 10)) {
      adjustedMinutes = Math.min(adjustedMinutes, 59); // Limitar a manhã
    } else if (period === 'AFTERNOON' && (hours < 13 || hours > 18)) {
      adjustedMinutes = Math.min(adjustedMinutes, 59); // Limitar a tarde
    } else if (period === 'EVENING' && (hours < 19 || hours > 23)) {
      adjustedMinutes = Math.min(adjustedMinutes, 59); // Limitar a noite
    }

    // Ajustar minutos se passar de 59
    if (adjustedMinutes >= 60) {
      return `${String(hours + 1).padStart(2, '0')}:00`;
    }

    return `${String(hours).padStart(2, '0')}:${String(adjustedMinutes).padStart(2, '0')}`;
  }

  static async createWeeklyStrategyBasic(userId: string, assessmentResults: any): Promise<StudyStrategy> {
    const weekStart = new Date();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const now = new Date().toISOString();

    const dailyPlan = this.generateDailyPlan(assessmentResults);
    const focusTopics = assessmentResults.weakTopics || [];

    await archiveCurrentPlans(userId);

    const { data, error } = await supabase
      .from('elite_study_plans')
      .insert({
        user_id: userId,
        week_start: weekStart.toISOString(),
        week_end: weekEnd.toISOString(),
        daily_plan: dailyPlan,
        focus_topics: focusTopics,
        status: 'active',
        status_changed_at: now,
        activated_at: now,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error) throw error;
    await createPlanRevision({
      planId: data.id,
      userId,
      eventType: 'created',
      actorRole: 'system',
      previousStatus: null,
      newStatus: 'active',
      changeSummary: 'Plano semanal padrão gerado automaticamente pelo sistema.',
      snapshot: {
        daily_plan: dailyPlan,
        focus_topics: focusTopics,
        source: 'template',
        week_start: weekStart.toISOString(),
        week_end: weekEnd.toISOString()
      }
    });
    return data as StudyStrategy;
  }

  static generateDailyPlan(assessmentResults: any): Record<string, DailyActivity> {
    const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    const plan: Record<string, DailyActivity> = {};

    days.forEach((day, index) => {
      if (index === 6) {
        // Domingo - Simulado
        plan[day] = {
          type: 'simulation',
          focus: 'Simulado semanal completo',
          estimatedTime: 120,
          topics: ['Revisão geral'],
        };
      } else if (index === 0) {
        // Segunda - Planejamento
        plan[day] = {
          type: 'planning',
          focus: 'Organização e revisão de estratégia',
          estimatedTime: 30,
          topics: ['Planejamento semanal'],
        };
      } else {
        // Dias de semana - Foco nos pontos fracos
        const focusTopic = assessmentResults.weakTopics?.[index - 1] ||
          assessmentResults.strongTopics?.[index - 1] ||
          'Revisão geral';
        plan[day] = {
          type: 'study',
          focus: focusTopic,
          estimatedTime: 90,
          topics: [focusTopic],
        };
      }
    });

    return plan;
  }

  static async updateDailyActivity(
    userId: string,
    day: string,
    activityData: Partial<DailyActivity>
  ): Promise<void> {
    const currentPlan = await getLatestPlanByStatuses<any>(userId, EXECUTION_PLAN_STATUSES);

    if (!currentPlan) return;

    const updatedPlan = {
      ...currentPlan.daily_plan,
      [day]: {
        ...currentPlan.daily_plan[day],
        ...activityData,
        completed: true,
        completedAt: new Date().toISOString()
      }
    };

    await supabase
      .from('elite_study_plans')
      .update({
        status: 'active',
        daily_plan: updatedPlan,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentPlan.id);
  }

  static async completeWeekAndReassess(userId: string): Promise<void> {
    // Buscar plano atual
    const currentPlan = await getLatestPlanByStatuses<any>(userId, EXECUTION_PLAN_STATUSES);

    if (!currentPlan) return;

    // Calcular performance da semana
    const weeklyPerformance = await this.calculateWeeklyPerformance(userId, currentPlan);

    // Atualizar plano como completed
    await supabase
      .from('elite_study_plans')
      .update({
        status: 'completed',
        performance: weeklyPerformance,
        completed_at: new Date().toISOString(),
        status_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', currentPlan.id);

    await createPlanRevision({
      planId: currentPlan.id,
      userId,
      eventType: 'completed',
      actorRole: 'system',
      previousStatus: currentPlan.status,
      newStatus: 'completed',
      changeSummary: 'Plano semanal concluído e enviado para reavaliação automática.',
      snapshot: {
        daily_plan: currentPlan.daily_plan,
        focus_topics: currentPlan.focus_topics,
        source: currentPlan.source,
        performance: weeklyPerformance,
        week_start: currentPlan.week_start,
        week_end: currentPlan.week_end
      }
    });

    // Criar nova avaliação baseada na performance
    await this.createReassessment(userId, weeklyPerformance);

    // Gerar nova estratégia para a próxima semana
    const newAssessmentResults = {
      weakTopics: weeklyPerformance.improvementAreas,
      strongTopics: weeklyPerformance.strongAreas,
      score: Math.round(weeklyPerformance.simulationScores.reduce((a: number, b: number) => a + b, 0) / weeklyPerformance.simulationScores.length),
      totalQuestions: 0,
      correctAnswers: 0,
      recommendations: []
    };

    // Buscar perfil pessoal para nova estratégia
    const { data: personalProfile } = await supabase
      .from('elite_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (personalProfile) {
      await this.createWeeklyStrategy(userId, newAssessmentResults, personalProfile as PersonalProfile);
    } else {
      await this.createWeeklyStrategyBasic(userId, newAssessmentResults);
    }
  }

  static async calculateWeeklyPerformance(userId: string, plan: any): Promise<WeeklyPerformance> {
    const performance: WeeklyPerformance = {
      weekStart: plan.week_start,
      weekEnd: plan.week_end,
      totalStudyTime: 0,
      completedDays: 0,
      simulationScores: [],
      topicPerformance: {},
      improvementAreas: [],
      strongAreas: []
    };

    // Calcular tempo de estudo e dias completos
    Object.entries(plan.daily_plan).forEach(([day, activity]: [string, any]) => {
      if (activity.completed) {
        performance.completedDays++;
        performance.totalStudyTime += activity.timeSpent || activity.estimatedTime || 0;

        if (activity.type === 'simulation' && activity.accuracy) {
          performance.simulationScores.push(activity.accuracy);
        }

        // Agregar performance por tópico
        activity.topics?.forEach((topic: string) => {
          if (!performance.topicPerformance[topic]) {
            performance.topicPerformance[topic] = { correct: 0, total: 0 };
          }
          performance.topicPerformance[topic].total += 10; // estimativa
          performance.topicPerformance[topic].correct += Math.floor((activity.accuracy || 0) / 10);
        });
      }
    });

    // Identificar áreas de melhoria e pontos fortes
    Object.entries(performance.topicPerformance).forEach(([topic, data]) => {
      const accuracy = data.correct / data.total;
      if (accuracy < 0.6) {
        performance.improvementAreas.push(topic);
      } else if (accuracy >= 0.8) {
        performance.strongAreas.push(topic);
      }
    });

    return performance;
  }

  static async createReassessment(userId: string, performance: WeeklyPerformance): Promise<void> {
    await supabase
      .from('elite_reassessments')
      .insert({
        user_id: userId,
        week_start: performance.weekStart,
        week_end: performance.weekEnd,
        total_study_time: performance.totalStudyTime,
        completed_days: performance.completedDays,
        simulation_scores: performance.simulationScores,
        topic_performance: performance.topicPerformance,
        improvement_areas: performance.improvementAreas,
        strong_areas: performance.strongAreas,
        overall_improvement: 0, // Calcular baseado na semana anterior
        created_at: new Date().toISOString()
      });
  }

  static async getLatestAssessment(userId: string): Promise<any> {
    const { data } = await supabase
      .from('elite_assessments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return data;
  }

  static async checkWeekCompletion(userId: string): Promise<boolean> {
    const plan = await getLatestPlanByStatuses<any>(userId, EXECUTION_PLAN_STATUSES);

    if (!plan) return false;

    // Verificar se semana já acabou
    const weekEnd = new Date(plan.week_end);
    const now = new Date();
    if (now < weekEnd) return false;

    // Verificar se todos os dias foram completados
    const dailyPlan = plan.daily_plan as Record<string, DailyActivity>;
    const completedDays = Object.values(dailyPlan).filter(day => day.completed).length;

    return completedDays === Object.keys(dailyPlan).length;
  }

  static async getCurrentWeekStrategy(userId: string): Promise<StudyStrategy | null> {
    return await getLatestPlanByStatuses<StudyStrategy>(userId, CURRENT_PLAN_STATUSES);
  }

  static async getWeeklyStats(userId: string): Promise<any[]> {
    const { data } = await supabase
      .from('elite_study_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(4);

    return data || [];
  }

  static async updateActivityPerformance(
    userId: string,
    day: string,
    accuracy: number,
    timeSpent: number
  ): Promise<void> {
    const currentPlan = await getLatestPlanByStatuses<any>(userId, EXECUTION_PLAN_STATUSES);

    if (!currentPlan) return;

    const updatedPlan = {
      ...currentPlan.daily_plan,
      [day]: {
        ...currentPlan.daily_plan[day],
        accuracy,
        timeSpent,
        completed: true,
        completedAt: new Date().toISOString()
      }
    };

    await supabase
      .from('elite_study_plans')
      .update({
        status: 'active',
        daily_plan: updatedPlan,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentPlan.id);
  }

  static async getFallbackPlan(intensity: string): Promise<Record<string, DailyActivity>> {
    const { data } = await supabase
      .from('elite_plan_templates')
      .select('plan_structure')
      .eq('intensity', intensity)
      .eq('is_active', true)
      .single();

    return data?.plan_structure || this.generateDailyPlan({ weakTopics: [], strongTopics: [] });
  }

  static async saveStudyPlan(userId: string, plan: Record<string, DailyActivity>, source: string): Promise<void> {
    const weekStart = new Date();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const now = new Date().toISOString();

    await archiveCurrentPlans(userId);

    const { data, error } = await supabase
      .from('elite_study_plans')
      .insert({
        user_id: userId,
        week_start: weekStart.toISOString(),
        week_end: weekEnd.toISOString(),
        daily_plan: plan,
        focus_topics: [],
        status: 'active',
        status_changed_at: now,
        activated_at: now,
        source,
        created_at: now,
        updated_at: now
      })
      .select('id')
      .single();

    if (error) throw error;

    await createPlanRevision({
      planId: data.id,
      userId,
      eventType: 'created',
      actorRole: 'system',
      previousStatus: null,
      newStatus: 'active',
      changeSummary: 'Plano salvo diretamente pelo motor de estratégia Elite.',
      snapshot: {
        daily_plan: plan,
        focus_topics: [],
        source,
        week_start: weekStart.toISOString(),
        week_end: weekEnd.toISOString()
      }
    });
  }
}
