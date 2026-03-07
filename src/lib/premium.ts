export type PremiumPlan = {
  id: string;
  name: string;
  badge: string;
  cadence: string;
  priceLabel: string;
  priceAmount: number;
  durationMonths: number;
  headline: string;
  description: string;
  features: string[];
  highlight?: boolean;
};

export const premiumPlans: PremiumPlan[] = [
  {
    id: 'starter',
    name: 'Plano Gratuito',
    badge: 'Entrada',
    cadence: 'Sem custo',
    priceLabel: '0 Kz',
    priceAmount: 0,
    durationMonths: 0,
    headline: 'Bom para testar o ritmo da plataforma.',
    description: 'Ideal para novos estudantes entrarem, responderem questoes e perceberem valor antes de subir.',
    features: [
      'Treinos e provas essenciais',
      'Progresso base por topico',
      'Ritmo inicial sem compromisso financeiro',
    ],
  },
  {
    id: 'focus',
    name: 'Premium Focus',
    badge: 'Mais estrategico',
  cadence: 'Plano',
  priceLabel: '2.000 Kz',
    priceAmount: 2000,
    durationMonths: 1,
    headline: 'Pacote mais indicado para a maioria dos candidatos.',
    description: 'Entrega consistencia sem assustar no preco. Deve ser o plano mais promovido na app.',
    features: [
      'Simulados completos sem limite apertado',
      'Revisao guiada por dificuldade e tema',
      'Historico detalhado de erros e acertos',
    ],
    highlight: true,
  },
  {
    id: 'master',
    name: 'Premium Intensivo',
    badge: 'Maximo rendimento',
  cadence: 'Plano',
  priceLabel: '5.000 Kz',
    priceAmount: 5000,
    durationMonths: 3,
    headline: 'Para quem quer preparar-se com acompanhamento total.',
    description: 'Bom para upsell de candidatos em reta final ou perfis premium recorrentes.',
    features: [
      'Plano de estudo adaptativo',
      'Simulados prioritarios e revisoes avancadas',
      'Recursos exclusivos de desempenho e disciplina',
    ],
  },
];
