import { createClient } from '@supabase/supabase-js';
import type { IncomingMessage, ServerResponse } from 'http';

let supabaseClient: ReturnType<typeof createClient> | null = null;

const getSupabase = () => {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = String(process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase env vars are missing for elite-profile API.');
  }

  supabaseClient = createClient(supabaseUrl, serviceRoleKey);
  return supabaseClient;
};

type EliteProfilePayload = {
  userId?: string;
  dailyStudyTime?: 'LOW' | 'MEDIUM' | 'HIGH' | 'INTENSIVE';
  examExperience?: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERIENCED';
  preferredStudyPeriod?: 'MORNING' | 'AFTERNOON' | 'EVENING';
  preferredStudyHour?: string;
  studyDays?: string[];
  selectedAreaId?: string | null;
};

function send(res: ServerResponse, status: number, body: Record<string, unknown>) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<EliteProfilePayload> {
  const parsedBody = (req as IncomingMessage & { body?: EliteProfilePayload }).body;
  if (parsedBody && typeof parsedBody === 'object') {
    return parsedBody;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? (JSON.parse(raw) as EliteProfilePayload) : {};
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabase();
    const body = await readJsonBody(req);
    const userId = body.userId?.trim();

    if (!userId) {
      return send(res, 400, { error: 'userId is required' });
    }

    const studyDays =
      body.studyDays && body.studyDays.length > 0
        ? body.studyDays
        : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    const profilePayload = {
      user_id: userId,
      daily_study_time: body.dailyStudyTime || 'MEDIUM',
      exam_experience: body.examExperience || 'BEGINNER',
      preferred_study_period: body.preferredStudyPeriod || 'EVENING',
      preferred_study_hour: body.preferredStudyHour || '21:00',
      study_days: studyDays,
      selected_area_id: body.selectedAreaId || null
    };

    const { error: eliteProfileError } = await supabase
      .from('elite_profiles')
      .upsert(profilePayload, { onConflict: 'user_id' });

    if (eliteProfileError) {
      return send(res, 500, {
        error: 'Failed to persist elite profile',
        details: eliteProfileError.message,
        code: eliteProfileError.code || null
      });
    }

    if (body.selectedAreaId) {
      const { error: profileSyncError } = await supabase
        .from('profiles')
        .update({ selected_area_id: body.selectedAreaId })
        .eq('id', userId);

      if (profileSyncError) {
        console.warn('Profile area sync error in elite-profile API:', profileSyncError);
      }
    }

    return send(res, 200, { ok: true });
  } catch (error) {
    console.error('elite-profile API error:', error);
    return send(res, 500, {
      error: 'Unexpected server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
