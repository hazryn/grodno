// Jawne re-eksporty z rozszerzeniami .js (ESM/NodeNext). Pakiet jest ESM —
// Vite/Nuxt importują nazwane eksporty wprost, a Node 24 require()-uje go dla NestJS.
export { normalizeSex } from './sex.js';
export type { Sex } from './sex.js';

export {
  parseGedcomDate,
  gedcomDateSortKey,
  gedcomDateYear,
  formatGedcomDatePl,
} from './gedcom-date.js';
export type { GedcomDateKind, SimpleDate, GedcomDateValue } from './gedcom-date.js';

export type {
  EventOwnerType,
  PedigreeType,
  PlaceDto,
  PersonName,
  EventDto,
  MediaDto,
  SourceDto,
  WorkExperience,
  IndividualDto,
  FamilyDto,
} from './domain.js';

export type { PersonCard, Bundle, BundlePayload, SpouseRelation, Union } from './bundle.js';
