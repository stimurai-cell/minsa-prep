import { GoogleGenAI, Type } from '@google/genai';

const defaultGeminiModel = 'gemini-1.5-flash';

const buildMentorPrompt = ({
    fullName,
    area,
    topicProgress,
    recentAttempts
}: {
    fullName: string;
    area: string;
    topicProgress: any[];
    recentAttempts: any[];
}) => `
  Você é a Mentora IA do MINSA Prep, uma especialista em concursos de saúde em Angola.
  Analise o desempenho do estudante "${fullName}" da área de "${area}" e forneça um feedback estratégico.

  DADOS DO ESTUDANTE:
  - Progresso por Tópico: ${JSON.stringify(topicProgress)}
  - Últimas Tentativas de Simulado: ${JSON.stringify(recentAttempts)}

  INSTRUÇÕES:
  1. Identifique os 2 tópicos de maior fraqueza.
  2. Identifique 1 ponto forte.
  3. Dê um conselho prático focado em aprovação.
  4. Mantenha o tom profissional e motivador.
  5. Use Português de Angola (formal e claro).

  Retorne apenas um JSON válido seguindo este formato:
  {
    "weaknesses": ["Nome do Tópico 1", "Nome do Tópico 2"],
    "strength": "Nome do Tópico Forte",
    "advice": "Texto do conselho estratégico para melhorar os pontos fracos.",
    "motivation": "Uma frase curta e poderosa de encorajamento."
  }
`;

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = process.env.GEMINI_MODEL || defaultGeminiModel;

    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY não configurada.' });
    }

    const { fullName, area, topicProgress, recentAttempts } = req.body || {};

    const ai = new GoogleGenAI({ apiKey });

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: buildMentorPrompt({
                fullName,
                area,
                topicProgress,
                recentAttempts
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
