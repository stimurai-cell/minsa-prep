export type PlanPeriod = 'monthly' | 'quarterly' | 'semiannual';

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
    quarterly: { amount: number; label: string };
    semiannual: { amount: number; label: string };
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
      quarterly: { amount: 0, label: '0 Kz' },
      semiannual: { amount: 0, label: '0 Kz' },
    },
  },
  {
    id: 'basic',
    name: 'Basic (Estudante)',
    badge: 'Essencial',
    headline: 'Para quem precisa de preparacao consistente.',
    description: 'Liberte simulacoes ilimitadas e acompanhe as suas estatisticas e desempenho.',
    role: 'basic',
    features: [
      'Simulacoes de prova ilimitadas',
      'Treino diário sem limites (Exceto Dificil)',
      'Ranking completo',
      'Historico de provas',
      'Sistema de revisao inteligente',
    ],
    prices: {
      monthly: { amount: 1500, label: '1.500 Kz' },
      quarterly: { amount: 3900, label: '3.900 Kz' },
      semiannual: { amount: 7000, label: '7.000 Kz' },
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
      'Tudo do Basic +',
      'Modo Dificil desbloqueado',
      'Banco completo de questoes',
      'Radar de Fraquezas (Insights Inteligentes)',
      'Sistema de revisao inteligente',
    ],
    prices: {
      monthly: { amount: 4000, label: '4.000 Kz' },
      quarterly: { amount: 10000, label: '10.000 Kz' },
      semiannual: { amount: 18000, label: '18.000 Kz' },
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
      'Simulacao Nacional (Prova de Evento)',
      'Estatisticas profundas em PDF',
      'Modo Batalha XP Plus',
      'Sistema de revisao inteligente',
    ],
    prices: {
      monthly: { amount: 8000, label: '8.000 Kz' },
      quarterly: { amount: 21000, label: '21.000 Kz' },
      semiannual: { amount: 38000, label: '38.000 Kz' },
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
    name: 'Pacote Intensivo Farmácia',
    description: 'Reforce o seu estudo focado apenas em Farmácia.',
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
    name: 'Módulo Concurso Público',
    description: 'Acesso vitalício ao simulador focado no edital do MINSA.',
    priceAmount: 5000,
    priceLabel: '5.000 Kz',
    features: ['Simulados de Legislação e Ética', 'Cronómetro e ambiente de prova real', 'Destaques do edital atualizado'],
  },
  {
    id: 'pacote_offline',
    name: 'Pacote Offline (PWA)',
    description: 'Estude em qualquer lugar, mesmo sem internet ou dados móveis.',
    priceAmount: 900,
    priceLabel: '900 Kz',
    features: ['Download de questões para uso offline', 'Sincronização automática ao reconectar', 'Acesso ilimitado ao treino diário offline'],
  },
];
