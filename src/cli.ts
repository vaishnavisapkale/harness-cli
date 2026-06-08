import "dotenv/config";
import { program } from 'commander';
import { modelsCommand } from './commands/models';
import { agentCommand } from './commands/agentCommand';
import { providerCommand } from './commands/provider-command';

program
  .name('harness')
  .description('Coding agent cli')
  .version('0.1.0')
  .action(async () => {          
    await import("./tui");  
    })
  .addCommand(modelsCommand)
  .addCommand(agentCommand)
  .addCommand(providerCommand);
  
program.parse();
