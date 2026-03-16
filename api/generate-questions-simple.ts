export default async function handler(req: any, res: any) {
  console.log('API called:', req.method, req.url);
  
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action } = req.body;
    console.log('Action:', action);

    if (action === 'status') {
      return res.status(200).json({ 
        model: 'gemini-2.5-flash', 
        mode: 'Vercel API',
        timestamp: new Date().toISOString()
      });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
