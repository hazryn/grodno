import type { GedcomDateValue } from './gedcom-date.js';
import type { Sex } from './sex.js';

/**
 * API-facing DTO domeny. Encje bazodanowe (TypeORM) żyją w apps/api;
 * tu jest kontrakt, który widzi front. Zgodny z modelem GEDCOM, ale projektowany od zera.
 */

export type EventOwnerType = 'individual' | 'family';

/** Typ relacji dziecko↔rodzina (GEDCOM PEDI). */
export type PedigreeType = 'birth' | 'adopted' | 'foster' | 'sealing' | 'unknown';

export interface PlaceDto {
  id: string;
  /** Pełny zapis "Miasto, Region, Kraj". */
  name: string;
  /** Pierwszy człon — miejscowość (do kafelków/markerów). */
  town: string | null;
  type: string | null;
  parentId: string | null;
  lat: number | null;
  lng: number | null;
  countryCode: string | null;
}

export interface PersonName {
  /** GEDCOM NAME type: 'birth' | 'married' | 'aka' | 'maiden' | ... */
  type: string;
  given: string | null;
  surname: string | null;
  /** Pełny zapis do wyświetlenia. */
  full: string;
}

/** Rola uczestnika zdarzenia (chrzestni przy chrzcie, świadkowie przy ślubie itp.). */
export type EventParticipantRole =
  | 'godparent'
  | 'godfather'
  | 'godmother'
  | 'witness'
  | 'officiant'
  | 'other';

/** Uczestnik zdarzenia — powiązanie osoba↔osoba (np. chrzestny) z fallbackiem na wolny tekst. */
export interface EventParticipantDto {
  id: string;
  /** Powiązana osoba w drzewie (klikalna) lub null, gdy tylko nazwa tekstowa. */
  individualId: string | null;
  /** Nazwa do wyświetlenia, gdy osoby nie ma w drzewie (lub uzupełnienie). */
  name: string | null;
  role: EventParticipantRole;
  sortOrder: number;
}

export interface EventDto {
  id: string;
  ownerType: EventOwnerType;
  /** Tag GEDCOM: BIRT, DEAT, MARR, RESI, OCCU, ... */
  type: string;
  date: GedcomDateValue | null;
  place: PlaceDto | null;
  /** Wolny tekst (np. zawód przy OCCU, opis). */
  value: string | null;
  /** Uczestnicy (np. chrzestni przy BAPM/CHR). Puste dla większości zdarzeń. */
  participants: EventParticipantDto[];
}

/** Oznaczenie osoby na zdjęciu ("kwadracik"). Współrzędne znormalizowane 0..1. */
export interface MediaTagDto {
  id: string;
  mediaId: string;
  /** Oznaczona osoba (klikalna → profil) lub null, gdy tylko nazwa tekstowa. */
  individualId: string | null;
  name: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MediaDto {
  id: string;
  title: string | null;
  filename: string | null;
  format: string | null;
  /** Presigned URL do MinIO/S3 (z `storageKey`); w starym imporcie = referencja GEDCOM. */
  url: string | null;
  /** Opis zdjęcia. */
  caption: string | null;
  /** Data wykonania zdjęcia (typ GEDCOM — bywa przybliżona). */
  takenDate: GedcomDateValue | null;
  width: number | null;
  height: number | null;
  /** Ręczna kolejność w galerii (drag-sort). */
  sortOrder: number;
  /** Avatar — wykluczany z galerii. */
  isAvatar: boolean;
  /** Oznaczenia osób na zdjęciu. */
  tags: MediaTagDto[];
}

export interface SourceDto {
  id: string;
  title: string | null;
  author: string | null;
}

/** Jedno doświadczenie zawodowe (styl LinkedIn). Źródło: zdarzenia OCCU z GEDCOM. */
export interface WorkExperience {
  /** Stanowisko (wartość OCCU). */
  title: string;
  /** Firma/pracodawca (OCCU › AGNC) lub null. */
  company: string | null;
  /** Rok/okres rozpoczęcia (string — bywa częściowy) lub null. */
  from: string | null;
  /** Rok zakończenia; null = obecnie. */
  to: string | null;
  /** URL logo firmy (favicon po domenie, OCCU › _DOMAIN) lub null. */
  logoUrl: string | null;
}

/** Link zewnętrzny (nekrolog, strona pamięci, Grobonet, Find a Grave itp.). Źródło: GEDCOM _LINK/WWW. */
export interface WebLink {
  /** Etykieta do wyświetlenia (z _LINK › TITL) lub null → front pokaże domenę. */
  label: string | null;
  url: string;
}

/** Małżeństwo/związek osoby — edytowane na ekranie „Dane" (jak w MyHeritage). */
export interface MarriageDto {
  partnershipId: string;
  /** Małżonek (osoba z drzewa) lub null. */
  spouseId: string | null;
  spouseName: string | null;
  /** 'married' (ślub) | 'partner' (związek nieformalny). */
  type: string;
  date: GedcomDateValue | null;
  placeName: string | null;
  /** Presigned URL zdjęcia ślubu. */
  photoUrl: string | null;
}

export interface IndividualDto {
  id: string;
  treeId: string;
  /** Oryginalny xref z GEDCOM (np. "I500001") — do round-tripu i debugowania. */
  xref: string;
  sex: Sex;
  names: PersonName[];
  primaryName: string;
  /** Czy żyjący (prywatność — ukrywanie danych dla niezalogowanych). */
  isLiving: boolean;
  birth: EventDto | null;
  death: EventDto | null;
  events: EventDto[];
  media: MediaDto[];
  photoUrl: string | null;
  /** Notka biograficzna (wolny tekst). */
  bio: string | null;
  /** Kontakt / social. E-maili może być wiele. */
  linkedinUrl: string | null;
  xUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  emails: string[];
  /** Doświadczenie zawodowe (styl LinkedIn). */
  experience: WorkExperience[];
  /** Linki zewnętrzne: nekrologi, strony pamięci, Grobonet, Find a Grave itp. */
  links: WebLink[];
  /** Małżeństwa/związki (ekran „Dane") — data, miejsce, zdjęcie, małżonek. */
  marriages: MarriageDto[];
}

export interface FamilyDto {
  id: string;
  treeId: string;
  xref: string;
  husbandId: string | null;
  wifeId: string | null;
  childIds: string[];
  events: EventDto[];
}
