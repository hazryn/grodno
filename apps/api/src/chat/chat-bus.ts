import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type {
  ChatMessageDto,
  ConversationUpdatedPayload,
  ReactionUpdatePayload,
  ReadReceiptPayload,
} from '@rodno/shared';

/** Nazwy zdarzeń domenowych czatu (ChatService → gateway). */
export const CHAT_EVENTS = {
  messageNew: 'message:new',
  messageEdited: 'message:edited',
  messageDeleted: 'message:deleted',
  reactionUpdated: 'reaction:updated',
  readReceipt: 'read:receipt',
  conversationUpdated: 'conversation:updated',
} as const;

export interface MessageNewEvent {
  conversationId: string;
  message: ChatMessageDto;
  /** Uczestnicy poza nadawcą — do powiadomień push dla offline. */
  recipientUserIds: string[];
}

export interface MessageEditedEvent {
  conversationId: string;
  message: ChatMessageDto;
}

export interface MessageDeletedEvent {
  conversationId: string;
  messageId: string;
}

export interface ConversationUpdatedEvent {
  participantUserIds: string[];
  payload: ConversationUpdatedPayload;
}

/**
 * Szyna zdarzeń między ChatService a ChatGateway — luźne wiązanie bez cyklu DI.
 * Serwis publikuje (persist done), gateway subskrybuje i rozsyła po pokojach socketów + push.
 */
@Injectable()
export class ChatBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Wiadomości niech nie krzyczą o "possible memory leak" przy wielu subskrybentach.
    this.emitter.setMaxListeners(50);
  }

  emitMessageNew(e: MessageNewEvent): void {
    this.emitter.emit(CHAT_EVENTS.messageNew, e);
  }
  emitMessageEdited(e: MessageEditedEvent): void {
    this.emitter.emit(CHAT_EVENTS.messageEdited, e);
  }
  emitMessageDeleted(e: MessageDeletedEvent): void {
    this.emitter.emit(CHAT_EVENTS.messageDeleted, e);
  }
  emitReaction(e: ReactionUpdatePayload): void {
    this.emitter.emit(CHAT_EVENTS.reactionUpdated, e);
  }
  emitReadReceipt(e: ReadReceiptPayload): void {
    this.emitter.emit(CHAT_EVENTS.readReceipt, e);
  }
  emitConversationUpdated(e: ConversationUpdatedEvent): void {
    this.emitter.emit(CHAT_EVENTS.conversationUpdated, e);
  }

  onMessageNew(fn: (e: MessageNewEvent) => void): void {
    this.emitter.on(CHAT_EVENTS.messageNew, fn);
  }
  onMessageEdited(fn: (e: MessageEditedEvent) => void): void {
    this.emitter.on(CHAT_EVENTS.messageEdited, fn);
  }
  onMessageDeleted(fn: (e: MessageDeletedEvent) => void): void {
    this.emitter.on(CHAT_EVENTS.messageDeleted, fn);
  }
  onReaction(fn: (e: ReactionUpdatePayload) => void): void {
    this.emitter.on(CHAT_EVENTS.reactionUpdated, fn);
  }
  onReadReceipt(fn: (e: ReadReceiptPayload) => void): void {
    this.emitter.on(CHAT_EVENTS.readReceipt, fn);
  }
  onConversationUpdated(fn: (e: ConversationUpdatedEvent) => void): void {
    this.emitter.on(CHAT_EVENTS.conversationUpdated, fn);
  }
}
