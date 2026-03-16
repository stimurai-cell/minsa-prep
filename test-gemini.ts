
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function test() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API key found in .env");
        return;
    }

    const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    console.log(`Using API Key starting with: ${apiKey.substring(0, 5)}...`);
    console.log(`Testing model: ${modelName}`);

    try {
        // Correct usage for this specific @google/genai version
        const genAI = new GoogleGenAI({ apiKey });
        const model = genAI.models.get(modelName);

        // Testing a simple generation
        console.log("Attempting to generate content...");
        const result = await genAI.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: "Respond with 'OK' if you can hear me." }] }],
        });

        console.log("Response successful!");
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (error: any) {
        console.error("Error during generation:");
        console.error(error.message || error);
        if (error.stack) console.error(error.stack);
    }
}

test();
