import { runTool, tools } from "../tools";
import { resolveSession } from "./resolve";
import { getProvider } from "../providers";
import { NeutralMessage } from "../providers/types";
import { requestApproval } from "./approval";

export type AgentEvent =
    | { type: "text"; text: string }
    | { type: "tool_call"; name: string; args: any }
    | { type: "tool_result"; name: string; result: any }
    | { type: "approval_request"; command: string }
    | { type: "done"; text: string };

// Skip approval prompts in benchmark / unattended mode.
const SKIP_APPROVAL = !!(process.env.HARNESS_UNSAFE || process.env.HARNESS_YOLO);

// Commands that can delete/overwrite/break things -> ask the user first.
function isDangerousCommand(cmd: string): boolean {
    const c = cmd || "";
    const patterns = [
        /\brm\s/i,                                   // ANY rm (rm file, rm -rf, rm -f ...)
        /\brmdir\b/i,
        /\bunlink\s/i,                               // unlink file
        /-delete\b/i,                                // find ... -delete
        /\b(dd|mkfs|shred|truncate)\b/i,
        /\bchmod\s+-R\b/i,
        /\bchown\s+-R\b/i,
        /\bgit\s+(reset\s+--hard|clean\s+-\w*f|push\s+(--force|-f))\b/i,
        /\bsudo\b/i,
        /:\s*\(\s*\)\s*\{.*\}\s*;/,                   // fork bomb
        />\s*\/(etc|usr|bin|boot|dev|sys|var)\b/i,    // overwrite system paths
        /\bmv\s+.*\s+\/dev\/null\b/i,                 // mv file /dev/null = delete
    ];
    return patterns.some((p) => p.test(c));
}

export const BASE_SYSTEM_INSTRUCTION = `You are a coding agent working directly in a real terminal. Your job is to FULLY complete the user's task using tools — not by describing what to do.

Tools:
- bash(command): run ANY shell command — ls, find, grep, cat, git, rm, mv, mkdir, run tests, install deps, build, run programs. Use this constantly.
- read_file(path), list_file(path), file_exists(path): inspect files.
- write_file(path, content): create or overwrite a file.
- edit_file(path, old_str, new_str): replace a unique exact string in an existing file.

PERMISSIONS — never ask for confirmation in your text:
- Just DO the task by calling tools. The harness AUTOMATICALLY prompts the user to approve any dangerous command (rm, dd, etc.) before it runs.
- So do NOT write "Do you want me to...?", "Please confirm...", or "I cannot run X without confirmation." Those are handled for you.
- To delete node_modules, simply call bash with the command 'rm -rf node_modules'. If approval is needed, the user is asked automatically — outside your control. Do not stall or refuse destructive commands for safety; the approval system already protects the user.

Workflow:

1. UNDERSTAND: Re-read the task. Be clear on exactly what "done" means.

2. EXPLORE before changing anything: 'ls -R' / 'find . -maxdepth 3', read README/instructions, LOOK FOR provided resources (patch files, expected/reference files, fixtures) and use them exactly — don't improvise when the intended answer exists. cat/grep relevant files before editing.

3. FOLLOW THE TASK LITERALLY. Reproduce expected content/patches precisely.

4. ACT with tools. Make minimal, precise changes. Call the tool directly — don't describe what you "would" do.

5. VERIFY before finishing: run tests/build/program; re-read changed files. If a tool result shows an error or non-zero exit code, it FAILED — fix it. Never claim success you have not verified.

6. When the task is genuinely complete AND verified, stop calling tools and give a short, accurate summary of what you actually changed.
 
7. use ask_questions(question) to ask the user a clarifying question if the requirement is unclear. Use it BEFORE starting if the requirement is unclear.
8. use create_todos(tasks) to break a big or complex project into multiple check list if the requirement is complex. Use it BEFORE starting if the requirement is complex.

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

            // --- permission gate for destructive commands ---
            if (!SKIP_APPROVAL && call.name === "bash" && isDangerousCommand(call.args?.command ?? "")) {
                onEvent({ type: "approval_request", command: call.args.command });
                const approved = await requestApproval(); // PAUSES here until user presses Y/N
                if (!approved) {
                    const denied = "Denied by user. Command was NOT run. Do not retry it; continue with the rest of the task or stop.";
                    onEvent({ type: "tool_result", name: call.name, result: denied });
                    history.push({ role: "tool", toolName: call.name, toolResult: denied });
                    continue;
                }
            }

            const result = await runTool(call.name, call.args);
            onEvent({ type: "tool_result", name: call.name, result });
            history.push({ role: "tool", toolName: call.name, toolResult: result });
        }
    }

    history.push({ role: "assistant", text: "Max steps reached" });
    onEvent({ type: "done", text: "Max steps reached" });
    return "Max steps reached";
}