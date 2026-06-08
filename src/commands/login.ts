import { Command } from 'commander';
import { load_config, save_config } from '../config/config';

export const loginCommand = new Command("login")
    .description('Lets user login into the provider (use it as default)')
    .option('-p, --provider <providerName>', 'Name of the provider (gemini, claude etc)', '')
    .option('-a, --api_key <apiKey>', 'Your api key', '')
    .action((options) => {
        const config = load_config();

        config.providers[options.provider] = {
            apiKey: options.api_key
        }
        if (!config.defaultProvider) config.defaultProvider = options.provider;  
        save_config(config);
        console.log("logging into " + options.provider)
    })





