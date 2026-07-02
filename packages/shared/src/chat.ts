import type { Sex } from './sex.js';

/**
 * Kontrakt czatu współdzielony przez API i web. `seq` (numer porządkowy wiadomości)
 * jest źródłem prawdy o kolejności i odczytach. Czasy jako ISO string (JSON).
 */

export type ConversationType = 'direct' | 'group';
export type ChatMessageType = 'text' | 'image' | 'system';
export type ParticipantRole = 'member' | 'admin';
export type PresenceStatus = 'online' | 'offline';

/** Osoba, do której można napisać: żyjący posiadacz konta w moim drzewie. */
export interface ChatContact {
  userId: string;
  individualId: string | null;
  displayName: string;
  photoUrl: string | null;
  sex: Sex;
  online: boolean;
  lastSeenAt: string | null;
}

/** Uczestnik rozmowy (z obecnością i wskaźnikiem odczytu do potwierdzeń w grupach). */
export interface ChatParticipant {
  userId: string;
  individualId: string | null;
  displayName: string;
  photoUrl: string | null;
  sex: Sex;
  role: ParticipantRole;
  online: boolean;
  lastSeenAt: string | null;
  lastReadSeq: number;
}

export interface ChatAttachmentDto {
  id: string;
  url: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
}

/** Zagregowana reakcja emoji (ilu + czy moja). */
export interface ChatReactionDto {
  emoji: string;
  count: number;
  userIds: string[];
  mine: boolean;
}

export interface ChatMessageDto {
  id: string;
  conversationId: string;
  seq: number;
  senderId: string | null;
  type: ChatMessageType;
  body: string | null;
  replyToId: string | null;
  systemKind: string | null;
  systemMeta: Record<string, unknown> | null;
  attachments: ChatAttachmentDto[];
  reactions: ChatReactionDto[];
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface ConversationDto {
  id: string;
  type: ConversationType;
  title: string | null;
  photoUrl: string | null;
  participants: ChatParticipant[];
  lastMessage: ChatMessageDto | null;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
}

/** Wynik tłumaczenia; `translated=false` → oddany oryginał (wyłączone/błąd/ten sam język). */
export interface ChatTranslationDto {
  messageId: string;
  targetLocale: string;
  text: string;
  translated: boolean;
  sourceLocale: string | null;
}

/* ------------------------------ payloady realtime ------------------------------ */

export interface TypingPayload {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface ReadReceiptPayload {
  conversationId: string;
  userId: string;
  lastReadSeq: number;
  lastReadMessageId: string | null;
  lastReadAt: string;
}

export interface PresencePayload {
  userId: string;
  status: PresenceStatus;
  lastSeenAt: string | null;
}

export interface ReactionUpdatePayload {
  messageId: string;
  conversationId: string;
  emoji: string;
  userId: string;
  op: 'add' | 'remove';
}

export interface ConversationUpdatedPayload {
  conversationId: string;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
}
