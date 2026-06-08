import { Command } from 'commander';
import { load_config, save_config } from '../config/config';

export const setProviderCommand = new Command("set")
    .description('Lets user set the default provider')
    .option('-p, --provider <providerName>')
    .action((options) => {

      const config = load_config();

      if(!config.providers[options.provider]){
        console.log("Provider not found");
        return;
      }
     config.defaultProvider = options.provider;
     save_config(config);
     console.log(`Default provider set to ${options.provider}`)
    })



