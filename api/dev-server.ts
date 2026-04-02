import dotenv from 'dotenv';
import express from 'express';

dotenv.config({ path: '.env.local', override: true });
dotenv.config({ path: '.env' });

const [{ default: handler }, { default: eliteProfileHandler }] = await Promise.all([
  import('./generate-questions'),
  import('./elite-profile'),
]);

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
