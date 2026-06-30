import type { PersonName } from './domain.js';

/**
 * Etykiety kolejnych nazwisk po ślubie (po polsku; łac. primo/secundo voto).
 * Używane tylko gdy nazwisk po ślubie jest >1 — przy jednym nie etykietujemy.
 */
export const VOTO_LABELS = ['z 1. małżeństwa', 'z 2. małżeństwa', 'z 3. małżeństwa', 'z 4. małżeństwa'];

export function votoLabel(i: number): string {
  return VOTO_LABELS[i] ?? `z ${i + 1}. małżeństwa`;
}

/**
 * Żeńska forma nazwiska męża (nazwisko po ślubie kobiety): adjektywne
 * -ski/-cki/-dzki → -ska/-cka/-dzka; nazwiska niezmienne (Nowak, Szejna, niepolskie)
 * zostają. Złożone/wielowyrazowe (np. „Boos Schroeder") → null (do ręcznej edycji).
 */
export function femaleSurname(surname: string | null | undefined): string | null {
  const s = (surname ?? '').trim();
  if (!s || /\s/.test(s)) return null;
  if (s.endsWith('dzki')) return s.slice(0, -4) + 'dzka';
  if (s.endsWith('cki')) return s.slice(0, -3) + 'cka';
  if (s.endsWith('ski')) return s.slice(0, -3) + 'ska';
  return s;
}

/**
 * Wyświetlana nazwa osoby z uwzględnieniem nazwisk po ślubie:
 * - bez ślubu → pełne nazwisko z urodzenia,
 * - jedno po ślubie → „Imię NazwiskoPoŚlubie (zd. NazwiskoRodowe)",
 * - wiele po ślubie → bieżące (ostatnie) jako główne + „(zd. …, primo voto …)".
 */
export function formatPersonName(names: PersonName[] | null | undefined): string {
  if (!names || !names.length) return '…';
  const primary = names[0];
  const given = (primary.given ?? primary.full?.split(/\s+/)[0] ?? '').trim();
  const birthSurname = (primary.surname ?? '').trim();
  const married = names
    .filter((n) => n.type === 'married' && (n.surname ?? '').trim())
    .map((n) => (n.surname as string).trim());

  if (!married.length) return primary.full?.trim() || `${given} ${birthSurname}`.trim() || '…';

  const current = married[married.length - 1];
  const main = `${given} ${current}`.trim();
  const parts: string[] = [];
  if (birthSurname) parts.push(`zd. ${birthSurname}`);
  for (let i = 0; i < married.length - 1; i++) parts.push(`${votoLabel(i)} ${married[i]}`);
  return parts.length ? `${main} (${parts.join(', ')})` : main;
}
