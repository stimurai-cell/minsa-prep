import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { HEALTH_AREAS, PRODUCT_CONTEXT } from '../lib/productContext';

interface FAQItemData {
  question: string;
  answer: ReactNode;
}

interface FAQSection {
  title: string;
  description: string;
  items: FAQItemData[];
}

function FAQItem({ question, answer }: FAQItemData) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-slate-50"
      >
        <span className="pr-4 font-bold leading-tight text-slate-700">{question}</span>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="animate-in slide-in-from-top-2 p-5 pt-0 text-sm leading-relaxed text-slate-600 duration-200">
          {answer}
        </div>
      )}
    </div>
  );
}

const paragraphs = (...lines: string[]) => (
  <div className="space-y-3">
    {lines.map((line, index) => (
      <p key={index}>{line}</p>
    ))}
  </div>
);

const listAnswer = (intro: string, items: string[], outro?: string) => (
  <div className="space-y-3">
    <p>{intro}</p>
    <ul className="list-disc space-y-2 pl-5 marker:text-sky-400">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
    {outro ? <p>{outro}</p> : null}
  </div>
);

export default function HelpCenter() {
  const navigate = useNavigate();

  const sections: FAQSection[] = [
    {
      title: 'Primeiros passos',
      description: 'Entenda como configurar a conta, liberar o estudo e usar o app no dia a dia.',
      items: [
        {
          question: 'Como comeco a usar o MINSA Prep da forma certa?',
          answer: listAnswer(
            'O fluxo ideal para comecar e simples:',
            [
              'crie a sua conta ou entre com a conta que ja usa no app',
              'complete o perfil e escolha a sua area principal de estudo',
              'defina o seu objetivo quando o app pedir, porque isso ajuda a personalizar a experiencia',
              'abra a aba Pratique e escolha o modo que faz mais sentido para o seu momento',
              'mantenha consistencia diaria para ganhar XP, alimentar a ofensiva e aparecer nas ligas',
            ],
            'Depois disso, o painel inicial passa a mostrar atalho de treino, ofensiva, XP, revisoes, notificacoes e recomendacoes do sistema.'
          ),
        },
        {
          question: 'Para quem o app foi criado e qual e o foco atual?',
          answer: listAnswer(
            `${PRODUCT_CONTEXT.name} nasceu para ajudar voce a estudar muito conteudo de forma facil, inteligente e descontraida. Ele foi pensado para profissionais e estudantes da saude usarem em varios momentos da formacao e da carreira, mesmo quando o objetivo nao e concurso.`,
            HEALTH_AREAS.map((area) => area.name),
            'Hoje, o foco principal do produto esta no Concurso Publico da Saude. Por isso, a comunicacao, os simulados e os reforcos comerciais estao mais orientados para essa janela, sem deixar de lado o uso continuo para estudo e reciclagem.'
          ),
        },
        {
          question: 'O que eu encontro no painel inicial?',
          answer: paragraphs(
            'O painel inicial e a visao geral da sua preparacao. Ele junta o que voce mais precisa ver sem obrigar voce a entrar em varias telas.',
            'Ali aparecem a sua ofensiva, o XP total, a ultima simulacao, a dica do dia, tarefas diarias, atalho para treino, revisoes pendentes, notificacoes, comunidade e, nos planos pagos, recursos como Mentor IA e blocos de acompanhamento mais avancado.',
            'Para usuarios Elite, o painel tambem mostra o acesso ao Plano de Estudo Elite, incluindo avaliacao, atualizacao do plano e consulta do cronograma semanal.'
          ),
        },
        {
          question: 'O que significa ofensiva diaria no app?',
          answer: paragraphs(
            'Ofensiva e a sua sequencia de dias com atividade real de estudo dentro do MINSA Prep. Quando voce responde questoes e mantem o ritmo, a ofensiva cresce.',
            'Ela serve para reforcar consistencia, porque estudar um pouco todos os dias costuma gerar mais resultado do que estudar muito de forma irregular.',
            'Em algumas situacoes o app tambem oferece protecao de ofensiva em troca de XP, para ajudar a segurar a sequencia por um periodo curto quando isso estiver disponivel para a sua conta.'
          ),
        },
        {
          question: 'Como escolho ou troco a minha area de estudo?',
          answer: paragraphs(
            'A area principal define boa parte da sua experiencia dentro do app. Ela influencia os topicos carregados no treino, a forma como o sistema monta a simulacao, as sugestoes do painel e ate as pessoas da sua area em recursos sociais e competitivos.',
            'Se precisar mudar, faca isso nas configuracoes do perfil. A partir dai, o app passa a reorganizar o conteudo conforme a nova area escolhida.'
          ),
        },
        {
          question: 'O MINSA Prep funciona como app instalado no telemovel?',
          answer: paragraphs(
            'Sim. O app pode ser instalado diretamente no dispositivo quando o navegador ou o sistema mostrar a opcao de instalacao.',
            'Depois de instalado, o acesso fica mais rapido, a experiencia fica mais parecida com a de um app nativo e alguns recursos offline ficam mais confortaveis de usar.',
            'Quando existe uma versao nova, o app tambem pode mostrar um aviso de atualizacao para voce recarregar e entrar na versao mais recente.'
          ),
        },
      ],
    },
    {
      title: 'Estudo e pratica',
      description: 'Veja como cada modo funciona e como o app organiza revisao, progresso e estudo avancado.',
      items: [
        {
          question: 'Qual e a diferenca entre Treino, Treino Guiado, Modo Relampago e Simulacao?',
          answer: listAnswer(
            'Cada modo resolve uma necessidade diferente:',
            [
              'Treino Diario ou Treino Livre: voce pratica topicos da sua area com correcao imediata e ganho de XP.',
              'Treino Guiado: o sistema escolhe automaticamente o proximo foco para usuarios Elite, mantendo uma sequencia organizada.',
              'Modo Relampago: modo rapido contra o tempo, pensado para reflexo, ritmo e pressao.',
              'Simulacao de prova: sessao mais longa, com temporizador, nota final e historico de desempenho.',
            ],
            'O ideal e alternar entre eles conforme a fase da sua preparacao: treino para consolidar, relampago para acelerar e simulacao para testar resistencia e controle.'
          ),
        },
        {
          question: 'Como funciona o Treino Guiado do Elite?',
          answer: paragraphs(
            'No Elite, o treino pode vir pronto. O sistema organiza o topico da vez e vai avancando em ordem para que voce nao perca tempo decidindo o que estudar a cada entrada.',
            'Se a sua conta Elite tiver o controlo temporario liberado, voce pode escolher manualmente topico e nivel so naquela sessao. Ao sair, o app volta para o fluxo automatico.',
            'A ideia do Treino Guiado e reduzir indecisao, manter sequencia e aproximar o estudo real de um plano semanal consistente.'
          ),
        },
        {
          question: 'Como funciona a revisao inteligente?',
          answer: paragraphs(
            'Sempre que voce responde questoes, o app vai registando esse historico e montando revisoes com base no que precisa voltar para a sua memoria no momento certo.',
            'Quando existem questoes prontas para revisar, o painel destaca isso para voce. Assim, voce nao estuda so novidade: tambem reforca o que errou ou o que corre risco de esquecer.',
            'Esse mecanismo e uma das partes mais importantes do app para melhorar retencao e nao depender apenas de repeticao aleatoria.'
          ),
        },
        {
          question: 'O que acontece quando eu respondo uma questao?',
          answer: paragraphs(
            'A resposta e corrigida na hora, a alternativa certa fica destacada e o app mostra a explicacao quando ela estiver disponivel.',
            'Ao longo da sessao, voce ganha XP, alimenta a ofensiva, avanca no historico de desempenho e pode desbloquear badges e registros no feed de atividade.',
            'O app tambem usa esse comportamento para ajustar revisoes futuras e enriquecer os indicadores que aparecem no painel.'
          ),
        },
        {
          question: 'Como funciona o Modo Relampago?',
          answer: paragraphs(
            'O Modo Relampago e uma corrida de questoes com tempo curto por pergunta. Voce precisa responder rapido sem errar para manter o combo vivo.',
            'A dificuldade sobe conforme o seu desempenho cresce, entao o modo vai ficando mais exigente a medida que voce acerta mais.',
            'Nos planos com acesso offline, esse modo tambem pode continuar a funcionar com conteudo local ja sincronizado no aparelho.'
          ),
        },
        {
          question: 'Como funciona a Simulacao de prova?',
          answer: paragraphs(
            'A simulacao monta uma prova completa e equilibrada com 100 questoes da sua area, temporizador visivel, progresso da sessao e nota final.',
            'No fim, o app regista a tentativa, calcula o aproveitamento, soma XP e alimenta o historico usado pelo painel, pela revisao e pela analise do seu desempenho.',
            'No plano gratuito, a simulacao e limitada. Nos planos pagos, ela entra no estudo de forma bem mais livre e constante.'
          ),
        },
        {
          question: 'O que o Mentor IA analisa nos planos pagos?',
          answer: paragraphs(
            'O Mentor IA olha para o seu desempenho recente, para os topicos onde voce esta melhor ou pior e para as suas ultimas simulacoes.',
            'Com base nisso, ele entrega um resumo com ponto forte, pontos de foco, orientacao pratica e uma motivacao curta para direcionar sua proxima etapa.',
            'No uso real, ele serve menos para falar bonito e mais para ajudar voce a estudar com decisao mais clara.'
          ),
        },
        {
          question: 'O que e o Plano de Estudo Elite?',
          answer: paragraphs(
            'O Plano de Estudo Elite e um bloco de organizacao avancada para quem quer mais acompanhamento. O usuario responde uma avaliacao curta, informa disponibilidade, experiencia, horario preferido e dias da semana em que consegue estudar.',
            'A partir disso, o app gera um cronograma semanal com foco principal, tipo de atividade por dia e horario sugerido. O plano pode ser revisto, editado e confirmado dentro da propria plataforma.',
            'Em resumo, e a camada do app voltada para quem quer menos improviso e mais estrategia.'
          ),
        },
      ],
    },
    {
      title: 'Ranking, ligas e comunidade',
      description: 'Saiba como o app transforma estudo em competicao saudavel, visibilidade e conexao com outros candidatos.',
      items: [
        {
          question: 'Como ganho XP dentro do app?',
          answer: paragraphs(
            'Voce ganha XP ao estudar nos modos principais do app, como treino, simulacao, Modo Relampago e, em alguns casos, batalhas.',
            'O XP funciona como moeda de progresso. Ele alimenta o painel, influencia posicionamento competitivo e ajuda a mostrar que voce esta realmente ativo na plataforma.',
            'Por isso, o ideal nao e apenas abrir o app: e concluir sessoes e manter regularidade.'
          ),
        },
        {
          question: 'Como funcionam as ligas e divisoes semanais?',
          answer: paragraphs(
            'As ligas organizam os estudantes em grupos semanais com classificacao por XP ganho naquele periodo. O objetivo e subir de divisao com base em desempenho real.',
            'Quando a semana fecha, o app pode mostrar o resultado da sua sala, a sua colocacao e a mudanca de liga quando houver promocao ou queda.',
            'Em vez de competir com o app inteiro de uma vez, voce disputa em salas mais controladas, o que deixa a experiencia mais justa e motivadora.'
          ),
        },
        {
          question: 'O ranking e igual para todo mundo?',
          answer: paragraphs(
            'Nao exatamente. O ranking existe em camadas. No plano gratuito voce entra na experiencia de base, enquanto os planos pagos desbloqueiam leitura mais completa e comparacao mais ampla.',
            'Na pratica, isso significa que estudar mais e ter um plano melhor nao muda so a sua nota: muda tambem a profundidade com que voce acompanha sua posicao no ecossistema do app.'
          ),
        },
        {
          question: 'Como funcionam amigos, feed e comunidade?',
          answer: paragraphs(
            'Na aba social voce pode procurar outros estudantes pelo nome, seguir pessoas da sua area e acompanhar um feed com conquistas e movimentacoes relevantes.',
            'O app tambem oferece acesso rapido para a comunidade oficial no WhatsApp, que serve para orientacoes, troca de experiencia e convite de novos colegas.',
            'Essa parte social foi feita para aumentar consistencia e senso de caminhada coletiva, nao apenas para exibir numero.'
          ),
        },
        {
          question: 'O que e a Batalha e quem pode usar?',
          answer: paragraphs(
            'A Batalha e um modo competitivo entre dois estudantes da mesma area. Um desafia, o outro aceita e a partida acontece em tempo real dentro do fluxo do app.',
            'Esse recurso e exclusivo do Elite porque ele faz parte da camada mais avancada de competicao e engajamento.',
            'Se a sua conta ainda nao for Elite, a tela de batalha aparece como recurso bloqueado e direciona para upgrade.'
          ),
        },
        {
          question: 'Como funcionam as notificacoes do app?',
          answer: paragraphs(
            'O MINSA Prep trabalha com notificacoes internas e, quando voce permite, tambem com alertas do navegador ou do telemovel.',
            'Elas servem para avisos do sistema, conquistas, lembretes, marketing pontual e acontecimentos importantes para o seu estudo.',
            'Voce so precisa ativar uma vez no aparelho. Se bloquear, sera necessario liberar novamente nas definicoes do navegador ou do dispositivo.'
          ),
        },
      ],
    },
    {
      title: 'Planos pagos e pacotes',
      description: 'Resumo claro do que existe hoje, o que cada plano desbloqueia e para quem faz sentido.',
      items: [
        {
          question: 'O que esta incluido no plano gratuito?',
          answer: listAnswer(
            'O gratuito e a porta de entrada do app. Hoje ele cobre o essencial para conhecer a plataforma:',
            [
              'treino base na sua area',
              'ate 30 questoes por dia',
              'niveis Facil, Medio e Misto',
              'ranking basico',
              'simulacao com uso limitado',
            ],
            'Recursos mais profundos, como revisao inteligente, banco completo, modo Dificil, leitura completa de ranking, estudo offline, radar de fraquezas, exportacoes e batalha, ficam para as camadas pagas.'
          ),
        },
        {
          question: 'O que muda quando eu assino o Premium?',
          answer: listAnswer(
            'O Premium e o plano principal de preparacao real. Ele libera o que costuma pesar mais no dia a dia do estudante:',
            [
              'simulacoes sem o limite do plano gratuito',
              'treino sem limite, incluindo o nivel Dificil',
              'banco completo de questoes',
              'ranking completo e historico de desempenho',
              'revisao inteligente para estudar com mais estrategia',
              'Mentor IA e leitura mais profunda do seu desempenho',
              'estudo offline no treino e no Modo Relampago',
            ],
            'No app atual, o Premium e a melhor escolha para quem quer estudar serio sem entrar ainda na camada Elite.'
          ),
        },
        {
          question: 'O que muda quando eu assino o Elite?',
          answer: listAnswer(
            'O Elite e a camada maxima do MINSA Prep. Ele inclui tudo do Premium e soma recursos de organizacao e acompanhamento avancado:',
            [
              'Treino Guiado automatico',
              'Plano de Estudo Elite com avaliacao e cronograma semanal',
              'radar de fraquezas e leitura por topico no painel',
              'exportacao de treino em PDF e DOCX',
              'Modo Batalha',
              'mais controlo para quem estuda com rotina forte e quer estrategia semanal',
            ],
            'Na pratica, o Elite faz mais sentido para quem nao quer apenas praticar bastante, mas tambem organizar o estudo com mais profundidade.'
          ),
        },
        {
          question: 'Premium ou Elite: qual devo escolher?',
          answer: paragraphs(
            'Escolha o Premium se o seu foco principal e desbloquear estudo forte no dia a dia: mais questoes, mais simulacoes, modo Dificil, revisao, ranking e uso offline.',
            'Escolha o Elite se, alem disso, voce quer plano semanal, treino guiado, leitura por fraquezas, exportacoes e recursos competitivos exclusivos como batalha.',
            'Resumindo: Premium melhora a execucao. Elite melhora a execucao e a estrategia.'
          ),
        },
        {
          question: 'Quais sao os planos e pacotes pagos disponiveis hoje?',
          answer: listAnswer(
            'Hoje a estrutura comercial do app esta organizada assim:',
            [
              'Premium (Preparacao Real): 8.000 Kz por mes',
              'Elite (Aprovacao): 15.000 Kz em pagamento unico',
              'Pacote Intensivo Farmacia: 3.000 Kz',
              'Pacote Intensivo Enfermagem: 3.000 Kz',
              'Simulacao Oficial Extra: 1.000 Kz',
              'Modulo Concurso Publico: 5.000 Kz',
            ],
            'Os pacotes extras foram pensados como complementos para momentos especificos de estudo ou para necessidades mais focadas.'
          ),
        },
        {
          question: 'Como funcionam os pacotes intensivos e a Simulacao Oficial Extra?',
          answer: paragraphs(
            'Os pacotes intensivos sao complementos focados em reforco. Hoje existem versoes para Farmacia e Enfermagem, cada uma com questoes extras e simulacoes mais especificas.',
            'A Simulacao Oficial Extra libera uma prova especial adicional, pensada para quem quer acrescentar mais uma experiencia de teste dentro do ecossistema do app.',
            'Esses pacotes nao substituem Premium ou Elite. Eles servem para aprofundar ou acelerar uma frente especifica da sua preparacao.'
          ),
        },
        {
          question: 'Como funciona o Modulo Concurso Publico?',
          answer: paragraphs(
            'O Modulo Concurso Publico e um pacote focado no edital do MINSA. Ele foi pensado para quem quer concentrar energia em legislacao, etica e ambiente mais proximo da prova oficial.',
            'Dentro da proposta atual, ele entrega simulados mais focados, cronometro e uma experiencia mais direcionada para concurso.',
            'Se a sua meta principal e concurso publico, esse pacote funciona como um reforco de foco, nao apenas como mais volume de questoes.'
          ),
        },
        {
          question: 'O estudo offline entra em qual plano?',
          answer: paragraphs(
            'No desenho atual do produto, o estudo offline faz parte do Premium e do Elite. Isso inclui sincronizacao de conteudo para continuar o treino mesmo quando a internet falha.',
            'Algumas contas antigas podem ter pacote offline legado separado, mas para a experiencia atual o usuario normalmente ja recebe esse beneficio dentro dos planos principais.',
            'Sempre que o aparelho volta a ficar online, o app tenta sincronizar progresso, XP pendente e conteudo local novamente.'
          ),
        },
      ],
    },
    {
      title: 'Pagamentos, suporte e conta',
      description: 'Tudo o que o usuario precisa saber para comprar, enviar comprovativo, acompanhar ativacao e resolver problemas.',
      items: [
        {
          question: 'Como faco para comprar um plano pago ou um pacote extra?',
          answer: paragraphs(
            'Entre na loja do app, escolha o plano ou pacote que quer ativar e role ate a area de pagamento.',
            'Ali o app mostra as contas de transferencia disponiveis. Depois de pagar, voce envia o comprovativo no proprio formulario do app e o pedido fica registado para revisao.',
            'Esse fluxo vale tanto para os planos principais como para os extras que aparecem na pagina Premium.'
          ),
        },
        {
          question: 'Quais dados eu preciso enviar no comprovativo?',
          answer: listAnswer(
            'Para o pedido ser analisado com menos atrito, envie tudo o que a tela pede:',
            [
              'nome de quem fez o pagamento',
              'referencia da transferencia ou numero da operacao',
              'imagem ou PDF do comprovativo',
              'observacao opcional quando houver algum detalhe importante',
            ],
            'Quanto mais claro vier o pedido, mais facil fica a validacao pela equipe.'
          ),
        },
        {
          question: 'Como acompanho o estado do meu pedido?',
          answer: paragraphs(
            'A propria pagina Premium mostra o ultimo pedido registado pelo utilizador, com estado como pending, approved ou rejected quando essas atualizacoes ja estiverem lancadas.',
            'Se houver nota administrativa, ela tambem pode aparecer nesse bloco. Isso evita que voce fique sem contexto sobre o que aconteceu com o pedido anterior.'
          ),
        },
        {
          question: 'Quanto tempo leva para o plano ser ativado?',
          answer: paragraphs(
            'A ativacao acontece depois da revisao do comprovativo pela equipe. O app nao ativa sozinho no segundo do envio: primeiro o pedido precisa ser validado.',
            'Em situacoes urgentes, principalmente quando ha internet fraca, o proprio app orienta o utilizador a falar com o suporte no WhatsApp enquanto o pedido continua registado para analise.'
          ),
        },
        {
          question: 'Como faco para pedir ajuda, reportar erro, problema de compra ou acesso?',
          answer: paragraphs(
            'Use o formulario da Central de Ajuda para enviar assunto, descricao e tipo de problema. Esse canal foi pensado exatamente para login, compra, sugestao, erro, abuso e pedido de exclusao de conta.',
            'Se o problema envolver pagamento, comprovativo ou urgencia operacional, o suporte tambem pode ser acionado pelo WhatsApp informado na pagina Premium: +244936793706.'
          ),
        },
        {
          question: 'Como devo tratar cancelamento, reembolso ou revisao de pagamento?',
          answer: paragraphs(
            'Esses casos devem ser tratados diretamente com o suporte, sempre com comprovativo, contexto do pagamento e descricao clara do motivo do pedido.',
            'Em vez de tentar resolver por fora, o melhor caminho e abrir o chamado pela Central de Ajuda e, se for necessario acelerar, complementar pelo WhatsApp de suporte.'
          ),
        },
        {
          question: 'Nao consigo entrar na conta. O que devo fazer?',
          answer: paragraphs(
            'Se o problema for senha, use a opcao de recuperar acesso na tela de login. Se o email estiver certo, o fluxo de redefinicao leva voce de volta para a conta sem perder o historico sincronizado.',
            'Se o erro for outro, como falha de autenticacao, bloqueio ou dificuldade depois de trocar de aparelho, abra um pedido em Ajuda com o tipo de problema correto para a equipe investigar.'
          ),
        },
        {
          question: 'Troquei de aparelho ou fiquei sem internet. Vou perder o meu progresso?',
          answer: paragraphs(
            'Se voce entrar na mesma conta, o progresso sincronizado continua ligado ao seu perfil. O que muda de um aparelho para outro e o conteudo local baixado, especialmente no modo offline.',
            'Quando a internet cai, o app tenta manter o que for possivel com dados locais e, ao reconectar, sincroniza XP pendente, logs e pacote offline quando a conta tem acesso a isso.',
            'Ou seja: a conta segura o seu historico principal; o aparelho guarda apenas parte do apoio local.'
          ),
        },
        {
          question: 'As notificacoes nao chegam. Como resolvo?',
          answer: paragraphs(
            'Primeiro confirme se voce permitiu notificacoes no navegador ou no aparelho. Se tiver bloqueado, o app nao consegue empurrar alertas externos.',
            'Depois disso, vale abrir a central de notificacoes do proprio app para verificar se os avisos internos continuam a chegar normalmente.',
            'Se o bloqueio foi negado pelo sistema, a correcao costuma ser feita nas definicoes do navegador ou do dispositivo.'
          ),
        },
        {
          question: 'Como altero dados do perfil, mudo a area ou peco exclusao da conta?',
          answer: paragraphs(
            'Dados comuns e ajustes de perfil podem ser tratados nas configuracoes do utilizador, incluindo mudanca de area quando necessario.',
            'Para pedidos mais sensiveis, como exclusao definitiva da conta, use o formulario da Central de Ajuda e escolha a categoria correspondente. Esse e o caminho mais seguro para abrir o processo certo.'
          ),
        },
        {
          question: 'Por que o app mostrou um aviso de nova versao?',
          answer: paragraphs(
            'Esse aviso aparece quando o MINSA Prep detecta que existe uma versao mais recente disponivel para o navegador ou para a instalacao atual.',
            'Na pratica, o app esta pedindo para recarregar a experiencia e entrar na versao nova, evitando que voce continue com ficheiros antigos em cache.'
          ),
        },
      ],
    },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-white pb-20">
      <div className="sticky top-0 z-10 flex items-center border-b-2 border-slate-100 bg-white px-4 py-4 transition-shadow">
        <button
          onClick={() => navigate(-1)}
          className="shrink-0 p-2 text-slate-400 hover:text-slate-600"
        >
          <X className="h-6 w-6" />
        </button>
        <div className="flex-1 pr-10 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            MINSA Prep - Central de Ajuda
          </span>
        </div>
      </div>

      <div className="animate-in fade-in space-y-8 p-4 duration-300 md:p-8">
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest text-sky-500">
            <span>Central de Ajuda</span>
            <ChevronDown className="h-4 w-4 -rotate-90" />
            <span className="font-bold text-slate-400">Inicio</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-800 md:text-4xl">
            Perguntas frequentes
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-6 text-slate-500 md:text-base">
            Esta central foi atualizada para explicar com mais clareza como o app funciona hoje:
            estudo, progresso, social, notificacoes, planos pagos, pacotes extras, pagamentos e suporte.
          </p>
        </div>

        <div className="rounded-[2rem] border border-sky-100 bg-sky-50/70 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-600">
            Antes de abrir um chamado
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Vale ler esta pagina ate ao fim. A maioria das duvidas sobre treino, ligas, Premium,
            Elite, comprovativos e notificacoes ja esta explicada aqui de forma direta.
          </p>
        </div>

        <div className="space-y-6">
          {sections.map((section) => (
            <div
              key={section.title}
              className="overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b-2 border-slate-100 bg-slate-50/60 px-5 py-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-sky-500">
                  {section.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{section.description}</p>
              </div>

              <div className="divide-y divide-slate-100">
                {section.items.map((item) => (
                  <FAQItem key={item.question} question={item.question} answer={item.answer} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-6 text-center">
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 px-6 py-8">
            <h3 className="text-xl font-black text-slate-800">Ainda ficou com alguma duvida?</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
              Se a sua questao nao estiver respondida aqui, envie um pedido pela Central de Ajuda
              para a equipe analisar o seu caso com mais contexto.
            </p>
            <Link
              to="/feedback"
              className="mt-6 inline-block rounded-2xl bg-sky-500 px-10 py-4 font-black uppercase tracking-widest text-white shadow-[0_4px_0_0_#0284c7] transition-all active:translate-y-1 active:shadow-none hover:bg-sky-600"
            >
              Enviar comentarios
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
