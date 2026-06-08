import { GoogleGenAI } from "@google/genai";
import { runTool, tools } from "../tools";
import { resolveSession } from "./resolve";
import { getProvider } from "../providers";
import { NeutralMessage } from "../providers/types";


export type AgentEvent =
    | { type: "text"; text: string }
    | { type: "tool_call"; name: string; args: any }
    | { type: "tool_result"; name: string; result: any }
    | { type: "done"; text: string };

export const BASE_SYSTEM_INSTRUCTION = `You are a coding agent working directly in the user's project.

Available tools: read_file, list_file, file_exists, edit_file, write_file.

How to work:
- Before editing, explore: use list_file and read_file to find the exact place to change.
- Use write_file ONLY for new files. Use edit_file to change existing files.
- Make the smallest change that satisfies the request.
- After every tool call, READ the result. If the result starts with "Error", the action FAILED — do NOT claim success. Report the error and try a different approach.
- At the end, summarize what you ACTUALLY changed (which files), based on the tool results. Never invent success.`;

export async function runAgent(prompt: string,
    onEvent: (e: AgentEvent) => void = () => { },
    history: NeutralMessage[] = []
) {
    const { provider, apiKey, model } = resolveSession();
    const llm = getProvider(provider);

    // const messages: NeutralMessage[] = [{ role: "user", text: prompt }];
    history.push({ role: "user", text: prompt });
    let steps = 0;
    const MAX_STEPS = 10;

    while (steps < MAX_STEPS) {
        steps++;

        const { text, toolCalls } = await llm.generate({
            model,
            apiKey,
            system: BASE_SYSTEM_INSTRUCTION,
            messages: history,
            tools: tools[0].functionDeclarations,
        });

        if (toolCalls.length === 0) {
            history.push({ role: "assistant", text });
            onEvent({ type: "done", text });
            return text;
        }

        if (text) onEvent({ type: "text", text });
        history.push({ role: "assistant", text, toolCalls });


        for (const call of toolCalls) {
            onEvent({ type: "tool_call", name: call.name, args: call.args });
            const result = await runTool(call.name, call.args);
            onEvent({ type: "tool_result", name: call.name, result });
            history.push({ role: "tool", toolName: call.name, toolResult: result });
        }
    }
    history.push({ role: "assistant", text: "Max steps reached" });
    onEvent({ type: "done", text: "Max steps reached" });
    return "Max steps reached";
}