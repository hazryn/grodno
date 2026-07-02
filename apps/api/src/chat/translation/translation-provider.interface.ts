/** Token DI dla wymiennego providera tłumaczeń. */
export const TRANSLATION_PROVIDER = 'TRANSLATION_PROVIDER';

export interface TranslationInput {
  text: string;
  targetLocale: string;
  sourceLocale?: string;
}

export interface TranslationResult {
  text: string;
  sourceLocale?: string | null;
  model: string;
}

/** Abstrakcja tłumacza — domyślnie OpenAI-compatible; wymienny na lokalne Ollama itp. */
export interface TranslationProvider {
  translate(input: TranslationInput): Promise<TranslationResult>;
}
