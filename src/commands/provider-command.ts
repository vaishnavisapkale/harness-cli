import { Command } from 'commander';
import { loginCommand } from './login'
import { logoutCommand } from './logout'
import { setProviderCommand } from './setProvider'
import { listCommand } from './lists'

export const providerCommand = new Command("providers")
    .description("Provider related information")
    .addCommand(loginCommand)
    .addCommand(logoutCommand)
    .addCommand(setProviderCommand)
    .addCommand(listCommand)



 


