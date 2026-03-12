import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL + '/rest/v1/topics?select=id,name,area_id,areas!inner(id,name)';
const key = process.env.VITE_SUPABASE_ANON_KEY;

async function run() {
    const res = await fetch(url, {
        headers: {
            'apikey': key as string,
            'Authorization': 'Bearer ' + key
        }
    });
    const data = await res.json();

    // Encontrar área Farmácia e Enfermagem
    const farmacia = data.find((d: any) => d.areas.name.toLowerCase().includes('farm'));
    const enfermagem = data.find((d: any) => d.areas.name === 'Enfermagem' || d.areas.name.toLowerCase().includes('enferm'));

    console.log('Area Enfermagem:', enfermagem?.areas);
    console.log('Area Farmácia:', farmacia?.areas);

    // Encontrar Sinais Vitais
    const sinaisVitais = data.filter((d: any) => d.name.toLowerCase().includes('sinais vitais'));
    console.log('Sinais Vitais encontrados:', JSON.stringify(sinaisVitais, null, 2));

    const normais = data.filter((d: any) => d.name.toLowerCase().includes('boas praticas') || d.name.toLowerCase().includes('boas práticas'));
    console.log('boas praticas encontrados:', JSON.stringify(normais, null, 2));
}

run();
