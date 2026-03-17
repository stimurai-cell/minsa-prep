import express from 'express';
import handler from './generate-questions';
import eliteProfileHandler from './elite-profile';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.post('/api/generate-questions', (req, res) => {
  // Reutiliza o handler serverless no ambiente local
  return handler(req, res);
});

app.post('/api/elite-profile', (req, res) => {
  return eliteProfileHandler(req, res);
});

const port = process.env.API_PORT || 8788;
app.listen(port, () => {
  console.log(`[dev-api] listening on http://localhost:${port}`);
});
