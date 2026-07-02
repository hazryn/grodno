import { Injectable } from '@nestjs/common';
import type {
  TranslationInput,
  TranslationProvider,
  TranslationResult,
} from './translation-provider.interface';

const LANGUAGE: Record<string, string> = { pl: 'Polish', en: 'English', de: 'German' };

/**
 * Provider tłumaczeń przez endpoint zgodny z OpenAI (`/chat/completions`). Konfigurowalny z ENV:
 * TRANSLATE_API_BASE (np. https://api.openai.com/v1 albo http://localhost:11434/v1 dla Ollama),
 * TRANSLATE_API_KEY, TRANSLATE_MODEL, TRANSLATE_TIMEOUT_MS. Bez dodatkowych zależności (globalny fetch).
 */
@Injectable()
export class OpenAICompatibleProvider implements TranslationProvider {
  async translate({ text, targetLocale }: TranslationInput): Promise<TranslationResult> {
    const base = (process.env.TRANSLATE_API_BASE ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = process.env.TRANSLATE_MODEL ?? 'gpt-4o-mini';
    const key = process.env.TRANSLATE_API_KEY ?? '';
    const timeout = Number.parseInt(process.env.TRANSLATE_TIMEOUT_MS ?? '8000', 10);
    const lang = LANGUAGE[targetLocale] ?? targetLocale;

    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: `You are a translation engine. Translate the user's message into ${lang}. Preserve emoji, @mentions and formatting. Output ONLY the translation, with no preamble, notes or quotes.`,
          },
          { role: 'user', content: text },
        ],
      }),
      signal: AbortSignal.timeout(timeout),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Translate API ${res.status} ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const out = data.choices?.[0]?.message?.content?.trim();
    if (!out) throw new Error('Translate API: pusta odpowiedź');
    return { text: out, model };
  }
}
