/**
 * Katalog typów zdarzeń osi czasu (zgodny z GEDCOM, zakres faktów jak w MyHeritage).
 * Front używa go do etykiet (PL) i do pickera przy dodawaniu zdarzenia.
 * `tag` to znacznik GEDCOM (z prefiksem `_` dla rozszerzeń niestandardowych).
 */

import type { Locale } from './locale.js';

export type EventCategory =
  | 'vital' // życiowe
  | 'religious' // religijne
  | 'family' // rodzinne
  | 'career' // kariera / edukacja
  | 'migration' // migracje / spisy
  | 'personal'; // osobiste

export interface EventTypeDef {
  tag: string;
  labelPl: string;
  category: EventCategory;
  /** Czy typ wspiera uczestników (np. chrzestnych) w UI. */
  participants?: boolean;
  /** Ukryty w pickerze dodawania (rozpoznawany tylko do etykiet istniejących zdarzeń). */
  hidden?: boolean;
}

export const EVENT_CATEGORY_LABELS_PL: Record<EventCategory, string> = {
  vital: 'Życiowe',
  religious: 'Religijne',
  family: 'Rodzinne',
  career: 'Kariera i edukacja',
  migration: 'Migracje i spisy',
  personal: 'Osobiste',
};

export const EVENT_TYPE_CATALOG: EventTypeDef[] = [
  // Życiowe
  { tag: 'BIRT', labelPl: 'Urodziny', category: 'vital' },
  { tag: 'DEAT', labelPl: 'Zgon', category: 'vital' },
  { tag: 'BURI', labelPl: 'Pogrzeb', category: 'vital' },
  { tag: 'CREM', labelPl: 'Kremacja', category: 'vital' },

  // Religijne
  { tag: 'BAPM', labelPl: 'Chrzest', category: 'religious', participants: true },
  // CHR (christening) = również „chrzest"; ukryty w pickerze, ale rozpoznawany dla zaimportowanych zdarzeń.
  { tag: 'CHR', labelPl: 'Chrzest', category: 'religious', participants: true, hidden: true },
  { tag: 'CONF', labelPl: 'Bierzmowanie', category: 'religious', participants: true },
  { tag: 'FCOM', labelPl: 'Pierwsza komunia', category: 'religious', participants: true },
  { tag: 'BARM', labelPl: 'Bar micwa', category: 'religious' },
  { tag: 'BASM', labelPl: 'Bat micwa', category: 'religious' },
  { tag: 'ORDN', labelPl: 'Święcenia', category: 'religious' },

  // Rodzinne
  { tag: 'ENGA', labelPl: 'Zaręczyny', category: 'family' },
  { tag: 'MARR', labelPl: 'Ślub', category: 'family', participants: true },
  { tag: 'MARB', labelPl: 'Zapowiedzi', category: 'family' },
  { tag: 'DIV', labelPl: 'Rozwód', category: 'family' },
  { tag: 'ANUL', labelPl: 'Unieważnienie', category: 'family' },

  // Kariera / edukacja
  { tag: 'OCCU', labelPl: 'Zawód', category: 'career' },
  { tag: 'EDUC', labelPl: 'Edukacja', category: 'career' },
  { tag: 'GRAD', labelPl: 'Ukończenie szkoły', category: 'career' },
  { tag: 'RETI', labelPl: 'Emerytura', category: 'career' },
  { tag: '_MILT', labelPl: 'Służba wojskowa', category: 'career' },

  // Migracje / spisy
  { tag: 'RESI', labelPl: 'Zamieszkanie', category: 'migration' },
  { tag: 'EMIG', labelPl: 'Emigracja', category: 'migration' },
  { tag: 'IMMI', labelPl: 'Imigracja', category: 'migration' },
  { tag: 'NATU', labelPl: 'Naturalizacja', category: 'migration' },
  { tag: 'CENS', labelPl: 'Spis ludności', category: 'migration' },

  // Osobiste
  { tag: 'RELI', labelPl: 'Religia', category: 'personal' },
  { tag: 'NATI', labelPl: 'Narodowość', category: 'personal' },
  { tag: 'DSCR', labelPl: 'Rysopis', category: 'personal' },
  { tag: 'CAUS', labelPl: 'Przyczyna zgonu', category: 'personal' },
  { tag: 'PROP', labelPl: 'Majątek', category: 'personal' },
  { tag: 'TITL', labelPl: 'Tytuł', category: 'personal' },
  { tag: 'IDNO', labelPl: 'Numer identyfikacyjny', category: 'personal' },
  { tag: 'EVEN', labelPl: 'Wydarzenie', category: 'personal' },
];

