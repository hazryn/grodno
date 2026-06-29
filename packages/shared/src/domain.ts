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

export interface EventDto {
  id: string;
  ownerType: EventOwnerType;
  /** Tag GEDCOM: BIRT, DEAT, MARR, RESI, OCCU, ... */
  type: string;
  date: GedcomDateValue | null;
  place: PlaceDto | null;
  /** Wolny tekst (np. zawód przy OCCU, opis). */
  value: string | null;
}

export interface MediaDto {
  id: string;
  title: string | null;
  filename: string | null;
  format: string | null;
  /** URL miniatury (S3/MinIO docelowo; w POC = referencja z GEDCOM). */
  url: string | null;
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
  /** Kontakt / social. E-maili może być wiele. */
  linkedinUrl: string | null;
  xUrl: string | null;
  emails: string[];
  /** Doświadczenie zawodowe (styl LinkedIn). */
  experience: WorkExperience[];
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
