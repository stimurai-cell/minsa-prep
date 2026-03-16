// Test script to debug the API issue

async function testAPI() {
  try {
    console.log('Testing API status...');
    
    const response = await fetch('https://minsa-prep.vercel.app/api/generate-questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'status'
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('Response body:', text);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAPI();
