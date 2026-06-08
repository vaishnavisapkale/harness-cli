import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-2.5-flash";

export async function generateGemini(
    apiKey: string,
    contents: [],
    systemInstruction: string,
    tools?: any[]
) {
    const client = new GoogleGenAI({
        apiKey
    });
    return client.models.generateContent({
        model: MODEL,
        contents,
        config: {
            systemInstruction,
            tools
        }
    })
}