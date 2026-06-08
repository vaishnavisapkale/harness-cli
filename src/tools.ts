import { Type } from "@google/genai";
import {
    readFileSync,
    readdirSync,
    existsSync,
    writeFileSync,
    mkdirSync,
} from "fs";
import { dirname, resolve, relative, isAbsolute } from "path";

function resolveSafe(p: string) {
    const root = process.cwd(); //current working directory
    const full = resolve(root, p) //convert relative path to absolute path
    const rel = relative(root, full);
    if ((rel.startsWith("..") || isAbsolute(rel))) {
        throw new Error(`Path ${p} is out of the Project.`)
    }
    return full
}

export const tools = [
    {
        functionDeclarations: [
            {
                name: "read_file",
                description: "read the content of the file",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        path: {
                            type: Type.STRING
                        }
                    },
                    required: ["path"]
                }
            },
            {
                name: "list_file",
                description: "List files in a directory",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        path: {
                            type: Type.STRING
                        }
                    },
                    required: ["path"]
                }
            },
            {
                name: "file_exists",
                description: "check if the file exists",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        path: {
                            type: Type.STRING
                        }
                    },
                    required: ["path"]
                }
            },
            {
                name: "edit_file",
                description: "Fix or change code by replacing an exact string in a file. old_str must appear exactly once in the file.",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        path: {
                            type: Type.STRING,
                            description: "file to edit"
                        },
                        old_str: {
                            type: Type.STRING,
                            description: "exact text to find"
                        },
                        new_str: {
                            type: Type.STRING,
                            description: "replacement text"
                        },
                    },
                    required: ["path", "old_str", "new_str"]
                }
            },
            {
                name: "write_file",
                description: "Create a NEW file with the given content. Fails if the file already exists (use edit_file for existing files).",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        path: {
                            type: Type.STRING
                        },
                        content: {
                            type: Type.STRING
                        }
                    },
                    required: ["path", "content"]
                }

            }
        ]

    }
]
const toolRegistry = {
    read_file: ({ path }: { path: string }) =>
        readFileSync(path, "utf-8"),

    list_file: ({ path }: { path: string }) =>
        readdirSync(path),

    file_exists: ({ path }: { path: string }) =>
        existsSync(path),

    edit_file: ({ path, old_str, new_str }: { path: string; old_str: string, new_str: string }) => {
        const full = resolveSafe(path);
        const content = readFileSync(full, "utf-8");
        const count = content.split(old_str).length - 1;
        if (count == 0) {
            return `Error: old_str not found in ${path}`;
        }
        if (count > 1) {
            return `Error: old_str appears ${count} times in ${path}`;
        }
        writeFileSync(full, content.replace(old_str, new_str))
        return `Edited ${path}`
    },

    write_file: ({ path, content }: { path: string; content: string }) => {
        const full = resolveSafe(path);
        if (existsSync(full)) {
            return `Error: ${path} already exists`
        }
        mkdirSync(dirname(full), { recursive: true })
        writeFileSync(full, content)
        return `created ${path}`
    }
};
export function runTool(toolName: string, args: any) {
    const tool = toolRegistry[toolName as keyof typeof toolRegistry];
    if (!tool) {
        console.log("undefined tool")
    }
    try {
        const result = tool(args)
        return result;
    } catch (error: any) {
        console.log(error.message)
    }
}