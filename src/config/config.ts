import { join } from "path";
import { homedir } from "os";
import { AppConfig } from "../types";
import { existsSync, mkdirSync, readFileSync, writeFileSync, WriteStream } from "fs";

const CONFIG_DIR = join(homedir(), ".harness");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG: AppConfig = {
    providers: {},
    defaultProvider: null
}

export function load_config(): AppConfig {

    if (!existsSync(CONFIG_FILE)) {
        return DEFAULT_CONFIG;
    }
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
}


export function save_config(config: AppConfig) {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true })
    }
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
    console.log("Config saved!");

}