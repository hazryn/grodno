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
