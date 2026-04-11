import { GoogleGenAI, Type } from '@google/genai';

const defaultGeminiModel = 'gemini-1.5-flash';
const readEnvValue = (...values: Array<string | undefined>) =>
    values
        .map((value) => String(value || '').trim())
        .find(Boolean)
        || '';

const allowClientPrefixedGeminiFallback = !readEnvValue(process.env.VERCEL_ENV);

const buildMentorPrompt = ({
    fullName,
    area,
    topicProgress,
    recentAttempts,
    allTopics
}: {
    fullName: string;
    area: string;
    topicProgress: any[];
    recentAttempts: any[];
    allTopics: any[];
}) => `
  Você é o Mentor IA do MINSA Prep, um especialista em concursos de saúde em Angola.
  Analise o desempenho do estudante "${fullName}" da área de "${area}" e forneça um feedback estratégico.

  DADOS DO ESTUDANTE:
  - Progresso por Tópico: ${JSON.stringify(topicProgress)}
  - Últimas Tentativas de Simulado: ${JSON.stringify(recentAttempts)}
  - Todos os Tópicos Disponíveis na Área: ${JSON.stringify(allTopics)}

  INSTRUÇÕES ESPECÍFICAS PARA MODO ELITE:
  1. Faça uma análise comparativa entre TODOS os tópicos disponíveis, não apenas os já estudados.
  2. Identifique os 2 tópicos de maior prioridade baseados em:
     - Tópicos com baixo desempenho ou não estudados
     - Importância para concursos (tópicos com maior incidência)
     - Tópicos fundamentais para a área
  3. Identifique 1 ponto forte real ou, se não houver, indique "Nenhum tópico explorado o suficiente para determinar um ponto forte."
  4. Dê um conselho estratégico focado nos tópicos INTERNOS da plataforma, não em conteúdo externo.
  5. Baseie-se principalmente nos tópicos existentes no sistema.
  6. Use Português de Angola (formal e claro).

  Retorne apenas um JSON válido seguindo este formato:
  {
    "weaknesses": ["Nome do Tópico 1", "Nome do Tópico 2"],
    "strength": "Nome do Tópico Forte ou mensagem indicando insuficiência de dados",
    "advice": "Texto do conselho estratégico focado nos tópicos da plataforma.",
    "motivation": "Uma frase curta e poderosa de encorajamento."
  }
`;

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const apiKey = readEnvValue(
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_API_KEY_2,
        allowClientPrefixedGeminiFallback ? process.env.VITE_GEMINI_API_KEY : undefined
    );
    const modelName = process.env.GEMINI_MODEL || defaultGeminiModel;

    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY/GEMINI_API_KEY_2 não configurada.' });
    }

    const { fullName, area, topicProgress, recentAttempts, allTopics } = req.body || {};

    const ai = new GoogleGenAI({ apiKey });

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: buildMentorPrompt({
                fullName,
                area,
                topicProgress,
                recentAttempts,
                allTopics
            }),
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        weaknesses: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        strength: { type: Type.STRING },
                        advice: { type: Type.STRING },
                        motivation: { type: Type.STRING }
                    },
                    required: ['weaknesses', 'strength', 'advice', 'motivation']
                }
            }
        });

        if (!response.text) {
            return res.status(502).json({ error: 'Gemini retornou vazio.' });
        }

        return res.status(200).json(JSON.parse(response.text));
    } catch (error: any) {
        console.error('Error in AI Mentor API:', error);
        return res.status(500).json({ error: error.message });
    }
}
