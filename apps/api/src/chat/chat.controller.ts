import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type {
  ChatAttachmentDto,
  ChatContact,
  ChatMessageDto,
  ChatTranslationDto,
  ConversationDto,
  ReadReceiptPayload,
} from '@rodno/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../auth/current-user.decorator';
import { ChatService, type UploadedFile as ServiceFile } from './chat.service';
import { PushService } from './notifications/push.service';
import {
  AddParticipantsDto,
  CreateDirectDto,
  CreateGroupDto,
  EditMessageDto,
  MarkReadDto,
  PushSubscribeDto,
  PushUnsubscribeDto,
  ReactionDto,
  RenameGroupDto,
  SendMessageDto,
} from './dto/chat.dto';

/** Minimalny kształt pliku z Multera (bez @types/multer). */
interface MulterFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

function toInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly push: PushService,
  ) {}

  /* --------------------------------- kontakty / rozmowy --------------------------------- */

  @Get('contacts')
  contacts(@CurrentUser() me: JwtUser): Promise<ChatContact[]> {
    return this.chat.listContacts(me);
  }

  @Get('conversations')
  conversations(@CurrentUser() me: JwtUser): Promise<ConversationDto[]> {
    return this.chat.listConversations(me);
  }

  @Post('conversations/direct')
  createDirect(
    @CurrentUser() me: JwtUser,
    @Body() dto: CreateDirectDto,
  ): Promise<ConversationDto> {
    return this.chat.getOrCreateDirect(me, dto.userId);
  }

  @Post('conversations/group')
  createGroup(@CurrentUser() me: JwtUser, @Body() dto: CreateGroupDto): Promise<ConversationDto> {
    return this.chat.createGroup(me, dto.title, dto.userIds);
  }

  @Get('conversations/:id')
  getConversation(
    @CurrentUser() me: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ConversationDto> {
    return this.chat.getConversation(me, id);
  }

  @Patch('conversations/:id')
  rename(
    @CurrentUser() me: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RenameGroupDto,
  ): Promise<ConversationDto> {
    return this.chat.renameGroup(me, id, dto.title);
  }

  @Post('conversations/:id/avatar')
  @UseInterceptors(FileInterceptor('file'))
  groupAvatar(
    @CurrentUser() me: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: MulterFile,
  ): Promise<ConversationDto> {
    return this.chat.uploadGroupAvatar(me, id, file as ServiceFile);
  }

  @Post('conversations/:id/participants')
  addParticipants(
    @CurrentUser() me: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AddParticipantsDto,
  ): Promise<ConversationDto> {
    return this.chat.addParticipants(me, id, dto.userIds);
  }

  @Delete('conversations/:id/participants/:userId')
  removeParticipant(
    @CurrentUser() me: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<void> {
    return this.chat.removeParticipant(me, id, userId);
  }

  /* --------------------------------- wiadomości --------------------------------- */

  @Get('conversations/:id/messages')
  messages(
    @CurrentUser() me: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ): Promise<ChatMessageDto[]> {
    return this.chat.listMessages(me, id, before, toInt(limit, 30));
  }

  @Post('conversations/:id/messages')
  send(
    @CurrentUser() me: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SendMessageDto,
  ): Promise<ChatMessageDto> {
    return this.chat.sendMessage(me, id, {
      body: dto.body,
      replyToId: dto.replyToId ?? null,
      attachmentIds: dto.attachmentIds,
    });
  }

  @Post('conversations/:id/attachments')
  @UseInterceptors(FilesInterceptor('files', 10))
  attachments(
    @CurrentUser() me: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFiles() files: MulterFile[],
  ): Promise<ChatAttachmentDto[]> {
    return this.chat.uploadAttachments(me, id, (files ?? []) as ServiceFile[]);
  }

  @Post('conversations/:id/read')
  read(
    @CurrentUser() me: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MarkReadDto,
  ): Promise<ReadReceiptPayload> {
    return this.chat.markRead(me, id, dto.messageId);
  }

  @Patch('messages/:id')
  edit(
    @CurrentUser() me: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: EditMessageDto,
  ): Promise<ChatMessageDto> {
    return this.chat.editMessage(me, id, dto.body);
  }

  @Delete('messages/:id')
  unsend(
    @CurrentUser() me: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.chat.deleteMessage(me, id);
  }

  @Post('messages/:id/reactions')
  addReaction(
    @CurrentUser() me: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReactionDto,
  ): Promise<void> {
    return this.chat.react(me, id, dto.emoji, true);
  }

  @Delete('messages/:id/reactions')
  removeReaction(
    @CurrentUser() me: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('emoji') emoji: string,
  ): Promise<void> {
    return this.chat.react(me, id, emoji, false);
  }

  @Get('messages/:id/translation')
  translate(
    @CurrentUser() me: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('locale') locale?: string,
  ): Promise<ChatTranslationDto> {
    return this.chat.translateMessage(me, id, locale);
  }

  /* --------------------------------- web push --------------------------------- */

  @Post('push/subscribe')
  subscribePush(@CurrentUser() me: JwtUser, @Body() dto: PushSubscribeDto): Promise<void> {
    return this.push.subscribe(me.sub, dto);
  }

  @Delete('push/subscribe')
  unsubscribePush(
    @CurrentUser() me: JwtUser,
    @Body() dto: PushUnsubscribeDto,
  ): Promise<void> {
    return this.push.unsubscribe(me.sub, dto.endpoint);
  }
}
