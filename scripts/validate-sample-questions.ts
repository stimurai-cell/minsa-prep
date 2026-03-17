// Simple gate to validate a sample payload shape before deploy.
import { _validateQuestionsForTest as validate } from '../api/generate-questions';

const sample = [
  {
    question: 'O que é o Sistema Nacional de Saúde em Angola?',
    alternatives: [
      { text: 'Um conjunto de serviços públicos e privados', isCorrect: true },
      { text: 'Apenas hospitais privados', isCorrect: false },
      { text: 'Somente clínicas militares', isCorrect: false },
      { text: 'Nenhuma das alternativas', isCorrect: false },
    ],
    explanation: 'Exemplo de pergunta válida',
    difficulty: 'easy',
  },
];

const errors = validate(sample as any, 4);
if (errors.length) {
  console.error('Validação falhou:', errors);
  process.exit(1);
}

console.log('Validação de payload IA passou ✅');
