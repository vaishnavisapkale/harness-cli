import { load_config } from "../config/config";
import catalog from "../model.json";

export interface Session {
    provider: string,
    model: string,
    apiKey: string
}

export function resolveSession(flagModel?: string): Session {
    // for a sandbox / terminal-bench container where no login exists
    // Set GEMINI_API_KEY (and optionally HARNESS_MODEL, HARNESS_PROVIDER) and it works
    // without touching ~/.config. This bypasses the login flow entirely.
    const envProvider = process.env.HARNESS_PROVIDER ?? "gemini";
    const envKey = process.env.GEMINI_API_KEY ?? process.env.HARNESS_API_KEY;
    if (envKey) {
        const models: string[] = (catalog as any)[envProvider] ?? [];
        const model = flagModel ?? process.env.HARNESS_MODEL ?? models[0];
        if (!model) {
            throw new Error(
                `No model for provider "${envProvider}". Set HARNESS_MODEL or add it to model.json.`
            );
        }
        return { provider: envProvider, model, apiKey: envKey };
    }

    // Normal config-based flow (after `harness providers login`)
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

    return { provider, model, apiKey: pc.apiKey }
}
