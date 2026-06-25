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
// HARNESS_UNSAFE=1  -> no path sandbox, no approval prompts (benchmark container).
// Unset (default)   -> path sandbox on for file tools; the APPROVAL GATE in agent.ts
//                      asks the user before destructive shell commands.
const UNSAFE = process.env.HARNESS_UNSAFE === "1";

function resolveSafe(p: string) {
    const root = process.cwd();
    const full = resolve(root, p);
    if (UNSAFE) return full;
    const rel = relative(root, full);
    if (rel.startsWith("..") || isAbsolute(rel)) {
        throw new Error(`Path ${p} is out of the project.`);
    }
    return full;
}

export const tools = [
    {
        functionDeclarations: [
            {
                name: "read_file",
                description: "Read the content of a file.",
                parameters: {
                    type: Type.OBJECT,
                    properties: { path: { type: Type.STRING } },
                    required: ["path"],
                },
            },
            {
                name: "list_file",
                description: "List files in a directory.",
                parameters: {
                    type: Type.OBJECT,
                    properties: { path: { type: Type.STRING } },
                    required: ["path"],
                },
            },
            {
                name: "file_exists",
                description: "Check if a file exists.",
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
                    "Run a shell command and return its stdout, stderr and exit code. Use this to explore (ls, cat, grep, find), manage files (rm, mv, mkdir), run tests, install packages, build, and run programs.",
                parameters: {
                    type: Type.OBJECT,
                    properties: { command: { type: Type.STRING } },
                    required: ["command"],
                },
            },
            {
                name: "ask_questions",
                description:"ask the user a clearifying question. use BEFORE starting if the requirement is unclear",
                parameters:{
                    type: Type.STRING,
                    properties:{question: {type: Type.STRING}},
                    required: ["question"],
                }
            },
            {
                name:"create_todos",
                description: "break a big or complex project into multiple check list",
                parameters:{
                    type: Type.OBJECT,
                    properties:{tasks:{type:Type.ARRAY, items:Type.STRING}},
                    required: ["tasks"],
                }
            }
        ],
    },
];

const MAX_OUTPUT = 30000;

const toolRegistry = {
    read_file: ({ path }: { path: string }) =>
        readFileSync(resolveSafe(path), "utf-8").slice(0, MAX_OUTPUT),

    list_file: ({ path }: { path: string }) =>
        readdirSync(resolveSafe(path)).join("\n").slice(0, MAX_OUTPUT),

    file_exists: ({ path }: { path: string }) => String(existsSync(resolveSafe(path))),

    edit_file: ({ path, old_str, new_str }: { path: string; old_str: string; new_str: string }) => {
        const full = resolveSafe(path);
        if (!existsSync(full)) return `Error: file not found: ${path}`;
        const content = readFileSync(full, "utf-8");
        const count = content.split(old_str).length - 1;
        if (count == 0) return `Error: old_str not found in ${path}`;
        if (count > 1) return `Error: old_str appears ${count} times in ${path}. Make it unique.`;
        writeFileSync(full, content.replace(old_str, new_str));
        return `Edited ${path}`;
    },

    write_file: ({ path, content }: { path: string; content: string }) => {
        const full = resolveSafe(path);
        mkdirSync(dirname(full) || ".", { recursive: true });
        writeFileSync(full, content);
        return `Wrote ${path} (${(content ?? "").length} chars)`;
    },

    bash: ({ command }: { command: string }) => {
        const cmd = command.trim();
        const r = spawnSync("bash", ["-c", cmd], {
            cwd: process.cwd(),
            timeout: 120_000,
            encoding: "utf-8",
            maxBuffer: 10 * 1024 * 1024,
        });
        if (r.error) return `Error: ${r.error.message}`;
        const out = (r.stdout || "") + (r.stderr ? `\n[stderr]\n${r.stderr}` : "");
        return `exit_code: ${r.status}\n${out}`.slice(0, MAX_OUTPUT);
    },
    ask_question:({question}:{question:string})=>{
        return `Question for user: ${question}`;
    },
   create_todos:({tasks}:{tasks:string[]})=>{
    return `created todos: ${tasks.join(", ")}`;
   }
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
