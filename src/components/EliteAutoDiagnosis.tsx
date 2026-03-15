import { useState, useEffect } from 'react';
import { Brain, TrendingUp, AlertTriangle, CheckCircle2, Target, BarChart3 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';

interface TopicPerformance {
  topic: string;
  accuracy: number;
  totalQuestions: number;
  correctAnswers: number;
  trend: 'improving' | 'declining' | 'stable';
  recommendation: string;
}

interface DiagnosisData {
  overallAccuracy: number;
  totalQuestions: number;
  strongTopics: TopicPerformance[];
  weakTopics: TopicPerformance[];
  recommendations: string[];
  nextFocusAreas: string[];
}

export default function EliteAutoDiagnosis() {
  const { profile } = useAuthStore();
  const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      loadDiagnosis();
    }
  }, [profile]);

  const loadDiagnosis = async () => {
    if (!profile?.id || !profile?.selected_area_id) return;

    try {
      setLoading(true);

      // Buscar dados de desempenho por tópico
      const { data: topicProgress } = await supabase
        .from('user_topic_progress')
        .select('questions_answered, correct_answers, domain_score, topics!inner(name)')
        .eq('user_id', profile.id)
        .eq('topics.area_id', profile.selected_area_id);

      // Buscar histórico recente para identificar tendências
      const { data: recentSessions } = await supabase
        .from('quiz_sessions')
        .select('created_at, score, topic')
        .eq('user_id', profile.id)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (!topicProgress) return;

      // Processar dados de diagnóstico
      const diagnosisData = processDiagnosisData(topicProgress, recentSessions || []);
      setDiagnosis(diagnosisData);
    } catch (error) {
      console.error('Error loading diagnosis:', error);
    } finally {
      setLoading(false);
    }
  };

  const processDiagnosisData = (topicProgress: any[], recentSessions: any[]): DiagnosisData => {
    const topics: TopicPerformance[] = topicProgress.map(progress => {
      const accuracy = progress.domain_score || 0;
      const trend = calculateTrend(progress.topics.name, recentSessions);
      
      return {
        topic: progress.topics.name,
        accuracy,
        totalQuestions: progress.questions_answered || 0,
        correctAnswers: progress.correct_answers || 0,
        trend,
        recommendation: generateRecommendation(accuracy, trend)
      };
    });

    // Ordenar por performance
    const sortedTopics = topics.sort((a, b) => b.accuracy - a.accuracy);
    
    const strongTopics = sortedTopics.filter(t => t.accuracy >= 75);
    const weakTopics = sortedTopics.filter(t => t.accuracy < 60);

    const overallAccuracy = topics.reduce((acc, t) => acc + t.accuracy, 0) / topics.length;
    const totalQuestions = topics.reduce((acc, t) => acc + t.totalQuestions, 0);

    const recommendations = generateOverallRecommendations(strongTopics, weakTopics, overallAccuracy);
    const nextFocusAreas = weakTopics.slice(0, 3).map(t => t.topic);

    return {
      overallAccuracy,
      totalQuestions,
      strongTopics,
      weakTopics,
      recommendations,
      nextFocusAreas
    };
  };

  const calculateTrend = (topic: string, sessions: any[]): 'improving' | 'declining' | 'stable' => {
    const topicSessions = sessions.filter(s => s.topic === topic);
    if (topicSessions.length < 2) return 'stable';

    const recent = topicSessions.slice(0, Math.floor(topicSessions.length / 2));
    const older = topicSessions.slice(Math.floor(topicSessions.length / 2));

    const recentAvg = recent.reduce((acc, s) => acc + (s.score || 0), 0) / recent.length;
    const olderAvg = older.reduce((acc, s) => acc + (s.score || 0), 0) / older.length;

    if (recentAvg > olderAvg + 5) return 'improving';
    if (recentAvg < olderAvg - 5) return 'declining';
    return 'stable';
  };

  const generateRecommendation = (accuracy: number, trend: string): string => {
    if (accuracy >= 80 && trend === 'improving') {
      return 'Excelente! Mantenha o ritmo e revise periodicamente.';
    }
    if (accuracy >= 75) {
      return 'Bom desempenho. Foque em consolidar este conhecimento.';
    }
    if (accuracy >= 60 && trend === 'improving') {
      return 'Melhorando! Continue focado neste tópico.';
    }
    if (accuracy >= 60) {
      return 'Precisa de atenção. Revise os conceitos fundamentais.';
    }
    if (trend === 'declining') {
      return 'Atenção! Desempenho caindo, volte ao básico.';
    }
    return 'Prioridade máxima. Foque intensamente neste tópico.';
  };

  const generateOverallRecommendations = (
    strongTopics: TopicPerformance[], 
    weakTopics: TopicPerformance[], 
    overallAccuracy: number
  ): string[] => {
    const recommendations: string[] = [];

    if (overallAccuracy >= 75) {
      recommendations.push('Ótimo desempenho geral! Foque em manter a consistência.');
    } else if (overallAccuracy >= 60) {
      recommendations.push('Bom progresso. Dedique 70% do tempo aos pontos fracos.');
    } else {
      recommendations.push('Precisa de foco intensivo. Priorize os tópicos críticos.');
    }

    if (weakTopics.length > 3) {
      recommendations.push('Muitos pontos fracos. Foque em 2-3 tópicos por semana.');
    }

    const decliningTopics = weakTopics.filter(t => t.trend === 'declining');
    if (decliningTopics.length > 0) {
      recommendations.push('Alguns tópicos estão piorando. Revise-os urgentemente.');
    }

    const improvingTopics = strongTopics.filter(t => t.trend === 'improving');
    if (improvingTopics.length > 0) {
      recommendations.push('Continue com a estratégia nos tópicos que estão melhorando.');
    }

    return recommendations;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <BarChart3 className="h-4 w-4 text-slate-600" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-600 bg-green-50 border-green-200';
      case 'declining': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="h-6 w-6 text-amber-600 animate-pulse" />
          <h3 className="text-lg font-bold text-slate-900">Diagnóstico Inteligente</h3>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-slate-100 rounded animate-pulse"></div>
          <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4"></div>
          <div className="h-4 bg-slate-100 rounded animate-pulse w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!diagnosis) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="h-6 w-6 text-amber-600" />
          <h3 className="text-lg font-bold text-slate-900">Diagnóstico Inteligente</h3>
        </div>
        <p className="text-slate-600">
          Comece a treinar para ver seu diagnóstico personalizado.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-amber-600" />
          <h3 className="text-lg font-bold text-slate-900">Diagnóstico Inteligente</h3>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-900">{Math.round(diagnosis.overallAccuracy)}%</div>
          <div className="text-xs text-slate-600">Acurácia geral</div>
        </div>
      </div>

      {/* Strong Topics */}
      {diagnosis.strongTopics.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h4 className="font-semibold text-slate-900">Pontos Fortes</h4>
          </div>
          <div className="space-y-2">
            {diagnosis.strongTopics.slice(0, 3).map((topic, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium text-slate-900">{topic.topic}</div>
                  {getTrendIcon(topic.trend)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-green-600">{Math.round(topic.accuracy)}%</span>
                  <span className="text-xs text-slate-600">({topic.totalQuestions} q)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weak Topics */}
      {diagnosis.weakTopics.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h4 className="font-semibold text-slate-900">Precisa Melhorar</h4>
          </div>
          <div className="space-y-2">
            {diagnosis.weakTopics.slice(0, 3).map((topic, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium text-slate-900">{topic.topic}</div>
                  {getTrendIcon(topic.trend)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-red-600">{Math.round(topic.accuracy)}%</span>
                  <span className="text-xs text-slate-600">({topic.totalQuestions} q)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-5 w-5 text-amber-600" />
          <h4 className="font-semibold text-slate-900">Recomendações</h4>
        </div>
        <div className="space-y-2">
          {diagnosis.recommendations.slice(0, 3).map((rec, index) => (
            <div key={index} className="p-3 bg-amber-50 rounded-xl">
              <p className="text-sm text-slate-700">{rec}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Next Focus Areas */}
      {diagnosis.nextFocusAreas.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-5 w-5 text-purple-600" />
            <h4 className="font-semibold text-slate-900">Foco Principal</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {diagnosis.nextFocusAreas.map((area, index) => (
              <span key={index} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">
                {area}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-slate-900">{diagnosis.totalQuestions}</div>
            <div className="text-xs text-slate-600">Questões respondidas</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600">{diagnosis.strongTopics.length}</div>
            <div className="text-xs text-slate-600">Tópicos dominados</div>
          </div>
          <div>
            <div className="text-lg font-bold text-red-600">{diagnosis.weakTopics.length}</div>
            <div className="text-xs text-slate-600">Tópicos a melhorar</div>
          </div>
        </div>
      </div>
    </div>
  );
}
