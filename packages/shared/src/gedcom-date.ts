/**
 * Typ wartości daty GEDCOM — świadomie NIE goły `Date` (p. spec §12).
 * Daty genealogiczne bywają niepewne: "około 1900", "przed 1850", "między X a Y",
 * częściowe (sam rok / rok+miesiąc). Trzymamy surowy zapis + sparsowaną strukturę
 * + klucz sortowania. Round-trip do GEDCOM zachowuje `raw`.
 */

import type { Locale } from './locale.js';

export type GedcomDateKind =
  | 'exact' // 12 MAY 1900 / MAY 1900 / 1900
  | 'about' // ABT
  | 'calculated' // CAL
  | 'estimated' // EST
  | 'before' // BEF
  | 'after' // AFT
  | 'between' // BET x AND y
  | 'from' // FROM x  (period, otwarty koniec)
  | 'to' // TO y     (period, otwarty początek)
  | 'period' // FROM x TO y
  | 'interpreted' // INT
  | 'phrase' // (tekst) — nieparsowalna
  | 'unknown';

export interface SimpleDate {
  year?: number;
  month?: number; // 1-12
  day?: number; // 1-31
}

export interface GedcomDateValue {
  /** Surowy zapis z GEDCOM (po `2 DATE`), do round-tripu. */
  raw: string;
  kind: GedcomDateKind;
  /** Data główna (dla between/period = początek zakresu). */
  date?: SimpleDate;
  /** Druga data (between → "AND", period → "TO"). */
  end?: SimpleDate;
}

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

/** Skrócone nazwy miesięcy per locale (reużywane też przez selektor daty w UI). */
export const MONTH_NAMES: Record<Locale, string[]> = {
  pl: ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
};

/** Parsuje pojedynczą datę kalendarzową GEDCOM, np. "12 MAY 1900", "MAY 1900", "1900". */
function parseSimpleDate(input: string): SimpleDate | undefined {
  const s = input.trim();
  if (!s) return undefined;
  // Dual year "1900/01" → bierzemy pierwszy człon.
  const tokens = s.split(/\s+/);
  let day: number | undefined;
  let month: number | undefined;
  let year: number | undefined;

  for (const tok of tokens) {
    const up = tok.toUpperCase();
    if (MONTHS[up] !== undefined) {
      month = MONTHS[up];
      continue;
    }
    const yearMatch = up.match(/^(\d{1,4})(?:\/\d{1,4})?$/);
    if (yearMatch && yearMatch[1]) {
      const n = Number.parseInt(yearMatch[1], 10);
      // dzień ma <=31 i pojawia się przed miesiącem; rok zwykle 3-4 cyfry
      if (n <= 31 && month === undefined && year === undefined && tok.length <= 2) {
        day = n;
      } else {
        year = n;
      }
    }
  }
  if (year === undefined && month === undefined && day === undefined) return undefined;
  const out: SimpleDate = {};
  if (day !== undefined) out.day = day;
  if (month !== undefined) out.month = month;
  if (year !== undefined) out.year = year;
  return out;
}

/**
 * Parsuje pełną wartość daty GEDCOM z modyfikatorami.
 * Zwraca zawsze obiekt (kind='unknown' / 'phrase' dla nieznanych), bez wyjątków.
 */
export function parseGedcomDate(raw: string | null | undefined): GedcomDateValue | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value) return null;

  // Fraza w nawiasie: "(przed wojną)"
  if (value.startsWith('(')) {
    return { raw: value, kind: 'phrase' };
  }

  const upper = value.toUpperCase();

  const between = upper.match(/^BET\s+(.+?)\s+AND\s+(.+)$/);
  if (between) {
    return {
      raw: value,
      kind: 'between',
      date: parseSimpleDate(between[1]!),
      end: parseSimpleDate(between[2]!),
    };
  }

  const period = upper.match(/^FROM\s+(.+?)\s+TO\s+(.+)$/);
  if (period) {
    return {
      raw: value,
      kind: 'period',
      date: parseSimpleDate(period[1]!),
      end: parseSimpleDate(period[2]!),
    };
  }

  const simplePrefixes: Array<[RegExp, GedcomDateKind]> = [
    [/^ABT\s+(.+)$/, 'about'],
    [/^CAL\s+(.+)$/, 'calculated'],
    [/^EST\s+(.+)$/, 'estimated'],
    [/^BEF\s+(.+)$/, 'before'],
    [/^AFT\s+(.+)$/, 'after'],
    [/^FROM\s+(.+)$/, 'from'],
    [/^TO\s+(.+)$/, 'to'],
    [/^INT\s+(.+?)(?:\s+\(.*\))?$/, 'interpreted'],
  ];
  for (const [re, kind] of simplePrefixes) {
    const m = upper.match(re);
    if (m) {
      return { raw: value, kind, date: parseSimpleDate(m[1]!) };
    }
  }

  const simple = parseSimpleDate(value);
  if (simple) return { raw: value, kind: 'exact', date: simple };
  return { raw: value, kind: 'unknown' };
}

