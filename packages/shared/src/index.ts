// Jawne re-eksporty z rozszerzeniami .js (ESM/NodeNext). Pakiet jest ESM —
// Vite/Nuxt importują nazwane eksporty wprost, a Node 24 require()-uje go dla NestJS.
export { normalizeSex } from './sex.js';
export type { Sex } from './sex.js';

export { LOCALES, DEFAULT_LOCALE, normalizeLocale } from './locale.js';
export type { Locale } from './locale.js';

export {
  parseGedcomDate,
  gedcomDateSortKey,
  gedcomDateYear,
  formatGedcomDate,
  formatGedcomDatePl,
  MONTH_NAMES,
} from './gedcom-date.js';
export type { GedcomDateKind, SimpleDate, GedcomDateValue } from './gedcom-date.js';

export type {
  EventOwnerType,
  PedigreeType,
  PlaceDto,
  PersonName,
  EventParticipantRole,
  EventParticipantDto,
  EventDto,
  MediaTagDto,
  MediaDto,
  MarriageDto,
  SourceDto,
  WorkExperience,
  WebLink,
  IndividualDto,
  FamilyDto,
} from './domain.js';

export {
  EVENT_TYPE_CATALOG,
  EVENT_CATEGORY_LABELS_PL,
  eventTypeLabel,
  eventTypeLabelPl,
  eventCategoryLabel,
  eventTypeHasParticipants,
  isCoupleEventType,
} from './event-types.js';
export type { EventCategory, EventTypeDef } from './event-types.js';

export { formatPersonName, votoLabel, femaleSurname, VOTO_LABELS } from './person-name.js';

export type { PersonCard, Bundle, BundlePayload, SpouseRelation, Union } from './bundle.js';

export type {
  ConversationType,
  ChatMessageType,
  ParticipantRole,
  PresenceStatus,
  ChatContact,
  ChatParticipant,
  ChatAttachmentDto,
  ChatReactionDto,
  ChatMessageDto,
  ConversationDto,
  ChatTranslationDto,
  TypingPayload,
  ReadReceiptPayload,
  PresencePayload,
  ReactionUpdatePayload,
  ConversationUpdatedPayload,
} from './chat.js';
