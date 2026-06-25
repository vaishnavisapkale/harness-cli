import { FunctionResponse, GoogleGenAI } from "@google/genai";
import { Provider, GenerateInput, GenerateResult, NeutralMessage } from "./types";


async function withRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
    let lastErr: any;
    for (let i = 0; i < tries; i++) {
        try {
            return await fn();
        } catch (e: any) {
            const info = `${e?.status ?? ""} ${e?.code ?? ""} ${e?.message ?? e}`;
            const retriable =
                /\b(429|500|503)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL|overloaded|high demand/i.test(info);
            if (!retriable || i === tries - 1) throw e;
            lastErr = e;
            const wait = 1000 * 2 ** i; // 1s, 2s, 4s, 8s, 16s
            await new Promise((r) => setTimeout(r, wait));
        }
    }
    throw lastErr;
}

function toGeminiContents(message: NeutralMessage[]) {
    return message
        .map((m) => {
            if (m.role == "tool") {
                return {
                    role: "user",
                    parts: [{
                        functionResponse: {
                            name: m.toolName,
                            response:
                                { result: m.toolResult ?? "" },

                        }
                    }]
                }
            }
            if (m.role == "assistant") {
                const parts: any[] = [];
                if (m.text) {
                    parts.push({ text: m.text })
                }
                for (const c of m.toolCalls ?? []) {
                    parts.push({
                        functionCall: {
                            name: c.name,
                            args: c.args
                        }
                    });
                }
                return {
                    role: "model",
                    parts
                };
            }
            if (m.role == "user") {
                return {
                    role: "user",
                    parts: [{
                        text: m.text ?? ""
                    }]
                }
            }

            return undefined;
        })
        .filter((content): content is any => content !== undefined)
}

export const geminiProvider: Provider = {
    async generate({model,apiKey,system,messages,tools}: GenerateInput): Promise<GenerateResult> {
        const client = new GoogleGenAI({
            apiKey
        });
        const response = await withRetry(() =>
            client.models.generateContent({
                model,
                contents: toGeminiContents(messages),
                config: { systemInstruction: system, tools: [{ functionDeclarations: tools }] },
            })
        );
        const parts = response.candidates?.[0]?.content?.parts ?? [];
        const text = parts.map((p: any) => p.text || "").join("");

        const toolCalls = parts
            .filter((p: any) => p.functionCall)
            .map((p: any) => ({ name: p.functionCall.name, args: p.functionCall.args ?? {} }));

        return { text, toolCalls };
    }
}
