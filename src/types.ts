export type ProviderConfig = {
    apiKey:string;
    model?: string;
};

export type AppConfig = {
  providers : Record<string, ProviderConfig>;
  defaultProvider: string | null;
}

export interface Provider{
  generate(prompt: string):Promise<string>;
}