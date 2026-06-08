import { Command } from "commander";
import { load_config } from "../config/config";

export const listCommand  = new Command("list")
.description("List Providers")
.action(()=>{
    const config = load_config();
    const providers = Object.keys(
        config.providers
    )
    if(providers.length === 0){
        console.log("no provider found");
        return
    }
    console.table(providers);
})