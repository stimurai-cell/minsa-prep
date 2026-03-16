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
ESPECIALISTA EM CONCURSOS DE SAÚDE EM ANGOLA
ÁREA: ${area}
TÓPICO: ${topic}
QUANTIDADE: ${count} questões
DIFICULDADE: ${difficulty}
ALTERNATIVAS: ${alternativesCount}

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
        {"text": "Opção D", "isCorrect": false}${
          alternativesCount === 5 ? `,
        {"text": "Opção E", "isCorrect": false}` : ''
        }
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

const validateGeneratedQuestions = (data: any, expectedAlts: number, expectedCount: number) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!data || !data.questions || !Array.isArray(data.questions)) {
    errors.push('Formato invalido: "questions" deve ser um array');
    return { errors, warnings };
  }
  
  // Verificar se o número de questões está correto
  if (data.questions.length !== expectedCount) {
    errors.push(`Quantidade de questões incorreta: esperado ${expectedCount}, recebido ${data.questions.length}`);
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
    
    // Validação adicional: verificar se há alternativas duplicadas
    const alternativeTexts = q.alternatives.map((a: any) => a.text.toLowerCase().trim());
    const duplicates = alternativeTexts.filter((text: string, i: number) => alternativeTexts.indexOf(text) !== i);
    if (duplicates.length > 0) {
      errors.push(`Questao ${index + 1}: Existem alternativas duplicadas: ${duplicates.join(', ')}`);
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
      
      // Função robusta para extrair JSON
      const extractJSON = (text: string): any => {
        console.log('Attempting to extract JSON from:', text.substring(0, 200));
        
        // Método 1: Procurar por JSON completo entre { e }
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          const jsonText = text.substring(jsonStart, jsonEnd + 1);
          console.log('Extracted JSON substring:', jsonText.substring(0, 100));
          
          // Tentar fazer parse
          try {
            const parsed = JSON.parse(jsonText);
            console.log('Successfully parsed JSON');
            return parsed;
          } catch (error: any) {
            console.log('Direct parse failed, trying cleaning...');
          }
          
          // Método 2: Limpar e tentar novamente
          const cleaned = jsonText
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remover caracteres de controle
            .replace(/\\n/g, '\\\\n') // Corrigir newlines
            .replace(/\\r/g, '\\\\r') // Corrigir carriage returns
            .replace(/\\t/g, '\\\\t') // Corrigir tabs
            .replace(/\\"/g, '\\\\"') // Corrigir quotes
            .trim();
          
          try {
            const parsed = JSON.parse(cleaned);
            console.log('Successfully parsed after cleaning');
            return parsed;
          } catch (error: any) {
            console.log('Cleaned parse failed, trying regex...');
          }
        }
        
        // Método 3: Usar regex para encontrar JSON
        const jsonRegex = /\{[\s\S]*\}/;
        const match = text.match(jsonRegex);
        
        if (match) {
          console.log('Found JSON with regex');
          try {
            const parsed = JSON.parse(match[0]);
            console.log('Successfully parsed regex match');
            return parsed;
          } catch (error: any) {
            console.log('Regex parse failed');
          }
        }
        
        // Método 4: Tentar eval como último recurso
        try {
          console.log('Trying eval as last resort...');
          const evalText = text.substring(jsonStart || text.indexOf('{'), jsonEnd || text.lastIndexOf('}') + 1);
          const result = eval(`(${evalText})`);
          console.log('Eval succeeded');
          return result;
        } catch (error: any) {
          console.log('Eval failed');
        }
        
        throw new Error('Não foi possível extrair JSON válido da resposta');
      };
      
      // Tentar extrair e fazer parse do JSON
      let parsed;
      try {
        parsed = extractJSON(response.text);
      } catch (error: any) {
        console.error('All JSON extraction attempts failed:', error);
        console.error('Original response:', response.text);
        
        // Se tudo falhar, tentar gerar uma resposta de erro estruturada
        throw new Error(`A IA retornou uma resposta inválida. Erro: ${error.message}. Resposta recebida: "${response.text.substring(0, 300)}..."`);
      }
      
      // Log the response for debugging
      console.log('AI Generation Response:', {
        questionsGenerated: parsed.questions?.length || 0,
        expectedCount: count || 5,
        modelUsed: modelName
      });
      
      // Validate the generated questions
      const validation = validateGeneratedQuestions(parsed, alternativesCount, count || 5);
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
