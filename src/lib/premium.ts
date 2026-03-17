export type PlanPeriod = 'monthly';

export type PremiumPlan = {
  id: string;
  name: string;
  badge: string;
  headline: string;
  description: string;
  features: string[];
  highlight?: boolean;
  role: 'free' | 'basic' | 'premium' | 'elite';
  prices: {
    monthly: { amount: number; label: string };
  };
};

export const premiumPlans: PremiumPlan[] = [
  {
    id: 'free',
    name: 'Plano Gratuito',
    badge: 'Entrada',
    headline: 'Para conhecer a plataforma.',
    description: 'Comece a treinar e veja como a nossa plataforma pode guiar o seu estudo.',
    role: 'free',
    features: [
      'Treino livre (Facil, Medio, Misto)',
      '30 questoes por dia',
      '1 simulacao de prova por semana',
      'Ranking basico',
    ],
    prices: {
      monthly: { amount: 0, label: '0 Kz' },
    },
  },
  {
    id: 'premium',
    name: 'Premium (Preparacao Real)',
    badge: 'Mais vendido',
    headline: 'O padrao ideal para candidatos serios.',
    description: 'Acesso total as ferramentas avancadas para maximizar a sua retencao.',
    role: 'premium',
    highlight: true,
    features: [
      'Simulacoes de prova ilimitadas',
      'Treino diario sem limites (todos os niveis, inclui Dificil)',
      'Ranking completo',
      'Historico de provas',
      'Sistema de revisao inteligente',
      'Modo Dificil desbloqueado',
      'Banco completo de questoes',
      'Revisao guiada por IA (sem radar completo)',
    ],
    prices: {
      monthly: { amount: 8000, label: '8.000 Kz (mensal)' },
    },
  },
  {
    id: 'elite',
    name: 'Elite (Aprovacao)',
    badge: 'Maximo Foco',
    headline: 'Para quem nao aceita menos que a aprovacao.',
    description: 'A experiencia definitiva para candidatos altamente comprometidos.',
    role: 'elite',
    features: [
      'Tudo do Premium +',
      'Radar de Fraquezas (Insights Inteligentes)',
      'Simulacao Nacional (Prova de Evento)',
      'Estatisticas profundas em PDF',
      'Modo Batalha XP Plus',
      'Sistema de revisao inteligente',
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
    description: 'Acesso vitalicio ao simulador focado no edital do MINSA.',
    priceAmount: 5000,
    priceLabel: '5.000 Kz',
    features: ['Simulados de Legislacao e Etica', 'Cronometro e ambiente de prova real', 'Destaques do edital atualizado'],
  },
  {
    id: 'pacote_offline',
    name: 'Pacote Offline (PWA)',
    description: 'Estude em qualquer lugar, mesmo sem internet ou dados moveis.',
    priceAmount: 900,
    priceLabel: '900 Kz',
    features: ['Download de questoes para uso offline', 'Sincronizacao automatica ao reconectar', 'Acesso ilimitado ao treino diario offline'],
  },
];
