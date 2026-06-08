import { Command } from 'commander';
import { load_config, save_config } from '../config/config';

export const logoutCommand = new Command("logout")
    .description('Lets user logout from the provider')
    .requiredOption('-p, --provider <providerName>', 'Name of the provider (gemini, claude etc)', '')
    .action((options) => {
        const config = load_config();
        if(!options.provider){
            console.log("please mention -p providername to logout")
        }
        if (!config.providers[options.provider]) {
            console.log(`Not logged in to ${options.provider}`);
            return;
        }
        delete config.providers[options.provider];

        if (config.defaultProvider === options.provider) {
            config.defaultProvider = Object.keys(config.providers)[0] ?? null;
        }
        save_config(config)
        console.log("logging out for provider " + options.provider)
    })


