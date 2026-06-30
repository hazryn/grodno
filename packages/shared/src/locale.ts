/** Obsługiwane języki interfejsu/etykiet. Domyślny: polski. */
export type Locale = 'pl' | 'en' | 'de';

export const LOCALES: Locale[] = ['pl', 'en', 'de'];
export const DEFAULT_LOCALE: Locale = 'pl';

/** Bezpieczne zawężenie dowolnego stringa do obsługiwanego locale (fallback PL). */
export function normalizeLocale(value: string | null | undefined): Locale {
  return value === 'en' || value === 'de' ? value : 'pl';
}
