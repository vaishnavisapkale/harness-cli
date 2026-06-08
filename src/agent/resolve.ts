import { load_config } from "../config/config";
import catalog from "../model.json";

export interface Session {
    provider: string,
    model: string,
    apiKey: string
}

export function resolveSession(flagModel?: string): Session {
    const cfg = load_config();
    const provider = cfg.defaultProvider;

    if (!provider) {
        throw new Error("Not logged in. Run `harness providers login` first.");
    }

    const pc = cfg.providers[provider];
    if (!pc?.apiKey) {
        throw new Error(`NO API key stored for ${provider}, Login Again`)
    }

    const models: string[] = (catalog as any)[provider];
    if (!models || models.length === 0) {
        throw new Error(`${provider} has no models in model.json`)
    }

    const defaultModel = models[0];
    const model = flagModel ?? pc.model ?? defaultModel;
    if (!models.includes(model)) {
        throw new Error(`Model "${model}" invalid for ${provider}. Choose: ${models.join(", ")}`)
    }

    return {provider, model, apiKey: pc.apiKey }

}