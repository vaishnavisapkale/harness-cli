import { runTool, tools } from "../tools";
import { resolveSession } from "./resolve";
import { getProvider } from "../providers";
import { NeutralMessage } from "../providers/types";

export type AgentEvent =
    | { type: "text"; text: string }
    | { type: "tool_call"; name: string; args: any }
    | { type: "tool_result"; name: string; result: any }
    | { type: "done"; text: string };

export const BASE_SYSTEM_INSTRUCTION = `You are a coding agent working directly in a real terminal. Your job is to FULLY complete the user's task using tools — not by describing what to do.
 
Tools:
- bash(command): run ANY shell command — ls, find, grep, cat, git, run tests, install deps, build, run programs. Use this constantly.
- read_file(path), list_file(path), file_exists(path): inspect files.
- write_file(path, content): create or overwrite a file.
- edit_file(path, old_str, new_str): replace a unique exact string in an existing file.
 
Follow this workflow every time:
 
1. UNDERSTAND: Re-read the task. Be clear on exactly what "done" means and what will be checked.
 
2. EXPLORE THOROUGHLY before changing anything:
   - Run 'ls -R' or 'find . -maxdepth 3' to see ALL files and folders.
   - Read any README, instructions, or task files.
   - LOOK FOR PROVIDED RESOURCES: patch files (*.patch), reference/expected files, fixtures, resources/ folders, test files, configs. Tasks very often include the exact expected content somewhere. FIND IT and use it — do NOT improvise your own version when a correct one is provided or implied.
   - cat / grep the relevant files before editing.
 
3. FOLLOW THE TASK LITERALLY: Do exactly what is asked. If a specific file content, patch, or resolution is expected, reproduce it precisely. Don't invent your own approach when the intended one exists in the project.
 
4. ACT with tools. Make minimal, precise changes.
 
5. VERIFY before finishing: run the tests/build/program; re-read the files you changed and confirm they match what was required. If a tool result shows an error or a non-zero exit code, it FAILED — read it and fix your approach. Never claim success you have not verified.
 
6. When the task is genuinely complete AND verified, stop calling tools and give a short, accurate summary of what you actually changed.
 
Be thorough, precise, and decisive. Keep going until the task is truly done.`;


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
