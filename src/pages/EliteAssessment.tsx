import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Brain, Clock, Target, AlertCircle, ChevronRight, Calendar, User, BookOpen } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';

interface Question {
  id: string;
  text: string;
  topic: string;
  alternatives: Array<{
    text: string;
    isCorrect: boolean;
  }>;
}

interface PersonalAnswers {
  daily_study_time: 'LOW' | 'MEDIUM' | 'HIGH' | 'INTENSIVE';
  exam_experience: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERIENCED';
  self_declared_weak_area: string;
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

export default function EliteAssessment() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<AssessmentResult | null>(null);
  const [startTime] = useState(Date.now());

  // Estados para perguntas pessoais
  const [showPersonalQuestions, setShowPersonalQuestions] = useState(true);
  const [personalAnswers, setPersonalAnswers] = useState<PersonalAnswers>({
    daily_study_time: 'MEDIUM',
    exam_experience: 'BEGINNER',
    self_declared_weak_area: '',
    preferred_study_period: 'EVENING',
    preferred_study_hour: '21:00'
  });
  const [areas, setAreas] = useState<any[]>([]);

  useEffect(() => {
    loadAreasAndQuestions();
  }, []);

  const loadAreasAndQuestions = async () => {
    if (!profile?.selected_area_id) return;

    try {
      // Carregar áreas para a pergunta de área mais difícil
      const { data: allAreas } = await supabase
        .from('areas')
        .select('*')
        .order('name');

      if (allAreas) {
        setAreas(allAreas);
      }

      // Buscar tópicos que começam com número
      const { data: topics } = await supabase
        .from('topics')
        .select('*')
        .eq('area_id', profile.selected_area_id)
        .or('name.ilike.1.%,name.ilike.1-%,name.ilike.2.%,name.ilike.2-%,name.ilike.3.%,name.ilike.3-%')
        .limit(10);

      if (!topics || topics.length === 0) {
        const { data: fallbackTopics } = await supabase
          .from('topics')
          .select('*')
          .eq('area_id', profile.selected_area_id)
          .limit(10);

        if (fallbackTopics) {
          generateQuestionsFromTopics(fallbackTopics);
        }
      } else {
        generateQuestionsFromTopics(topics);
      }
    } catch (error) {
      console.error('Error loading assessment questions:', error);
      setLoading(false);
    }
  };

  const generateQuestionsFromTopics = async (topics: any[]) => {
    const assessmentQuestions: Question[] = [];

    for (const topic of topics.slice(0, 8)) {
      try {
        const response = await fetch('/api/generate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            area: profile?.selected_area_id,
            topic: topic.name,
            count: 1,
            difficulty: 'medium',
            alternativesCount: 4
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.questions?.[0]) {
            assessmentQuestions.push({
              id: crypto.randomUUID(),
              text: data.questions[0].question,
              topic: topic.name,
              alternatives: data.questions[0].alternatives
            });
          }
        }
      } catch (error) {
        console.error('Error generating question for topic:', topic.name);
      }
    }

