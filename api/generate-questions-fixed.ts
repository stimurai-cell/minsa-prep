import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { validateTemporalConcepts, getContextualPrompt } from '../src/lib/temporalValidation.js';

const defaultGeminiModel = 'gemini-2.5-flash';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

const buildQuestionsPrompt = ({
  area,
  topic,
  count,
  difficulty,
  rawContent,
}: {
  area: string;
  topic: string;
  count: number;
  difficulty: string;
  rawContent: string;
}) => `
ESPECIALISTA EM CONCURSOS DE SAÚDE EM ANGOLA
ÁREA: ${area}
TÓPICO: ${topic}
QUANTIDADE: ${count} questões
DIFICULDADE: ${difficulty}
ALTERNATIVAS: 4

${getContextualPrompt(area, topic)}

PROCESSO OBRIGATÓRIO:
1. Defina a resposta correta primeiro
2. Crie alternativas incorretas plausíveis
3. Verifique se apenas uma alternativa está correta
4. Verifique se as outras estão realmente incorretas

REGRAS:
- Apenas uma alternativa com isCorrect: true
- Demais com isCorrect: false
- Português de Angola correto
- Alternativas plausíveis mas incorretas

RETORNE APENAS O JSON ABAIXO:
{
  "questions": [
    {
      "question": "Texto da pergunta",
      "alternatives": [
        {"text": "Opção A", "isCorrect": false},
        {"text": "Opção B", "isCorrect": false},
        {"text": "Opção C", "isCorrect": true},
        {"text": "Opção D", "isCorrect": false}
      ],
      "explanation": "Explicação detalhada",
      "difficulty": "${difficulty}"
    }
  ]
}
`;

const getErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) {
    return 'Falha desconhecida ao comunicar com o Gemini.';
  }
  const message = error.message;
  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('"code":429')) {
    return 'A quota do Gemini acabou.';
  }
  return message;
};

export default async function handler(req: any, res: any) {
  console.log('API called:', req.method, req.url);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Metodo nao permitido.' });
    }

    const { action } = req.body;
    const modelName = process.env.GEMINI_MODEL || defaultGeminiModel;

    // Status Action
    if (action === 'status') {
      return res.status(200).json({ model: modelName, mode: 'Vercel API' });
    }

    return res.status(400).json({ error: 'Acao invalida.' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: getErrorMessage(error) });
  }
}
