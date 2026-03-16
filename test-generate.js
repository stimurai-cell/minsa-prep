const fetch = require('node-fetch');

async function testGenerateAPI() {
  try {
    console.log('Testing generate API...');
    
    const response = await fetch('http://localhost:3000/api/generate-questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'generate',
        area_name: 'Enfermagem',
        topic_name: 'Fundamentos de Enfermagem',
        count: 1,
        difficulty: 'easy',
        context: 'Teste de geração de perguntas'
      })
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (data.questions && data.questions.length > 0) {
      const question = data.questions[0];
      console.log('Question content:', question.content);
      console.log('Alternatives:', question.alternatives);
      console.log('Explanation:', question.explanation);
    }
    
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testGenerateAPI();
