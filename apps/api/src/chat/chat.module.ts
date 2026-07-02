import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Conversation,
  ConversationParticipant,
  Individual,
  Message,
  MessageAttachment,
  MessageReaction,
  MessageTranslation,
  PushSubscription,
  User,
} from '../database/entities';
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { PresenceService } from './presence.service';
import { ChatBus } from './chat-bus';
import { PushService } from './notifications/push.service';
import { UnreadDigestService } from './notifications/unread-digest.service';
import { OpenAICompatibleProvider } from './translation/openai-compatible.provider';
import { TRANSLATION_PROVIDER } from './translation/translation-provider.interface';

/**
 * Moduł czatu: REST (historia/CRUD), a w kolejnych krokach gateway Socket.IO, tłumaczenia,
 * web-push i cron przypomnień. MediaService jest @Global, więc nie trzeba go importować.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Conversation,
      ConversationParticipant,
      Message,
      MessageAttachment,
      MessageReaction,
      MessageTranslation,
      PushSubscription,
      User,
      Individual,
    ]),
    AuthModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatGateway,
    PresenceService,
    ChatBus,
    PushService,
    UnreadDigestService,
    { provide: TRANSLATION_PROVIDER, useClass: OpenAICompatibleProvider },
  ],
})
export class ChatModule {}
