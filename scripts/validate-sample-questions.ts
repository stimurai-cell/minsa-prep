import {
  _analyzeAlternativeBalanceForTest as analyzeAlternativeBalance,
  _validateQuestionsForTest as validate,
} from '../api/generate-questions';
import { resolveTopicGroundingHint } from '../api/_lib/topicGrounding';
import { validateTemporalConcepts } from '../src/lib/temporalValidation';

const balancedSample = [
  {
    question: 'Sobre manutencao preventiva em eletromedicina, assinale a alternativa correta.',
    alternatives: [
      { text: 'Substituir componentes conforme vida util e testes programados.', isCorrect: true },
      { text: 'Realizar limpeza externa sem registos tecnicos formais.', isCorrect: false },
      { text: 'Usar o equipamento sem checklist funcional documentada.', isCorrect: false },
      { text: 'Adiar calibracao ate surgir falha clinica evidente.', isCorrect: false },
    ],
    explanation: 'Exemplo de questao valida.',
    difficulty: 'medium',
  },
];

const visuallyBiasedSample = [
  {
    question: 'Sobre manutencao preventiva em eletromedicina, assinale a alternativa correta.',
    alternatives: [
      { text: 'Implementar avaliacao continua de riscos, como FMEA, para antecipar problemas.', isCorrect: true },
      { text: 'Confiar unicamente nas especificacoes do fabricante.', isCorrect: false },
      { text: 'Realizar inspecoes apenas apos falhas.', isCorrect: false },
      { text: 'Ignorar registos tecnicos periodicos.', isCorrect: false },
    ],
    explanation: 'Exemplo de questao com vies visual.',
    difficulty: 'medium',
  },
];

const balancedErrors = validate(balancedSample as any, 4);
if (balancedErrors.length) {
  console.error('Validacao falhou no caso equilibrado:', balancedErrors);
  process.exit(1);
}

const biasedErrors = validate(visuallyBiasedSample as any, 4);
if (!biasedErrors.some((error) => error.includes('visualmente maior'))) {
  console.error('Validacao nao bloqueou o caso regressivo:', biasedErrors);
  process.exit(1);
}

const proactiveSignal = analyzeAlternativeBalance(visuallyBiasedSample[0] as any);
if (!proactiveSignal.needsHarmonization) {
  console.error('A pre-harmonizacao nao sinalizou o caso regressivo:', proactiveSignal);
  process.exit(1);
}

const armedHint = resolveTopicGroundingHint({
  area: 'Farmacia',
  topic: 'ARMED',
});

if (armedHint.scopeMode !== 'institutional' || !armedHint.forceValidateWithWeb) {
  console.error('O enquadramento de ARMED nao ficou suficientemente rigoroso:', armedHint);
  process.exit(1);
}

const cultureHint = resolveTopicGroundingHint({
  area: 'Farmacia',
  topic: 'Cultura geral',
});

if (cultureHint.scopeMode !== 'general_culture' || !cultureHint.relaxAreaStrictness) {
  console.error('O enquadramento de cultura geral nao ficou correto:', cultureHint);
  process.exit(1);
}

const temporalValidation = validateTemporalConcepts('A INFARMED regula medicamentos em Angola.');
if (temporalValidation.isValid) {
  console.error('A validacao temporal deveria bloquear a troca entre INFARMED e Angola:', temporalValidation);
  process.exit(1);
}

console.log('Validacao de payload IA passou com cobertura de regressao, pre-harmonizacao e enquadramento tematico.');
