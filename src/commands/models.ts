import { Command } from "commander";
import models from "../model.json"
import { load_config, save_config } from "../config/config";

export const modelsCommand = new Command("models")
  .description('Returns all the supported models')
  .option('-m, --model <modelName>', 'name of the model', 'all')
  .action((options) => {
     if(options.model === 'all') {
        Object.entries(models).forEach(([provider, modelList]) => {
            console.log(`models for ${provider}:`);
            modelList.forEach((model) => {
              console.log(` ${model}`);
            });
          });
     }
     Object.entries(models).forEach(([provider, modelList]) => {
      const found = (modelList as string[]).find(
        (model) => model === options.model
      );
      if (found) {
        console.log(`supported by ${provider}`);
      }

    });
  });

  //subCommand
  modelsCommand.command("use <model>")
  .description("set the model for the active provider ")
  .action((model: string)=>{
      const cfg = load_config();
      const provider = cfg.defaultProvider;

      if(!provider){
        return console.error("login first")
      }

      const modelList = (models as any)[provider] as string[] || undefined;
     if(!modelList.includes(model)){
      return console.error(`model for ${provider} is not available choose: ${modelList.join(", ")}`)
     }

     cfg.providers[provider]!.model = model;
     save_config(cfg);
     console.log(`new Model ${model}`)
  })