const BY_TAG: Record<string, EventTypeDef> = Object.fromEntries(
  EVENT_TYPE_CATALOG.map((e) => [e.tag, e]),
);

/** Tłumaczenia etykiet zdarzeń (PL żyje w katalogu jako labelPl). */
const EVENT_LABELS_EN: Record<string, string> = {
  BIRT: 'Birth', DEAT: 'Death', BURI: 'Burial', CREM: 'Cremation',
  BAPM: 'Baptism', CHR: 'Christening', CONF: 'Confirmation', FCOM: 'First communion',
  BARM: 'Bar mitzvah', BASM: 'Bat mitzvah', ORDN: 'Ordination',
  ENGA: 'Engagement', MARR: 'Marriage', MARB: 'Banns', DIV: 'Divorce', ANUL: 'Annulment',
  OCCU: 'Occupation', EDUC: 'Education', GRAD: 'Graduation', RETI: 'Retirement', _MILT: 'Military service',
  RESI: 'Residence', EMIG: 'Emigration', IMMI: 'Immigration', NATU: 'Naturalization', CENS: 'Census',
  RELI: 'Religion', NATI: 'Nationality', DSCR: 'Physical description', CAUS: 'Cause of death',
  PROP: 'Property', TITL: 'Title', IDNO: 'ID number', EVEN: 'Event',
};

const EVENT_LABELS_DE: Record<string, string> = {
  BIRT: 'Geburt', DEAT: 'Tod', BURI: 'Beerdigung', CREM: 'Einäscherung',
  BAPM: 'Taufe', CHR: 'Taufe', CONF: 'Firmung', FCOM: 'Erstkommunion',
  BARM: 'Bar Mizwa', BASM: 'Bat Mizwa', ORDN: 'Ordination',
  ENGA: 'Verlobung', MARR: 'Heirat', MARB: 'Aufgebot', DIV: 'Scheidung', ANUL: 'Annullierung',
  OCCU: 'Beruf', EDUC: 'Ausbildung', GRAD: 'Schulabschluss', RETI: 'Ruhestand', _MILT: 'Militärdienst',
  RESI: 'Wohnsitz', EMIG: 'Auswanderung', IMMI: 'Einwanderung', NATU: 'Einbürgerung', CENS: 'Volkszählung',
  RELI: 'Religion', NATI: 'Nationalität', DSCR: 'Personenbeschreibung', CAUS: 'Todesursache',
  PROP: 'Vermögen', TITL: 'Titel', IDNO: 'Ausweisnummer', EVEN: 'Ereignis',
};

const EVENT_CATEGORY_LABELS_EN: Record<EventCategory, string> = {
  vital: 'Life events', religious: 'Religious', family: 'Family',
  career: 'Career & education', migration: 'Migration & census', personal: 'Personal',
};

const EVENT_CATEGORY_LABELS_DE: Record<EventCategory, string> = {
  vital: 'Lebensereignisse', religious: 'Religiös', family: 'Familie',
  career: 'Beruf & Ausbildung', migration: 'Migration & Zählung', personal: 'Persönlich',
};

/** Etykieta typu zdarzenia w danym języku (fallback: PL → sam znacznik). */
export function eventTypeLabel(tag: string, locale: Locale = 'pl'): string {
  if (locale === 'en') return EVENT_LABELS_EN[tag] ?? BY_TAG[tag]?.labelPl ?? tag;
  if (locale === 'de') return EVENT_LABELS_DE[tag] ?? BY_TAG[tag]?.labelPl ?? tag;
  return BY_TAG[tag]?.labelPl ?? tag;
}

/** Etykieta kategorii zdarzeń w danym języku. */
export function eventCategoryLabel(cat: EventCategory, locale: Locale = 'pl'): string {
  if (locale === 'en') return EVENT_CATEGORY_LABELS_EN[cat];
  if (locale === 'de') return EVENT_CATEGORY_LABELS_DE[cat];
  return EVENT_CATEGORY_LABELS_PL[cat];
}

/** Wrapper PL (zgodność wsteczna). */
export function eventTypeLabelPl(tag: string): string {
  return eventTypeLabel(tag, 'pl');
}

/** Czy dany typ zdarzenia ma sens z uczestnikami (chrzestni/świadkowie). */
export function eventTypeHasParticipants(tag: string): boolean {
  return BY_TAG[tag]?.participants ?? false;
}

/** Zdarzenia pary (ślub/rozwód/zaręczyny…) — edytowane na ekranie „Dane", nie na osi czasu. */
export function isCoupleEventType(tag: string): boolean {
  return BY_TAG[tag]?.category === 'family';
}
