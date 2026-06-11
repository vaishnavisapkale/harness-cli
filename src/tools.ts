import { Type } from "@google/genai";
import {
    readFileSync,
    readdirSync,
    existsSync,
    writeFileSync,
    mkdirSync,
} from "fs";
import { dirname, resolve, relative, isAbsolute } from "path";
import { spawnSync } from "child_process";

// === Bench / YOLO mode ===
// Set HARNESS_UNSAFE=1 to drop the guardrails (for a sandbox or terminal-bench container).
// Unset (default) keeps the safe guardrails for normal/demo use.
const UNSAFE = process.env.HARNESS_UNSAFE === "1";

// GUARDRAIL 1: path sandbox (skipped in UNSAFE mode)
function resolveSafe(p: string) {
    const root = process.cwd();
    const full = resolve(root, p);
    if (UNSAFE) return full; // benchmark: allow any path
    const rel = relative(root, full);
    if (rel.startsWith("..") || isAbsolute(rel)) {
        throw new Error(`Path ${p} is out of the Project.`);
    }
    return full;
}

// GUARDRAIL 2: run_command allowlist (only enforced in safe mode)
const ALLOWED_COMMANDS = [
    "bun test",
    "bun tsc --noEmit",
    "tsc --noEmit",
    "bun run typecheck",
    "bun run build",
    "git status",
    "git diff",
];

export const tools = [
    {
        functionDeclarations: [
            {
                name: "read_file",
                description: "read the content of the file",
                parameters: {
                    type: Type.OBJECT,
                    properties: { path: { type: Type.STRING } },
                    required: ["path"],
                },
            },
            {
                name: "list_file",
                description: "List files in a directory",
                parameters: {
                    type: Type.OBJECT,
                    properties: { path: { type: Type.STRING } },
                    required: ["path"],
                },
            },
            {
                name: "file_exists",
                description: "check if the file exists",
                parameters: {
                    type: Type.OBJECT,
                    properties: { path: { type: Type.STRING } },
                    required: ["path"],
                },
            },
            {
                name: "edit_file",
                description:
                    "Fix or change code by replacing an exact string in a file. old_str must appear exactly once in the file.",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        path: { type: Type.STRING, description: "file to edit" },
                        old_str: { type: Type.STRING, description: "exact text to find" },
                        new_str: { type: Type.STRING, description: "replacement text" },
                    },
                    required: ["path", "old_str", "new_str"],
                },
            },
            {
                name: "write_file",
                description:
                    "Create a file or fully overwrite an existing one. Creates parent directories as needed.",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        path: { type: Type.STRING },
                        content: { type: Type.STRING },
                    },
                    required: ["path", "content"],
                },
            },
            {
                name: "bash",
                description:
                    "Run a shell command and return its stdout, stderr and exit code. Use this to explore (ls, cat, grep, find), run tests, install packages, build, and run programs.",
                parameters: {
                    type: Type.OBJECT,
                    properties: { command: { type: Type.STRING } },
                    required: ["command"],
                },
            },
        ],
    },
];

const toolRegistry = {
    read_file: ({ path }: { path: string }) => readFileSync(resolveSafe(path), "utf-8"),

    list_file: ({ path }: { path: string }) => readdirSync(resolveSafe(path)).join("\n"),

    file_exists: ({ path }: { path: string }) => String(existsSync(resolveSafe(path))),

    edit_file: ({ path, old_str, new_str }: { path: string; old_str: string; new_str: string }) => {
        const full = resolveSafe(path);
        if (!existsSync(full)) return `Error: file not found: ${path}`;
        const content = readFileSync(full, "utf-8");
        const count = content.split(old_str).length - 1;
        if (count == 0) return `Error: old_str not found in ${path}`;
        if (count > 1) return `Error: old_str appears ${count} times in ${path}`;
        writeFileSync(full, content.replace(old_str, new_str));
        return `Edited ${path}`;
    },

    write_file: ({ path, content }: { path: string; content: string }) => {
        const full = resolveSafe(path);
        // Safe mode keeps the "no overwrite" guard; UNSAFE allows overwrite (needed for real tasks).
        if (!UNSAFE && existsSync(full)) return `Error: ${path} already exists`;
        mkdirSync(dirname(full) || ".", { recursive: true });
        writeFileSync(full, content);
        return `Wrote ${path} (${(content ?? "").length} chars)`;
    },

    bash: ({ command }: { command: string }) => {
        const cmd = command.trim();

        if (UNSAFE) {
            // full power: run anything via a real shell
            const r = spawnSync("bash", ["-c", cmd], {
                cwd: process.cwd(),
                timeout: 120_000,
                encoding: "utf-8",
                maxBuffer: 10 * 1024 * 1024,
            });
            if (r.error) return `Error: ${r.error.message}`;
            const out = (r.stdout || "") + (r.stderr ? `\n[stderr]\n${r.stderr}` : "");
            return `exit_code: ${r.status}\n${out}`.slice(0, 30_000);
        }

        // safe mode: block shell metachars + enforce allowlist
        if (/[;&|`$(){}<>\\]/.test(cmd)) {
            return "Error: command contains forbidden shell characters";
        }
        const ok = ALLOWED_COMMANDS.some((c) => cmd === c || cmd.startsWith(c + " "));
        if (!ok) {
            return `Error: "${cmd}" not allowed. Allowed: ${ALLOWED_COMMANDS.join(", ")}`;
        }
        const [bin, ...args] = cmd.split(/\s+/);
        const r = spawnSync(bin, args, {
            cwd: process.cwd(),
            timeout: 30_000,
            encoding: "utf-8",
            shell: false,
        });
        if (r.error) return `Error: ${r.error.message}`;
        return `exit code ${r.status}\n${(r.stdout || "") + (r.stderr || "")}`.slice(0, 5000);
    },
};

export function runTool(toolName: string, args: any) {
    const tool = toolRegistry[toolName as keyof typeof toolRegistry];
    if (!tool) return `Error: unknown tool "${toolName}"`;
    try {
        return tool(args ?? {});
    } catch (error: any) {
        // Return the error as a string so the model SEES it and can self-correct.
        return `Error running ${toolName}: ${error?.message ?? String(error)}`;
    }
}
