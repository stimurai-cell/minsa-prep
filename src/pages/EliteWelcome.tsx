import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Crown, Rocket, Star, TrendingUp, Calendar, Target, Brain } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';

export default function EliteWelcome() {
  const { profile, setProfile } = useAuthStore();
  const navigate = useNavigate();
  const [showBenefits, setShowBenefits] = useState(true);
  const [showAssessment, setShowAssessment] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Verificar se usuário já completou o onboarding
    const checkOnboardingStatus = async () => {
      if (!profile?.id) return;
      
      const { data } = await supabase
        .from('elite_onboarding')
        .select('completed')
        .eq('user_id', profile.id)
        .single();
      
      if (data?.completed) {
        navigate('/dashboard');
      }
    };
    
    checkOnboardingStatus();
  }, [profile, navigate]);

  const eliteBenefits = [
    {
      icon: <Brain className="h-6 w-6" />,
      title: "Estratégia Personalizada",
      description: "Plano de estudos adaptado ao seu perfil e desempenho"
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: "Avaliação Inteligente",
      description: "Diagnóstico contínuo das suas fraquezas e pontos fortes"
    },
    {
      icon: <Calendar className="h-6 w-6" />,
      title: "Ciclos Semanais",
      description: "Estrutura organizada com metas semanais e simulados finais"
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Progresso Acelerado",
      description: "Estudo focado no que realmente importa para sua aprovação"
    }
  ];

  const studySchedule = [
    { day: "Segunda", focus: "Diagnóstico e Planejamento", activity: "Avaliação inicial" },
    { day: "Terça", focus: "Pontos Fracos", activity: "Revisão direcionada" },
    { day: "Quarta", focus: "Consolidação", activity: "Exercícios práticos" },
    { day: "Quinta", focus: "Avanço", activity: "Novos conteúdos" },
    { day: "Sexta", focus: "Integração", activity: "Estudo misto" },
    { day: "Sábado", focus: "Revisão", activity: "Consolidação semanal" },
    { day: "Domingo", focus: "Simulado", activity: "Prova completa" }
  ];

  const handleStartAssessment = async () => {
    setShowBenefits(false);
    setShowAssessment(true);
  };

  const handleCompleteOnboarding = async () => {
    if (!profile?.id) return;
    
    setLoading(true);
    try {
      await supabase
        .from('elite_onboarding')
        .upsert({
          user_id: profile.id,
          completed: true,
          completed_at: new Date().toISOString()
        });
      
      navigate('/elite-assessment');
    } catch (error) {
      console.error('Error completing onboarding:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50">
      {showBenefits && (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-3 bg-amber-100 rounded-full px-6 py-3 mb-6">
              <Crown className="h-8 w-8 text-amber-600" />
              <span className="text-amber-900 font-bold text-lg">Bem-vindo ao Elite!</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">
              Sua Jornada para Aprovação Começa Aqui
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Parabéns por alcançar o nível Elite! Agora você terá acesso a uma metodologia 
              de estudo inteligente que vai acelerar sua preparação para o concurso MINSA.
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {eliteBenefits.map((benefit, index) => (
              <div key={index} className="bg-white rounded-2xl border border-amber-200 p-6 shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="bg-amber-100 rounded-xl p-3 text-amber-600">
                    {benefit.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{benefit.title}</h3>
                    <p className="text-slate-600">{benefit.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Study Schedule */}
          <div className="bg-gradient-to-r from-amber-600 to-emerald-600 rounded-3xl p-8 text-white mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Calendar className="h-7 w-7" />
              Seu Cronograma Semanal
            </h2>
            <div className="grid md:grid-cols-7 gap-4">
              {studySchedule.map((day, index) => (
                <div key={index} className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
                  <div className="font-bold text-sm mb-2">{day.day}</div>
                  <div className="text-xs font-semibold mb-1">{day.focus}</div>
                  <div className="text-xs opacity-90">{day.activity}</div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <button
              onClick={handleStartAssessment}
              className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-500 to-emerald-500 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-xl"
            >
              <Rocket className="h-6 w-6" />
              Começar Avaliação Personalizada
            </button>
            <p className="text-slate-500 mt-4">
              Vamos criar sua estratégia de estudo personalizada em poucos minutos
            </p>
          </div>
        </div>
      )}

      {showAssessment && (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <div className="text-center mb-8">
            <Brain className="h-16 w-16 text-amber-600 mx-auto mb-4" />
            <h1 className="text-3xl font-black text-slate-900 mb-4">
              Avaliação Personalizada
            </h1>
            <p className="text-lg text-slate-600">
              Responda algumas questões para criarmos sua estratégia de estudo ideal
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-amber-200 p-8 shadow-lg">
            <div className="space-y-6">
              <div className="bg-amber-50 rounded-xl p-6">
                <h3 className="font-bold text-slate-900 mb-3">Como funciona:</h3>
                <ul className="space-y-2 text-slate-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <span>Questões baseadas nos tópicos principais do concurso</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <span>Análise automática dos seus pontos fortes e fracos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <span>Criação de plano semanal personalizado</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <span>Ajuste automático baseado no seu desempenho</span>
                  </li>
                </ul>
              </div>

              <div className="text-center">
                <button
                  onClick={handleCompleteOnboarding}
                  disabled={loading}
                  className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-500 to-emerald-500 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-xl disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Preparando avaliação...
                    </>
                  ) : (
                    <>
                      <Star className="h-6 w-6" />
                      Iniciar Avaliação Agora
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