/**
 * Klucz sortowania (liczba YYYYMMDD, brak elementu = środek zakresu).
 * `null`, gdy nie da się ustalić roku — takie idą na koniec list chronologicznych.
 */
export function gedcomDateSortKey(value: GedcomDateValue | null | undefined): number | null {
  if (!value) return null;
  const d = value.date ?? value.end;
  if (!d || d.year === undefined) return null;
  const y = d.year;
  const m = d.month ?? 6;
  const day = d.day ?? 15;
  return y * 10000 + m * 100 + day;
}

/** Tylko rok (do kafelków drzewa / "lifespan"). */
export function gedcomDateYear(value: GedcomDateValue | null | undefined): number | null {
  if (!value) return null;
  const y = value.date?.year ?? value.end?.year;
  return y ?? null;
}

const KIND_PREFIX: Record<Locale, Partial<Record<GedcomDateKind, string>>> = {
  pl: { about: 'ok. ', calculated: 'wyl. ', estimated: 'sz. ', before: 'przed ', after: 'po ' },
  en: { about: 'c. ', calculated: 'calc. ', estimated: 'est. ', before: 'before ', after: 'after ' },
  de: { about: 'um ', calculated: 'ber. ', estimated: 'gesch. ', before: 'vor ', after: 'nach ' },
};

/** Słowa łączące zakresy: [between/period start, between/period join, from, to]. */
const DATE_WORDS: Record<Locale, { btw: string; and: string; from: string; to: string; fromOpen: string; toOpen: string }> = {
  pl: { btw: 'między', and: 'a', from: 'od', to: 'do', fromOpen: 'od', toOpen: 'do' },
  en: { btw: 'between', and: 'and', from: 'from', to: 'to', fromOpen: 'from', toOpen: 'until' },
  de: { btw: 'zwischen', and: 'und', from: 'von', to: 'bis', fromOpen: 'ab', toOpen: 'bis' },
};

function formatSimple(d: SimpleDate | undefined, locale: Locale): string {
  if (!d) return '';
  const parts: string[] = [];
  if (d.day !== undefined) parts.push(String(d.day));
  if (d.month !== undefined) parts.push(MONTH_NAMES[locale][d.month - 1] ?? String(d.month));
  if (d.year !== undefined) parts.push(String(d.year));
  return parts.join(' ');
}

/** Czytelny zapis daty w danym języku (domyślnie polski). */
export function formatGedcomDate(
  value: GedcomDateValue | null | undefined,
  locale: Locale = 'pl',
): string {
  if (!value) return '';
  const f = (d: SimpleDate | undefined) => formatSimple(d, locale);
  const w = DATE_WORDS[locale];
  switch (value.kind) {
    case 'between':
      return `${w.btw} ${f(value.date)} ${w.and} ${f(value.end)}`;
    case 'period':
      return `${w.from} ${f(value.date)} ${w.to} ${f(value.end)}`;
    case 'from':
      return `${w.fromOpen} ${f(value.date)}`;
    case 'to':
      return `${w.toOpen} ${f(value.date)}`;
    case 'phrase':
    case 'unknown':
      return value.raw;
    default:
      return (KIND_PREFIX[locale][value.kind] ?? '') + f(value.date);
  }
}

/** Wrapper PL (zgodność wsteczna). */
export function formatGedcomDatePl(value: GedcomDateValue | null | undefined): string {
  return formatGedcomDate(value, 'pl');
}
