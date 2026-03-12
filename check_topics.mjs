import { createClient } from '@supabase/supabase-client';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkTopic() {
    const { data: topics, error } = await supabase
        .from('topics')
        .select(`
            id, 
            name, 
            area_id, 
            areas!inner(name)
        `);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(JSON.stringify(topics, null, 2));
}

checkTopic();
