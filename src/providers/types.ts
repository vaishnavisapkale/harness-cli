export interface ToolCall{
    name:string,
    args: Record<string, any>
}

export interface NeutralMessage{
   role: "user" | "tool" | "assistant";
   text?: string;
   toolCalls? : ToolCall[];
   toolName? : string;
   toolResult?: any;
}
export interface GenerateInput{
    model: string;
    apiKey: string;
    system: string;
    messages: NeutralMessage[];
    tools: any[];
}

export interface GenerateResult{
    text: string,
    toolCalls: ToolCall[];
}

export interface Provider{
  generate(input: GenerateInput): Promise<GenerateResult>
}