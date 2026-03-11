import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import type { IncomingMessage, ServerResponse } from 'http';

// Usar o service account gerado pelo Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: "farmolink-28",
            clientEmail: "firebase-adminsdk-fbsvc@farmolink-28.iam.gserviceaccount.com",
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || ""
        })
    });
}

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function send(res: ServerResponse, status: number, body: object) {
    const json = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(json);
}

// Mensagens motivacionais super amigáveis
const morningMessages = [
    { title: "Bom dia, futuro craque! 🌅", body: "Que tal 15 minutinhos de treino agora para começar o dia com o pé direito?" },
    { title: "Hora de brilhar! ✨", body: "O teu objetivo está cada dia mais perto. Faz algumas questões no MINSA Prep para manteres o ritmo!" },
    { title: "O café já está pronto? ☕", body: "Aproveita a energia da manhã e responde ao Desafio Diário de hoje!" }
];

const eveningMessages = [
    { title: "Boa noite, campeão! 🌙", body: "Já fizeste o teu treino de hoje? Ainda vais a tempo de não perder a ofensiva!" },
    { title: "Não deixes para amanhã... 🎯", body: "Aquilo que podes aprender hoje! Entra rápido e consolida o teu conhecimento antes de dormir." },
    { title: "Falta pouco para terminar o dia! ⏳", body: "Garante os teus XP de hoje e vê como subiste na liga. Bora treinar!" }
];

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    // Vercel Cron Jobs usam GET e um segredo para autorização, mas permitiremos POST para testes manuais
    if (req.method !== 'GET' && req.method !== 'POST') {
        return send(res, 405, { error: 'Method not allowed' });
    }

    // Cron job Authorization
    // Nota: Em produção deves configurar a VERCEL_CRON_SECRET nas variáveis de ambiente da Vercel
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.VERCEL_CRON_SECRET;

    // Verificamos apenas se a secret existir para não quebrar testes locais
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return send(res, 401, { error: 'Unauthorized' });
    }

    const hour = new Date().getHours();

    // Escolhe o pool de mensagens com base na hora do dia (Geralmente 9h ou 19h via vercel.json)
    const messagesPool = hour < 14 ? morningMessages : eveningMessages;
    const randomMessage = messagesPool[Math.floor(Math.random() * messagesPool.length)];

    try {
        const { data: subscriptions, error } = await supabase.from('push_subscriptions').select('endpoint, user_id');

        if (error) throw error;
        if (!subscriptions || subscriptions.length === 0) {
            return send(res, 200, { sent: 0, message: 'No subscriptions found' });
        }

        const tokens = subscriptions
            .map(sub => sub.endpoint)
            .filter(t => t && !t.startsWith('http'));

        if (tokens.length === 0) {
            return send(res, 200, { sent: 0, message: 'No valid FCM tokens found' });
        }

        const message = {
            notification: {
                title: randomMessage.title,
                body: randomMessage.body
            },
            data: {
                url: '/dashboard'
            },
            tokens: tokens,
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        // Limpeza de tokens inválidos
        if (response.failureCount > 0) {
            const failedTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                }
            });

            if (failedTokens.length > 0) {
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .in('endpoint', failedTokens);
            }
        }

        return send(res, 200, {
            sent: response.successCount,
            message: `Enviados ${response.successCount} avisos diários: ${randomMessage.title}`
        });
    } catch (err: any) {
        console.error('[cron-daily] Error:', err);
        return send(res, 500, { error: err.message });
    }
}
