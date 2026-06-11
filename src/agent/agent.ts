import { runTool, tools } from "../tools";
import { resolveSession } from "./resolve";
import { getProvider } from "../providers";
import { NeutralMessage } from "../providers/types";

export type AgentEvent =
    | { type: "text"; text: string }
    | { type: "tool_call"; name: string; args: any }
    | { type: "tool_result"; name: string; result: any }
    | { type: "done"; text: string };

export const BASE_SYSTEM_INSTRUCTION = `You are a coding agent working directly in a real terminal in the user's project.

Available tools:
- bash(command): run ANY shell command — ls, cat, grep, find, run tests, install dependencies, build, and run programs. Use this constantly to explore and to verify your work.
- read_file(path): read a file's contents.
- list_file(path), file_exists(path): inspect the project.
- write_file(path, content): create or fully overwrite a file.
- edit_file(path, old_str, new_str): change a unique exact string in an existing file.

How to work:
- Explore first. Use bash (ls, cat, grep, find) and read_file to understand the project before changing anything.
- Take real actions with tools. Never claim something is done unless a tool actually did it.
- If a tool result starts with "Error" or shows a non-zero exit code, the action FAILED — read the message and fix your approach. Do NOT fake success.
- Prefer bash for inspecting and running things; use write_file / edit_file for code changes.
- Verify your work by running it (tests, build, or the program) with bash before finishing.
- When the task is fully complete, stop calling tools and give a short summary of what you ACTUALLY changed.

Be decisive and efficient. Keep going until the task is genuinely done.`;

export async function runAgent(
    prompt: string,
    onEvent: (e: AgentEvent) => void = () => { },
    history: NeutralMessage[] = []
) {
    const { provider, apiKey, model } = resolveSession();
    const llm = getProvider(provider);

    history.push({ role: "user", text: prompt });
    let steps = 0;
    const MAX_STEPS = 50; 

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
