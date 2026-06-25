/** Płeć wg GEDCOM SEX: M/F/X(intersex)/U(unknown). */
export type Sex = 'M' | 'F' | 'X' | 'U';

export function normalizeSex(raw: string | null | undefined): Sex {
  const s = (raw ?? '').trim().toUpperCase();
  if (s === 'M' || s === 'F' || s === 'X') return s;
  return 'U';
}
