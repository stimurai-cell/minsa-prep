/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import { normalizeRuntimeEnv } from './env';

const supabaseUrl = normalizeRuntimeEnv(import.meta.env.VITE_SUPABASE_URL) || 'https://placeholder-url.supabase.co';
const supabaseKey = normalizeRuntimeEnv(import.meta.env.VITE_SUPABASE_ANON_KEY) || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseKey);
