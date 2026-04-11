import { validateTemporalConcepts, getContextualPrompt } from './temporalValidation';

export interface GenerateQuestionsPayload {
  area: string;
  topic: string;
  count: number;
  difficulty: string;
  rawContent: string;
}

export const defaultGeminiModel = 'gemini-2.5-flash';

const getAlternativeBalanceHint = (difficulty: string) => {
  switch (String(difficulty || '').toLowerCase()) {
    case 'easy':
      return '4 a 9 palavras por alternativa, mantendo diferenca curta entre a maior e a menor.';
    case 'hard':
      return '6 a 13 palavras por alternativa, com o mesmo nivel de detalhe nas quatro opcoes.';
    default:
      return '5 a 11 palavras por alternativa, com estrutura sintatica e tamanho visual semelhantes.';
  }
};

export const buildQuestionsPrompt = ({
  area,
  topic,
  count,
  difficulty,
  rawContent,
}: GenerateQuestionsPayload) => `
ESPECIALISTA EM CONCURSOS DE SAUDE EM ANGOLA
AREA: ${area}
TOPICO: ${topic}
QUANTIDADE: ${count} questoes
DIFICULDADE: ${difficulty}
ALTERNATIVAS: 4

${getContextualPrompt(area, topic)}

PROCESSO OBRIGATORIO:
1. Defina a resposta correta primeiro
2. Defina um unico molde sintatico para as 4 alternativas da mesma questao
3. Crie alternativas incorretas plausiveis dentro da mesma janela de tamanho
4. Verifique se apenas uma alternativa esta correta
5. Verifique se as outras estao realmente incorretas

REGRAS:
- Apenas uma alternativa com isCorrect: true
- Demais com isCorrect: false
- Portugues de Angola correto
- Alternativas plausiveis mas incorretas
- Mantenha paralelismo sintatico e tamanho visual semelhante entre as alternativas
- Trabalhe as 4 alternativas em bloco desde a criacao, nao apenas na verificacao final
- Janela recomendada: ${getAlternativeBalanceHint(difficulty)}
- A correta nao pode ser obviamente mais extensa, mais completa ou mais detalhada que as outras
- Se a correta precisar de detalhe tecnico, distribua detalhe semelhante pelos distratores plausiveis
- Distribuicao equilibrada entre todos os topicos (exceto cultura geral)
- Para simulados: 100 questoes total
- Para treinos: numero solicitado

RETORNE APENAS O JSON ABAIXO:
{
  "questions": [
    {
      "question": "Texto da pergunta",
      "alternatives": [
        {"text": "Opcao A", "isCorrect": false},
        {"text": "Opcao B", "isCorrect": false},
        {"text": "Opcao C", "isCorrect": true},
        {"text": "Opcao D", "isCorrect": false}
      ],
      "explanation": "Explicacao detalhada",
      "difficulty": "${difficulty}"
    }
  ]
}
`;
