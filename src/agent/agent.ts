import { GoogleGenAI } from "@google/genai";
import { runTool, tools } from "../tools";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
});
const MODEL = "gemini-2.5-flash";

export const BASE_SYSTEM_INSTRUCTION =`You are a coding agent working directly in the user's project.

Available tools: read_file, list_file, file_exists, edit_file, write_file.

How to work:
- Before editing, explore: use list_file and read_file to find the exact place to change.
- Use write_file ONLY for new files. Use edit_file to change existing files.
- Make the smallest change that satisfies the request.
- After every tool call, READ the result. If the result starts with "Error", the action FAILED — do NOT claim success. Report the error and try a different approach.
- At the end, summarize what you ACTUALLY changed (which files), based on the tool results. Never invent success.`;

export async function runAgent(prompt: string) {
    const messages: any[] = [
        {
            role: "user",
            parts: [{ text: prompt }],
        },
    ];

    let shouldContinue = true;
    let steps = 0;
    const MAX_STEPS = 8;

    while (shouldContinue) {
        steps++;
        if (steps > MAX_STEPS) {
            return "Max steps reached";
        }

        const response = await ai.models.generateContent({
            model: MODEL,
            contents: messages,
            systemInstruction: BASE_SYSTEM_INSTRUCTION,
            config:{
            tools: [
                {
                    functionDeclarations: tools[0].functionDeclarations,
                },
            ],
            }

        } as any);

        const candidate = response.candidates?.[0]?.content;
        if (!candidate) return "No response from model";

        const parts = candidate.parts || [];

        // check if tool is called
        const toolCallPart = parts.find((p: any) => p.functionCall);


        if (!toolCallPart?.functionCall) {
            return parts.map((p: any) => p.text || "").join("");
        }

        const { name, args } = toolCallPart.functionCall;
        if (!name) {
            return "Tool name missing";
        }
        const toolResult = runTool(name, args);

        // save model step (tool request)
        messages.push({
            role: "model",
            parts,
        });

        // send tool result back to model
        messages.push({
            role: "user",
            parts: [
                {
                    functionResponse: {
                        name,
                        response: {
                            result: toolResult,
                        },
                    },
                },
            ],
        });
    }
}