import { Command } from 'commander';
import { load_config, save_config } from '../config/config';

export const logoutCommand = new Command("logout")
    .description('Lets user logout from the provider')
    .option('-p, --provider <providerName>', 'Name of the provider (gemini, claude etc)', '')
    .action((options) => {

        const config = load_config();
        delete config.providers[options.provider];

        if(config.defaultProvider === options.provider){
            config.defaultProvider = null;
        }
        save_config(config)
        console.log("logging out for provider " + options.provider)
    })


