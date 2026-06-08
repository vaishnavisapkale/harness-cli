import "dotenv/config"
import  { Command } from "commander";
import { runAgent } from "../agent/agent";

export const agentCommand = new Command("agent")
  .description("Runs the agent")
  .option("-p, --prompt <prompt>", "prompt", "")
  .action(async (options) => {
    const prompt = options.prompt;
    if (!prompt) {
      console.log("Please Provide a prompt using -p");
    }
    try {
      const result = await runAgent(prompt);
      console.log(result);
    } catch (e: any) {
      console.error(e.message);   
      process.exit(1);
    }

  });


