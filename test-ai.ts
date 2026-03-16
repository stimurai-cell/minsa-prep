import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('No GEMINI_API_KEY found in .env');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

async function test() {
    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: 'Say hello in JSON formatted as {"message": "hello"}',
            config: {
                responseMimeType: 'application/json',
            },
        });
        console.log('Success:', response.text);
    } catch (error) {
        console.error('Error detail:', error);
    }
}

test();
