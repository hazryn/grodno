import type { Sex } from './sex.js';

/**
 * Kontrakt "bundle" silnika drzewa. Inspirowany sprawdzonym modułem webtrees,
 * ale zaprojektowany od zera pod Rodno (nasze UUID, typowane pola, bez zaszłości).
 *
 * Idea: klient pobiera "bundle" osoby = kafelek + JEDEN skok relacji (rodzice,
 * małżonek, dzieci, opcjonalnie rodzeństwo). Z bundli skleja graf i leniwie
 * dociąga kolejne (przyciski +/− na kafelkach). Dzięki flagom hasParents/childCount
 * wie, gdzie jest co rozwijać, bez dodatkowego requestu.
 */

/** Płaski kafelek osoby do drzewa (bez przodków/potomków). */
export interface PersonCard {
  id: string;
  xref: string;
  name: string;
  /** Nazwa do wyświetlenia z nazwiskami po ślubie, np. „Oliwia Szejna (zd. Czech)". */
  displayName: string;
  sex: Sex;
  /** Rok urodzenia (string, bo bywa "ok."/częściowy) lub null. */
  birth: string | null;
  death: string | null;
  /** "1900–1970" itp. */
  lifespan: string | null;
  /** Miejscowość urodzenia (pierwszy człon Place) do kafelka. */
  birthplace: string | null;
  /** Pełny zapis miejsca do tooltipa. */
  birthplaceFull: string | null;
  photoUrl: string | null;
  /** Link do profilu LinkedIn (badge na kafelku), jeśli podany. */
  linkedinUrl: string | null;
  /** Link do profilu Facebook (badge na kafelku), jeśli podany. */
  facebookUrl: string | null;
  /** Czy WIEMY, że osoba zmarła (wstążka żałobna). Różne od !isLiving (nieznany ≠ zmarły). */
  deceased: boolean;
  /** Czy osoba ma rodziców → przycisk "rozwiń w górę". */
  hasParents: boolean;
  /** Liczba dzieci (po wszystkich związkach) → przycisk "rozwiń w dół". */
  childCount: number;
  /** Czy żyjący — front może chcieć inaczej oznaczyć (prywatność). */
  isLiving: boolean;
}

/** Jedna osoba + jeden skok relacji. */
/** Typ związku osoby z `spouse`: ślub (jest zdarzenie MARR) vs partner (dzieci bez MARR). */
export type SpouseRelation = 'married' | 'partner';

/** Jeden związek osoby: małżonek/partner + jego typ + dzieci z tego związku. */
export interface Union {
  spouse: PersonCard | null;
  relation: SpouseRelation | null;
  children: PersonCard[];
}

export interface Bundle {
  self: PersonCard;
  father: PersonCard | null;
  mother: PersonCard | null;
  spouse: PersonCard | null;
  /** Rodzaj związku z `spouse` (null gdy brak małżonka). */
  spouseRelation: SpouseRelation | null;
  children: PersonCard[];
  /** WSZYSTKIE związki osoby (mąż/żona, potem partner itd.) — każdy z dziećmi. */
  unions: Union[];
  /** Tylko dla focal-a: rodzeństwo (dzieci tych samych rodziców). */
  siblings?: PersonCard[];
}

/**
 * Głęboki payload startowy — focal + N pokoleń przodków i M potomków w jednym
 * requeście (bez dociągania po pierwszym renderze).
 */
export interface BundlePayload {
  focal: string;
  bundles: Bundle[];
}
