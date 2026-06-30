/**
 * Katalog typów zdarzeń osi czasu (zgodny z GEDCOM, zakres faktów jak w MyHeritage).
 * Front używa go do etykiet (PL) i do pickera przy dodawaniu zdarzenia.
 * `tag` to znacznik GEDCOM (z prefiksem `_` dla rozszerzeń niestandardowych).
 */

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

/** Etykieta PL dla znacznika (fallback: sam znacznik). */
export function eventTypeLabelPl(tag: string): string {
  return BY_TAG[tag]?.labelPl ?? tag;
}

/** Czy dany typ zdarzenia ma sens z uczestnikami (chrzestni/świadkowie). */
export function eventTypeHasParticipants(tag: string): boolean {
  return BY_TAG[tag]?.participants ?? false;
}

/** Zdarzenia pary (ślub/rozwód/zaręczyny…) — edytowane na ekranie „Dane", nie na osi czasu. */
export function isCoupleEventType(tag: string): boolean {
  return BY_TAG[tag]?.category === 'family';
}