    setQuestions(assessmentQuestions);
    setLoading(false);
  };

  const handlePersonalAnswer = (field: keyof PersonalAnswers, value: string) => {
    setPersonalAnswers(prev => ({
      ...prev,
      [field]: value
    }));
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

  const handleStartKnowledgeAssessment = async () => {
    if (!personalAnswers.self_declared_weak_area) {
      alert('Por favor, selecione a área que considera mais difícil.');
      return;
    }

    // Salvar respostas pessoais
    try {
      await supabase
        .from('elite_profiles')
        .upsert({
          user_id: profile?.id,
          daily_study_time: personalAnswers.daily_study_time,
          exam_experience: personalAnswers.exam_experience,
          self_declared_weak_area: personalAnswers.self_declared_weak_area,
          preferred_study_period: personalAnswers.preferred_study_period,
          preferred_study_hour: personalAnswers.preferred_study_hour
        });

      setShowPersonalQuestions(false);
    } catch (error) {
      console.error('Error saving personal answers:', error);
      alert('Erro ao salvar suas informações. Tente novamente.');
    }
  };

  const handleAnswer = (questionId: string, alternativeIndex: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: alternativeIndex
    }));
  };

  const handleSubmitAssessment = async () => {
    if (Object.keys(answers).length < questions.length) {
      alert('Por favor, responda todas as questões antes de continuar.');
      return;
    }

    setSubmitting(true);
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    try {
      // Calcular resultados
      let correctCount = 0;
      const topicPerformance: Record<string, { correct: number; total: number }> = {};

      questions.forEach((question, index) => {
        const userAnswer = answers[question.id];
        const correctAlternative = question.alternatives.findIndex(alt => alt.isCorrect);
        const isCorrect = parseInt(userAnswer) === correctAlternative;

        if (isCorrect) correctCount++;

        const topic = question.topic;
        if (!topicPerformance[topic]) {
          topicPerformance[topic] = { correct: 0, total: 0 };
        }
        topicPerformance[topic].total++;
        if (isCorrect) {
          topicPerformance[topic].correct++;
        }
      });

      // Identificar tópicos fracos e fortes
      const weakTopics: string[] = [];
      const strongTopics: string[] = [];

      Object.entries(topicPerformance).forEach(([topic, performance]) => {
        const accuracy = performance.correct / performance.total;
        if (accuracy < 0.5) {
          weakTopics.push(topic);
        } else if (accuracy >= 0.8) {
          strongTopics.push(topic);
        }
      });

      const assessmentResults: AssessmentResult = {
        totalQuestions: questions.length,
        correctAnswers: correctCount,
        score: Math.round((correctCount / questions.length) * 100),
        weakTopics,
        strongTopics,
        recommendations: generateRecommendations(weakTopics, strongTopics)
      };

      // Salvar resultados no banco
      await supabase
        .from('elite_assessments')
        .insert({
          user_id: profile?.id,
          assessment_type: 'initial',
          total_questions: questions.length,
          correct_answers: correctCount,
          score: assessmentResults.score,
          duration_seconds: duration,
          weak_topics: weakTopics,
          strong_topics: strongTopics,
          recommendations: assessmentResults.recommendations,
          created_at: new Date().toISOString()
        });

      // Gerar plano estratégico personalizado
      await generatePersonalizedStrategy(assessmentResults, personalAnswers);

      setResults(assessmentResults);
      setShowResults(true);
    } catch (error) {
      console.error('Error submitting assessment:', error);
      alert('Erro ao enviar avaliação. Tente novamente.');
    } finally {
      setSubmitting(false);
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

    // Recomendações baseadas no tempo de estudo
    switch (personalAnswers.daily_study_time) {
      case 'LOW':
        recommendations.push('Otimize seu tempo limitado focando nos tópicos mais importantes');
        break;
      case 'HIGH':
      case 'INTENSIVE':
        recommendations.push('Aproveite seu tempo disponível para revisão profunda e prática intensiva');
        break;
    }

    // Recomendações baseadas na experiência
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

  const generatePersonalizedStrategy = async (assessmentResults: AssessmentResult, personalData: PersonalAnswers) => {
    try {
      // Tentar gerar plano com IA
      const aiPlan = await generateAIPlan(assessmentResults, personalData);
      
      if (aiPlan) {
        // Salvar plano gerado por IA
        await saveStudyPlan(aiPlan, 'ai_generated');
      } else {
        // Usar plano predefinido como fallback
        const fallbackPlan = getFallbackPlan(personalData.daily_study_time);
        await saveStudyPlan(fallbackPlan, 'template');
      }
    } catch (error) {
      console.error('Error generating personalized strategy:', error);
      // Fallback para plano predefinido
      const fallbackPlan = getFallbackPlan(personalData.daily_study_time);
      await saveStudyPlan(fallbackPlan, 'template');
    }
  };

  const generateAIPlan = async (assessmentResults: AssessmentResult, personalData: PersonalAnswers) => {
    // Implementar lógica de IA aqui
    // Por enquanto, retorna null para usar fallback
    return null;
  };

  const getFallbackPlan = (intensity: string) => {
    // Retornar plano predefinido baseado na intensidade
    const templates = {
      'LOW': {
        monday: { type: 'training', time: '20:00', focus: 'Revisão básica' },
        tuesday: { type: 'rest', time: null, focus: null },
        wednesday: { type: 'practice', time: '20:00', focus: 'Exercícios leves' },
        thursday: { type: 'rest', time: null, focus: null },
        friday: { type: 'srs', time: '20:00', focus: 'Revisão SRS' },
        saturday: { type: 'rest', time: null, focus: null },
        sunday: { type: 'mini_simulation', time: '20:00', focus: 'Mini simulado' }
      },
      'MEDIUM': {
        monday: { type: 'training', time: '20:00', focus: 'Estudo focado' },
        tuesday: { type: 'training', time: '21:00', focus: 'Prática intensiva' },
        wednesday: { type: 'practice', time: '20:00', focus: 'Exercícios variados' },
        thursday: { type: 'srs', time: '21:00', focus: 'Revisão SRS' },
        friday: { type: 'practice', time: '20:00', focus: 'Speed mode' },
        saturday: { type: 'review', time: '16:00', focus: 'Revisão semanal' },
        sunday: { type: 'simulation', time: '20:00', focus: 'Simulado completo' }
      },
      'HIGH': {
        monday: { type: 'training', time: '20:00', focus: 'Estudo intensivo' },
        tuesday: { type: 'practice', time: '21:00', focus: 'Prática avançada' },
        wednesday: { type: 'srs', time: '20:00', focus: 'Revisão SRS' },
        thursday: { type: 'practice', time: '21:00', focus: 'Speed mode' },
        friday: { type: 'training', time: '20:00', focus: 'Estudo focado' },
        saturday: { type: 'review', time: '16:00', focus: 'Revisão completa' },
        sunday: { type: 'simulation', time: '20:00', focus: 'Simulado completo' }
      },
      'INTENSIVE': {
        monday: { type: 'training', time: '20:00', focus: 'Estudo super intensivo' },
        tuesday: { type: 'practice', time: '21:00', focus: 'Prática expert' },
        wednesday: { type: 'srs', time: '20:00', focus: 'Revisão SRS' },
        thursday: { type: 'practice', time: '21:00', focus: 'Speed mode avançado' },
        friday: { type: 'training', time: '20:00', focus: 'Estudo focado' },
        saturday: { type: 'review', time: '14:00', focus: 'Revisão detalhada' },
        sunday: { type: 'simulation', time: '20:00', focus: 'Simulado completo' }
      }
    };

    return templates[intensity as keyof typeof templates] || templates['MEDIUM'];
  };

  const saveStudyPlan = async (plan: any, source: string) => {
    const weekStart = new Date();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    await supabase
      .from('elite_study_plans')
      .insert({
        user_id: profile?.id,
        week_start: weekStart.toISOString(),
        week_end: weekEnd.toISOString(),
        daily_plan: plan,
        focus_topics: results?.weakTopics || [],
        status: 'active',
        source: source,
        created_at: new Date().toISOString()
      });
  };

  const handleContinueToPlan = () => {
    navigate('/elite-plan-preview');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-amber-200 border-t-amber-600"></div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2 mt-4">Preparando sua avaliação</h2>
          <p className="text-slate-600">Analisando os melhores tópicos para você...</p>
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

            {/* Experiência com concursos */}
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

            {/* Área mais difícil */}
            <div>
              <label className="block text-lg font-bold text-slate-900 mb-4">
                Qual área você considera mais difícil?
              </label>
              <select
                value={personalAnswers.self_declared_weak_area}
                onChange={(e) => handlePersonalAnswer('self_declared_weak_area', e.target.value)}
                className="w-full p-4 rounded-xl border-2 border-slate-200 text-slate-900 focus:border-amber-500 focus:outline-none"
              >
                <option value="">Selecione uma área...</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.name}>
                    {area.name}
                  </option>
                ))}
              </select>
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
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div className="font-semibold">{time}</div>
                  </button>
                ))}
              </div>
              {personalAnswers.preferred_study_period === 'EVENING' && (
                <p className="text-sm text-amber-600 mt-2">
                  💡 Horários noturnos são recomendados para estudantes que trabalham durante o dia
                </p>
              )}
            </div>

            <button
              onClick={handleStartKnowledgeAssessment}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-emerald-500 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all"
            >
              Continuar para Avaliação de Conhecimento
            </button>
          </div>
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
              <span className="text-green-900 font-bold text-lg">Avaliação Concluída!</span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 mb-4">Parabéns!</h1>
            <p className="text-xl text-slate-600">
              Sua estratégia personalizada foi criada com base no seu perfil e desempenho
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl border border-green-200 p-6 shadow-lg">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                Seu Desempenho
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Pontuação:</span>
                  <span className="text-2xl font-bold text-green-600">{results.score}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Acertos:</span>
                  <span className="font-semibold">{results.correctAnswers}/{results.totalQuestions}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-amber-200 p-6 shadow-lg">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Brain className="h-5 w-5 text-amber-600" />
                Seu Perfil
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Tempo de estudo:</span>
                  <span className="font-semibold">
                    {personalAnswers.daily_study_time === 'LOW' ? 'Menos de 1h' :
                     personalAnswers.daily_study_time === 'MEDIUM' ? '1-2h' :
                     personalAnswers.daily_study_time === 'HIGH' ? '2-3h' : 'Mais de 3h'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Experiência:</span>
                  <span className="font-semibold">
                    {personalAnswers.exam_experience === 'BEGINNER' ? 'Iniciante' :
                     personalAnswers.exam_experience === 'INTERMEDIATE' ? 'Intermediário' : 'Experiente'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Horário preferido:</span>
                  <span className="font-semibold">{personalAnswers.preferred_study_hour}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-amber-600 to-emerald-600 rounded-3xl p-8 text-white mb-8">
            <h2 className="text-2xl font-bold mb-6">Sua Estratégia Personalizada</h2>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <h3 className="font-bold mb-2">Recomendações:</h3>
              <ul className="space-y-1 text-sm">
                {results.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-emerald-50 py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-slate-900">Avaliação de Conhecimento</h1>
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="h-5 w-5" />
              <span>{currentQuestion + 1}/{questions.length}</span>
            </div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-amber-500 to-emerald-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        {questions[currentQuestion] && (
          <div className="bg-white rounded-2xl border border-amber-200 p-8 shadow-lg mb-6">
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 bg-amber-100 rounded-full px-3 py-1 text-sm font-semibold text-amber-900 mb-4">
                <BookOpen className="h-4 w-4" />
                {questions[currentQuestion].topic}
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-6">
                {questions[currentQuestion].text}
              </h2>
            </div>

            <div className="space-y-3">
              {questions[currentQuestion].alternatives.map((alternative, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswer(questions[currentQuestion].id, index.toString())}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    answers[questions[currentQuestion].id] === index.toString()
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      answers[questions[currentQuestion].id] === index.toString()
                        ? 'border-amber-500 bg-amber-500'
                        : 'border-slate-300'
                    }`}>
                      {answers[questions[currentQuestion].id] === index.toString() && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    <span className="font-medium text-slate-900">
                      {String.fromCharCode(65 + index)}. {alternative.text}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
            disabled={currentQuestion === 0}
            className="px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>

          {currentQuestion === questions.length - 1 ? (
            <button
              onClick={handleSubmitAssessment}
              disabled={submitting || Object.keys(answers).length < questions.length}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 text-white font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Enviando...' : 'Finalizar Avaliação'}
            </button>
          ) : (
            <button
              onClick={() => setCurrentQuestion(Math.min(questions.length - 1, currentQuestion + 1))}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 text-white font-semibold hover:opacity-90"
            >
              Próxima
            </button>
          )}
        </div>

        {Object.keys(answers).length < questions.length && (
          <div className="mt-4 text-center">
            <p className="text-sm text-amber-600 flex items-center justify-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Responda todas as questões para finalizar a avaliação
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
