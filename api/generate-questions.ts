import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { validateTemporalConcepts, getContextualPrompt } from '../src/lib/temporalValidation';

const defaultGeminiModel = 'gemini-2.5-flash';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const buildQuestionsPrompt = ({
  area,
  topic,
  count,
  difficulty,
  rawContent,
  alternativesCount,
}: {
  area: string;
  topic: string;
  count: number;
  difficulty: string;
  rawContent: string;
  alternativesCount: number;
}) => `
  Voce e um especialista em concursos publicos da area da saude em Angola (MINSA).
  Gere ${count} questoes de multipla escolha sobre o topico "${topic}" da area de "${area}".

  ${getContextualPrompt(area, topic)}

  REGRAS CRITICAS - OBEDECA RIGIDOSAMENTE:
  1. Use portugues correto de Angola com todos os acentos e pontuacao.
  2. Cada questao deve ter exatamente ${alternativesCount} alternativas (A${alternativesCount === 4 ? ', B, C, D' : ', B, C, D, E'}).
  3. Estilo de escrita: Use termos como "assinale a alternativa correta", "assinale a incorreta", "exceto".
  4. O nivel de dificuldade deve ser "${difficulty}".
  5. Baseie-se no seguinte conteudo de referencia (se fornecido):
  ${rawContent || 'Nenhum conteudo fornecido - use seu conhecimento especializado.'}
  
  REGRA MAIS IMPORTANTE - ALTERNATIVAS:
  - EXATAMENTE UMA (1) alternativa deve ter "isCorrect": true
  - TODAS as outras alternativas devem ter "isCorrect": false
  - A alternativa correta deve ser a unica resposta certa para a pergunta
  - As alternativas incorretas devem ser plausiveis mas definitivamente erradas
  
  REGRA CRUCIAL - ATUALIDADE TEMPORAL:
  - USE APENAS conceitos e orgaos ATUAIS listados no contexto temporal
  - NUNCA use orgaos desatualizados como ARMED, Conselho Nacional de Farmácia, etc.
  - Se mencionar conceito antigo, esclareça que foi substituido
  
  EXEMPLO DE QUESTAO CORRETA (usando conceitos atuais):
  {
    "question": "Qual o principal orgao regulador de medicamentos em Angola em 2025?",
    "alternatives": [
      {"text": "Ministerio da Saude", "isCorrect": false},
      {"text": "INFARMED - Autoridade Nacional do Medicamento", "isCorrect": true},
      {"text": "ARMED - Agência Reguladora de Medicamentos", "isCorrect": false},
      {"text": "Direccao Nacional de Farmácia", "isCorrect": false}
    ],
    "explanation": "A INFARMED (Autoridade Nacional do Medicamento e Produtos de Saúde) é o orgao regulador atual, sucedendo a antiga ARMED.",
    "difficulty": "medium"
  }

  Retorne APENAS E EXCLUSIVAMENTE um JSON valido.
  NÃO adicione nenhum texto antes ou depois do JSON.
  NÃO inclua explicações ou comentários.
  A resposta deve começar com { e terminar com }.

  Formato JSON:
  {
    "questions": [
      {
        "question": "Texto da pergunta",
        "alternatives": [
          {"text": "Opcao A", "isCorrect": false},
          {"text": "Opcao B", "isCorrect": false},
          {"text": "Opcao C", "isCorrect": true},
          {"text": "Opcao D", "isCorrect": false}${
            alternativesCount === 5 ? `,
          {"text": "Opcao E", "isCorrect": false}` : ''
          }
        ],
        "explanation": "Explicacao detalhada da resposta correta.",
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

const validateGeneratedQuestions = (data: any, expectedAlts: number) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!data || !data.questions || !Array.isArray(data.questions)) {
    errors.push('Formato invalido: "questions" deve ser um array');
    return { errors, warnings };
  }
  
  data.questions.forEach((q: any, index: number) => {
    if (!q.question || typeof q.question !== 'string' || q.question.trim().length < 10) {
      errors.push(`Questao ${index + 1}: Texto da pergunta invalido ou muito curto`);
    }
    
    if (!q.alternatives || !Array.isArray(q.alternatives)) {
      errors.push(`Questao ${index + 1}: Alternativas invalidas`);
      return;
    }
    
    if (q.alternatives.length !== expectedAlts) {
      errors.push(`Questao ${index + 1}: Esperado ${expectedAlts} alternativas, recebido ${q.alternatives.length}`);
    }
    
    const correctCount = q.alternatives.filter((a: any) => a.isCorrect === true).length;
    if (correctCount !== 1) {
      errors.push(`Questao ${index + 1}: Deve ter exatamente 1 alternativa correta, encontrou ${correctCount}`);
      
      // Log detalhado das alternativas para debugging
      q.alternatives.forEach((alt: any, altIndex: number) => {
        if (alt.isCorrect === true) {
          warnings.push(`Questao ${index + 1}, Alternativa ${altIndex + 1} marcada como correta: "${alt.text}"`);
        }
      });
    }
    
    q.alternatives.forEach((alt: any, altIndex: number) => {
      if (!alt.text || typeof alt.text !== 'string' || alt.text.trim().length < 3) {
        errors.push(`Questao ${index + 1}, Alternativa ${altIndex + 1}: Texto invalido ou muito curto`);
      }
      if (typeof alt.isCorrect !== 'boolean') {
        errors.push(`Questao ${index + 1}, Alternativa ${altIndex + 1}: isCorrect deve ser booleano (recebido: ${typeof alt.isCorrect})`);
      }
    });
    
    if (!q.explanation || typeof q.explanation !== 'string' || q.explanation.trim().length < 20) {
      errors.push(`Questao ${index + 1}: Explicacao invalida ou muito curta`);
    }
    
    if (!q.difficulty || !['easy', 'medium', 'hard'].includes(q.difficulty)) {
      errors.push(`Questao ${index + 1}: Dificuldade invalida`);
    }
  });
  
  return { errors, warnings };
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido.' });
  }

  const { action, area_id, topic_id, custom_topic_name, count, difficulty, context, generated_data, area_name, topic_name, is_contest_highlight } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || defaultGeminiModel;

  // Status Action
  if (action === 'status') {
    return res.status(200).json({ model: modelName, mode: 'Vercel API' });
  }

  // Save Action
  if (action === 'save') {
    if (!generated_data || !generated_data.questions) {
      return res.status(400).json({ error: 'Dados para guardar ausentes.' });
    }

    try {
      let finalTopicId = generated_data.topic_id;

      // Se for novo tópico, criar primeiro
      if (!finalTopicId && generated_data.custom_topic_name && generated_data.area_id) {
        // Verificar se o tópico já existe para evitar duplicatas acidentais
        const { data: existingTopic } = await supabase
          .from('topics')
          .select('id')
          .eq('area_id', generated_data.area_id)
          .eq('name', generated_data.custom_topic_name)
          .maybeSingle();

        if (existingTopic) {
          finalTopicId = existingTopic.id;
        } else {
          const { data: newTopic, error: topicError } = await supabase
            .from('topics')
            .insert({
              name: generated_data.custom_topic_name,
              area_id: generated_data.area_id,
              description: `Gerado automaticamente via IA para ${generated_data.area_name || 'Especialidade'}`
            })
            .select()
            .single();

          if (topicError) throw topicError;
          finalTopicId = newTopic.id;
        }
      }

      if (!finalTopicId) throw new Error('ID do tópico não identificado.');

      let savedCount = 0;
      const expectedAlts = generated_data.is_contest_highlight ? 5 : 4;

      for (const q of generated_data.questions) {
        if (!q.alternatives || q.alternatives.length !== expectedAlts) {
          throw new Error(`Quantidade de alternativas inválida para a pergunta "${q.question}". Esperado ${expectedAlts}.`);
        }
        // 1. Inserir a Pergunta
        const { data: quest, error: qError } = await supabase
          .from('questions')
          .insert({
            topic_id: finalTopicId,
            content: q.question,
            difficulty: q.difficulty || 'medium',
            is_contest_highlight: generated_data.is_contest_highlight || false
          })
          .select()
          .single();

        if (qError) throw qError;

        // 2. Inserir Alternativas
        const alternatives = q.alternatives.map((alt: any) => ({
          question_id: quest.id,
          content: alt.text,
          is_correct: alt.isCorrect
        }));
        
        // Log detalhado para debugging
        console.log(`Salvando alternativas para questao "${q.question.substring(0, 50)}...":`, {
          totalAlternatives: alternatives.length,
          correctAlternatives: alternatives.filter((a: any) => a.is_correct === true).length,
          alternativesData: alternatives.map((a: any) => ({
            text: a.text.substring(0, 50) + '...',
            is_correct: a.is_correct
          }))
        });

        const { error: aError } = await supabase.from('alternatives').insert(alternatives);
        if (aError) {
          console.error('Erro ao salvar alternativas:', aError);
          throw aError;
        }

        // 3. Inserir Explicação
        if (q.explanation) {
          const { error: eError } = await supabase.from('question_explanations').insert({
            question_id: quest.id,
            content: q.explanation
          });
          // Se houver erro, logamos. O erro mais comum é constraint violation se o ID não bater.
          if (eError) {
            console.error('Erro GRANDE ao salvar explicação:', eError.message, eError.details);
            throw new Error(`Erro ao salvar explicacao: ${eError.message}`);
          }
        }
        savedCount++;
      }

      return res.status(200).json({ saved_count: savedCount, topic_id: finalTopicId });
    } catch (err: any) {
      console.error('Save error details:', err);
      return res.status(500).json({ error: err.message || 'Erro interno ao salvar no Supabase' });
    }
  }

  // Generate Action
  if (action === 'generate') {
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY nao configurada.' });

    const ai = new GoogleGenAI({ apiKey });
    try {
      const targetArea = area_name || 'Saude';
      const targetTopic = topic_name || custom_topic_name || 'Geral';
      const alternativesCount = is_contest_highlight ? 5 : 4;
      
      // Log the request for debugging
      console.log('AI Generation Request:', {
        area: targetArea,
        topic: targetTopic,
        count,
        difficulty,
        alternativesCount,
        hasContext: Boolean(context),
        contextLength: context?.length || 0
      });

      const response = await ai.models.generateContent({
        model: modelName,
        contents: buildQuestionsPrompt({
          area: targetArea,
          topic: targetTopic,
          count: count || 5,
          difficulty: difficulty || 'medium',
          rawContent: context || '',
          alternativesCount,
        }),
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (!response.text) throw new Error('O Gemini respondeu vazio.');

      // Log da resposta bruta para debugging
      console.log('Raw AI Response:', response.text);
      
      // Tentar extrair JSON da resposta
      let jsonText = response.text;
      
      // Se a resposta contiver texto antes do JSON, tentar extrair apenas o JSON
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
        console.log('Extracted JSON:', jsonText);
      }
      
      // Tentar fazer parse com tratamento de erro
      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch (parseError: any) {
        console.error('JSON Parse Error:', parseError);
        console.error('Response text:', jsonText);
        
        // Tentar limpar o texto e fazer parse novamente
        const cleanedText = jsonText
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remover caracteres de controle
          .replace(/\\n/g, '\\\\n') // Escapar newlines
          .replace(/\\"/g, '\\\\"') // Escapar quotes
          .trim();
        
        try {
          parsed = JSON.parse(cleanedText);
          console.log('Successfully parsed after cleaning');
        } catch (secondError: any) {
          console.error('Second parse attempt failed:', secondError);
          throw new Error(`A IA retornou JSON inválido: ${parseError.message}. Resposta: "${jsonText.substring(0, 200)}..."`);
        }
      }
      
      // Log the response for debugging
      console.log('AI Generation Response:', {
        questionsGenerated: parsed.questions?.length || 0,
        expectedCount: count || 5,
        modelUsed: modelName
      });
      
      // Validate the generated questions
      const validation = validateGeneratedQuestions(parsed, alternativesCount);
      if (validation.errors.length > 0) {
        console.error('Validation errors:', validation.errors);
        if (validation.warnings.length > 0) {
          console.warn('Validation warnings:', validation.warnings);
        }
        return res.status(422).json({ 
          error: 'A IA gerou questoes com problemas de validacao',
          details: validation.errors,
          warnings: validation.warnings
        });
      }
      
      if (validation.warnings.length > 0) {
        console.warn('Validation warnings:', validation.warnings);
      }
      
      // Temporal validation - check for outdated concepts
      const temporalIssues: string[] = [];
      parsed.questions.forEach((q: any, index: number) => {
        const temporalValidation = validateTemporalConcepts(q.question);
        const explanationValidation = validateTemporalConcepts(q.explanation || '');
        
        if (!temporalValidation.isValid) {
          temporalIssues.push(`Questao ${index + 1}: ${temporalValidation.issues.map(i => i.issue).join(', ')}`);
        }
        if (!explanationValidation.isValid) {
          temporalIssues.push(`Explicacao Questao ${index + 1}: ${explanationValidation.issues.map(i => i.issue).join(', ')}`);
        }
        
        // Also check alternatives
        q.alternatives.forEach((alt: any, altIndex: number) => {
          const altValidation = validateTemporalConcepts(alt.text);
          if (!altValidation.isValid) {
            temporalIssues.push(`Questao ${index + 1}, Alternativa ${altIndex + 1}: ${altValidation.issues.map(i => i.issue).join(', ')}`);
          }
        });
      });
      
      if (temporalIssues.length > 0) {
        console.error('Temporal validation errors:', temporalIssues);
        return res.status(422).json({ 
          error: 'A IA gerou questoes com conceitos desatualizados',
          details: temporalIssues
        });
      }
      
      // Incluir metadados para o salvamento posterior
      return res.status(200).json({
        ...parsed,
        area_id,
        topic_id,
        custom_topic_name,
        is_contest_highlight
      });
    } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) });
    }
  }

  return res.status(400).json({ error: 'Acao invalida.' });
}
