import { Provider } from "./types";
import { geminiProvider } from "./gemini";

const registry: Record<string, Provider> = {
  gemini: geminiProvider,
};

export function getProvider(name: string): Provider {
  const p = registry[name];
  if (!p) throw new Error(`No adapter for "${name}". Add one in providers/.`);
  return p;
}
