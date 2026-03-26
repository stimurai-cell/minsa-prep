export type PlanPeriod = 'monthly';

export type PremiumPlan = {
  id: string;
  name: string;
  badge: string;
  headline: string;
  description: string;
  features: string[];
  highlight?: boolean;
  role: 'free' | 'premium' | 'elite';
  prices: {
    monthly: { amount: number; label: string };
  };
};

export const premiumPlans: PremiumPlan[] = [
  {
    id: 'free',
    name: 'Plano Gratuito',
    badge: 'Entrada',
    headline: 'Para entrar no ritmo do estudo.',
    description: 'Conheca o app e comece a estudar a sua area com leveza e consistencia.',
    role: 'free',
    features: [
      'Treino base na sua area',
      '30 questoes por dia',
      '1 simulacao de prova por semana',
      'Ranking de entrada',
    ],
    prices: {
      monthly: { amount: 0, label: '0 Kz' },
    },
  },
  {
    id: 'premium',
    name: 'Premium (Preparacao Real)',
    badge: 'Mais vendido',
    headline: 'O plano principal para estudar com consistencia.',
    description: 'Libera volume, revisao e leitura de desempenho para uma preparacao mais forte.',
    role: 'premium',
    highlight: true,
    features: [
      'Simulacoes de prova ilimitadas',
      'Treino sem limites em todos os niveis, inclui Dificil',
      'Treino e Modo Relampago offline incluidos',
      'Ranking completo',
      'Historico de provas',
      'Revisao inteligente',
      'Modo Dificil desbloqueado',
      'Banco completo de questoes das areas ativas',
      'Mentor IA com leitura de desempenho',
    ],
    prices: {
      monthly: { amount: 8000, label: '8.000 Kz (mensal)' },
    },
  },
  {
    id: 'elite',
    name: 'Elite (Aprovacao)',
    badge: 'Maximo Foco',
    headline: 'Para quem quer execucao e estrategia juntas.',
    description: 'Organiza o estudo com plano semanal, foco guiado e leitura profunda da evolucao.',
    role: 'elite',
    features: [
      'Tudo do Premium +',
      'Treino guiado automatico',
      'Plano semanal personalizado',
      'Radar de fraquezas',
      'Exportacoes em PDF e DOCX',
      'Modo Batalha XP',
      'Simulacao Nacional',
    ],
    prices: {
      monthly: { amount: 15000, label: '15.000 Kz (vitalicio)' },
    },
  },
];

export type ExtraPackage = {
  id: string;
  name: string;
  description: string;
  priceAmount: number;
  priceLabel: string;
  features: string[];
};

export const extraPackages: ExtraPackage[] = [
  {
    id: 'intensivo_farmacia',
    name: 'Pacote Intensivo Farmacia',
    description: 'Reforce o seu estudo focado apenas em Farmacia.',
    priceAmount: 3000,
    priceLabel: '3.000 Kz',
    features: ['500 questoes extras de farmacologia', 'Simulacoes especificas de alto nivel'],
  },
  {
    id: 'intensivo_enfermagem',
    name: 'Pacote Intensivo Enfermagem',
    description: 'Reforce o seu estudo focado apenas em Enfermagem.',
    priceAmount: 3000,
    priceLabel: '3.000 Kz',
    features: ['500 questoes extras de saude publica e anatomia', 'Simulacoes especificas de alto nivel'],
  },
  {
    id: 'simulacao_oficial_extra',
    name: 'Simulacao Oficial Extra',
    description: 'Desbloqueie uma prova especial oficial exclusiva.',
    priceAmount: 1000,
    priceLabel: '1.000 Kz',
    features: ['Acesso a uma simulacao restrita com ranking oficial'],
  },
  {
    id: 'pacote_concurso',
    name: 'Modulo Concurso Publico',
    description: 'Reforco extra para a fase do Concurso Publico da Saude.',
    priceAmount: 5000,
    priceLabel: '5.000 Kz',
    features: ['Simulados focados nas areas do concurso', 'Cronometro e ambiente de prova real', 'Reforco de foco para a reta final'],
  },
];
