import { Provider } from "./types";
import { geminiProvider } from "./gemini";

const registry: Record<string, Provider> = {
  gemini: geminiProvider,
};

export function getProvider(name: string): Provider {
  const p = registry[name];
  if (!p) throw new Error(`Unknown provider "${name}". Available: ${Object.keys(registry).join(", ")}`);
  return p;
}
